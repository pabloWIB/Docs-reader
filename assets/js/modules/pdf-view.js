/**
 * pdf-view.js
 *
 * Renders a PDF as a scrolling column of pages and exposes the geometry of
 * every word so another module can highlight what is being read.
 *
 * Two things drive the design:
 *
 * 1. Pages are rendered on demand. A 400 page book holds ~1.5 GB of canvas
 *    backing store if every page is drawn up front, which is enough to lose
 *    the tab on a phone. Each page reserves its space from the document's own
 *    aspect ratio, an IntersectionObserver draws it shortly before it scrolls
 *    into view, and canvases further than LIVE_PAGES from the current page are
 *    released back to the browser.
 *
 * 2. Word boxes are stored as percentages of the page, not pixels. The canvas
 *    is laid out at 100% of its column, so a pixel offset only lines up at one
 *    window width.
 */

/** Pages that keep a live canvas on either side of the current one. */
const LIVE_PAGES = 4;

/** How far outside the viewport a page starts rendering. */
const PRELOAD_MARGIN = "120% 0px";

/**
 * Devices report ratios up to 4. Rendering above 2 costs memory without a
 * visible gain at these page sizes.
 */
const MAX_PIXEL_RATIO = 2;

/**
 * @param {object} options
 * @param {HTMLElement} options.viewer   Scrolling container.
 * @param {HTMLElement} options.pagesEl  Element the page blocks are added to.
 * @param {(page: number) => void} options.onPageChange
 */
export function createPdfView({ viewer, pagesEl, onPageChange }) {
  /** @type {{el: HTMLElement, canvas: HTMLCanvasElement|null, layer: HTMLElement|null, words: object[]|null, task: object|null, rendering: boolean, pinned: boolean}[]} */
  let pages = [];
  let doc = null;
  let renderObserver = null;
  let currentObserver = null;
  let currentPage = 1;
  let marked = { page: 0, index: -1 };
  let generation = 0;

  /* ---------------------------------------------------------------- loading */

  /**
   * @param {string | {data: ArrayBuffer}} source URL, or bytes for a local file.
   * @returns {Promise<number>} page count
   */
  async function open(source) {
    close();
    const mine = ++generation;

    const task = window.pdfjsLib.getDocument(source);
    const loaded = await task.promise;
    if (mine !== generation) {
      loaded.destroy();
      return 0;
    }
    doc = loaded;

    // Reserve the column using the first page's shape. Books are uniform in
    // practice; a page that turns out different corrects itself when it draws.
    const first = await doc.getPage(1);
    const shape = first.getViewport({ scale: 1 });
    const ratio = `${shape.width} / ${shape.height}`;

    const fragment = document.createDocumentFragment();
    pages = [];
    for (let n = 1; n <= doc.numPages; n += 1) {
      const el = document.createElement("div");
      el.className = "page";
      el.id = `page-${n}`;
      el.style.setProperty("--page-ratio", ratio);
      el.dataset.page = String(n);

      // Sighted readers get the number under each page; assistive technology
      // gets it once, from the counter in the bar, instead of as several
      // hundred loose numbers in the accessibility tree.
      const label = document.createElement("div");
      label.className = "page__label";
      label.setAttribute("aria-hidden", "true");
      label.textContent = String(n);
      el.append(label);

      fragment.append(el);
      pages.push({
        el,
        canvas: null,
        layer: null,
        words: null,
        task: null,
        rendering: false,
        pinned: false,
      });
    }
    pagesEl.append(fragment);

    observe();
    currentPage = 1;
    return doc.numPages;
  }

  function close() {
    generation += 1;
    if (renderObserver) renderObserver.disconnect();
    if (currentObserver) currentObserver.disconnect();
    renderObserver = null;
    currentObserver = null;
    pages.forEach(release);
    pages = [];
    pagesEl.replaceChildren();
    marked = { page: 0, index: -1 };
    if (doc) {
      doc.destroy();
      doc = null;
    }
  }

  /* -------------------------------------------------------------- observers */

  function observe() {
    renderObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const n = Number(entry.target.dataset.page);
          renderPage(n).catch(reportRenderError);
        }
      },
      { root: viewer, rootMargin: PRELOAD_MARGIN }
    );

    // A separate observer, without the preload margin, decides which page the
    // reader is actually looking at.
    currentObserver = new IntersectionObserver(
      (entries) => {
        let best = null;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
        if (!best) return;
        const n = Number(best.target.dataset.page);
        if (n === currentPage) return;
        currentPage = n;
        trimCanvases();
        onPageChange(n);
      },
      { root: viewer, threshold: [0.1, 0.5, 0.9] }
    );

    for (const page of pages) {
      renderObserver.observe(page.el);
      currentObserver.observe(page.el);
    }
  }

  /* ---------------------------------------------------------------- drawing */

  async function renderPage(n) {
    const state = pages[n - 1];
    if (!state || state.canvas || state.rendering) return;

    const mine = generation;
    state.rendering = true;
    try {
      const page = await doc.getPage(n);
      if (mine !== generation) return;

      // One canvas pixel per CSS pixel of the column, times the display's
      // pixel ratio, so text stays sharp without over-allocating.
      const columnWidth = pagesEl.clientWidth || state.el.clientWidth || 720;
      const unscaled = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: columnWidth / unscaled.width });
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);

      const canvas = document.createElement("canvas");
      canvas.className = "page__canvas";
      canvas.width = Math.round(viewport.width * dpr);
      canvas.height = Math.round(viewport.height * dpr);

      state.el.style.setProperty(
        "--page-ratio",
        `${unscaled.width} / ${unscaled.height}`
      );
      state.el.prepend(canvas);
      state.canvas = canvas;

      state.task = page.render({
        canvasContext: canvas.getContext("2d", { alpha: false }),
        viewport,
        transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0],
      });
      await state.task.promise;
      state.task = null;
    } catch (error) {
      if (error && error.name === "RenderingCancelledException") return;
      throw error;
    } finally {
      state.rendering = false;
      if (mine === generation) trimCanvases();
    }
  }

  /** Frees canvases outside the live window, keeping any pinned page. */
  function trimCanvases() {
    for (let i = 0; i < pages.length; i += 1) {
      const state = pages[i];
      if (!state.canvas || state.pinned) continue;
      if (Math.abs(i + 1 - currentPage) > LIVE_PAGES) release(state);
    }
  }

  function release(state) {
    if (state.task) {
      state.task.cancel();
      state.task = null;
    }
    if (state.canvas) {
      // Zeroing the dimensions is what actually drops the backing store.
      state.canvas.width = 0;
      state.canvas.height = 0;
      state.canvas.remove();
      state.canvas = null;
    }
    if (state.layer && !state.pinned) {
      state.layer.remove();
      state.layer = null;
    }
  }

  function reportRenderError(error) {
    // A page that fails to draw should not take the reader down with it.
    console.error("No se pudo dibujar una página del PDF.", error);
  }

  /* ------------------------------------------------------------------ words */

  /**
   * Word boxes for one page, in reading order, cached after the first call.
   * Geometry assumes horizontal text, which is what these documents use.
   */
  async function getWords(n) {
    const state = pages[n - 1];
    if (!state) return [];
    if (state.words) return state.words;

    const page = await doc.getPage(n);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const words = [];

    for (const item of content.items) {
      if (!item.str || !item.str.trim()) continue;

      // Util.transform maps the item into viewport space, which already has
      // its origin at the top-left and y growing downwards.
      const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontHeight = Math.hypot(tx[2], tx[3]) || 12;
      const charWidth = item.width / item.str.length;

      // Split keeping the separators so the character cursor stays accurate.
      let cursor = 0;
      for (const token of item.str.split(/(\s+)/)) {
        if (!token) continue;
        if (!token.trim()) {
          cursor += token.length;
          continue;
        }
        words.push({
          str: token,
          left: ((tx[4] + cursor * charWidth) / viewport.width) * 100,
          // tx[5] is the baseline; lift the box by the ascent and give it a
          // little room so descenders are covered too.
          top: ((tx[5] - fontHeight) / viewport.height) * 100,
          width: ((token.length * charWidth) / viewport.width) * 100,
          height: ((fontHeight * 1.2) / viewport.height) * 100,
        });
        cursor += token.length;
      }
    }

    state.words = words;
    return words;
  }

  /**
   * Builds the highlight layer for one page and keeps that page resident.
   * Only one page is pinned at a time: the one being read.
   */
  async function pinPage(n) {
    pages.forEach((state, i) => {
      if (i + 1 === n) return;
      state.pinned = false;
      if (state.layer) {
        state.layer.remove();
        state.layer = null;
      }
    });

    const state = pages[n - 1];
    if (!state) return;
    state.pinned = true;

    await renderPage(n).catch(reportRenderError);
    if (state.layer) return;

    const words = await getWords(n);
    const layer = document.createElement("div");
    layer.className = "page__text";
    layer.setAttribute("aria-hidden", "true");

    const fragment = document.createDocumentFragment();
    for (const word of words) {
      const span = document.createElement("span");
      span.className = "word";
      span.style.left = `${word.left}%`;
      span.style.top = `${word.top}%`;
      span.style.width = `${word.width}%`;
      span.style.height = `${word.height}%`;
      fragment.append(span);
    }
    layer.append(fragment);
    state.el.append(layer);
    state.layer = layer;
    marked = { page: n, index: -1 };
  }

  function unpin() {
    for (const state of pages) {
      state.pinned = false;
      if (state.layer) {
        state.layer.remove();
        state.layer = null;
      }
    }
    marked = { page: 0, index: -1 };
  }

  /**
   * Moves the highlight to word `index` of page `n`.
   * Touches only the spans that changed, so the cost does not grow with the
   * length of the document.
   */
  function markWord(n, index) {
    const state = pages[n - 1];
    if (!state || !state.layer) return null;
    const spans = state.layer.children;
    if (index < 0 || index >= spans.length) return null;

    if (marked.page === n && marked.index >= 0) {
      const previous = spans[marked.index];
      if (previous) previous.className = "word is-done";
      // A jump backwards (rewind, speed change) needs the trailing marks cleared.
      if (index < marked.index) {
        for (let i = index; i <= marked.index; i += 1) spans[i].className = "word";
      } else {
        for (let i = marked.index + 1; i < index; i += 1) {
          spans[i].className = "word is-done";
        }
      }
    } else if (marked.page !== n) {
      for (let i = 0; i < index; i += 1) spans[i].className = "word is-done";
    }

    spans[index].className = "word is-current";
    marked = { page: n, index };
    return spans[index];
  }

  /* --------------------------------------------------------------- movement */

  function goToPage(n, behavior = "smooth") {
    const state = pages[n - 1];
    if (!state) return;
    currentPage = n;
    state.el.scrollIntoView({ behavior, block: "start" });
    onPageChange(n);
  }

  /** Scrolls only when the word has drifted out of the comfortable band. */
  function keepInView(span) {
    if (!span) return;
    const box = span.getBoundingClientRect();
    const frame = viewer.getBoundingClientRect();
    const margin = frame.height * 0.2;
    if (box.top >= frame.top + margin && box.bottom <= frame.bottom - margin) {
      return;
    }
    viewer.scrollTop += box.top - frame.top - frame.height / 2;
  }

  return {
    open,
    close,
    getWords,
    pinPage,
    unpin,
    markWord,
    goToPage,
    keepInView,
    get totalPages() {
      return doc ? doc.numPages : 0;
    },
    get currentPage() {
      return currentPage;
    },
  };
}
