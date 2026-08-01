/**
 * reader.js
 *
 * Wires the viewer and the speech engine to the reader screen and owns the
 * playback state.
 *
 * Reading advances a page at a time: text is pulled from the page that is
 * about to be spoken, not from the whole document, so playback starts as soon
 * as one page has been parsed and memory does not grow with the book.
 *
 * Pause is implemented as "cancel and remember the word", not as
 * `speechSynthesis.pause()`, which leaves Chrome in a state it does not always
 * come back from. Resuming re-speaks from the stored index, which is exact.
 */

const IDLE = "idle";
const READING = "reading";
const PAUSED = "paused";

export function createReader({ ui, view, speech, onExit }) {
  const state = {
    mode: IDLE,
    page: 1,
    word: 0,
    wordsOnPage: 0,
    trigger: null,
    token: 0,
  };

  /** Play stays disabled until the system has handed over at least one voice. */
  let voicesReady = false;

  /* ------------------------------------------------------------ status area */

  function showLoading(message) {
    const box = document.createElement("div");
    box.className = "status";
    const dots = document.createElement("div");
    dots.className = "dots";
    dots.append(
      document.createElement("span"),
      document.createElement("span"),
      document.createElement("span")
    );
    const text = document.createElement("p");
    text.textContent = message;
    box.append(dots, text);
    ui.status.replaceChildren(box);
  }

  function showError(message) {
    const box = document.createElement("p");
    box.className = "status status--error";
    box.textContent = message;
    ui.status.replaceChildren(box);
  }

  function clearStatus() {
    ui.status.replaceChildren();
  }

  /* --------------------------------------------------------------- controls */

  function syncControls() {
    const reading = state.mode !== IDLE;
    ui.btnPlay.textContent =
      state.mode === READING ? "Pausar" : state.mode === PAUSED ? "Reanudar" : "Leer";
    ui.btnPlay.setAttribute(
      "aria-label",
      state.mode === READING
        ? "Pausar la lectura en voz alta"
        : state.mode === PAUSED
          ? "Reanudar la lectura en voz alta"
          : "Leer el documento en voz alta"
    );
    ui.btnStop.disabled = !reading;
  }

  function setProgress(fraction) {
    const percent = Math.min(Math.max(fraction, 0), 1) * 100;
    ui.progressFill.style.width = `${percent}%`;
    ui.progress.setAttribute("aria-valuenow", String(Math.round(percent)));
  }

  function setPage(n) {
    ui.pageCurrent.textContent = String(n);
  }

  /* ---------------------------------------------------------------- opening */

  /**
   * @param {string | {data: ArrayBuffer}} source
   * @param {{title: string, subtitle?: string, trigger?: HTMLElement}} meta
   */
  async function open(source, meta) {
    const token = ++state.token;
    state.trigger = meta.trigger || null;

    ui.title.textContent = meta.title;
    ui.subtitle.textContent = meta.subtitle || "";
    ui.subtitle.hidden = !meta.subtitle;
    ui.counter.hidden = true;
    ui.library.hidden = true;
    ui.reader.hidden = false;
    ui.title.focus();

    resetPlayback();
    setProgress(0);
    showLoading("Abriendo el documento");

    try {
      const total = await view.open(source);
      if (token !== state.token) return;
      if (!total) throw new Error("El documento no tiene páginas.");

      ui.pageTotal.textContent = String(total);
      setPage(1);
      ui.counter.hidden = false;
      ui.btnPrev.disabled = false;
      ui.btnNext.disabled = false;
      ui.btnPlay.disabled = !voicesReady;
      clearStatus();
    } catch (error) {
      if (token !== state.token) return;
      console.error(error);
      showError(
        "No se pudo abrir el documento. Comprueba que el archivo existe y que es un PDF válido."
      );
      ui.btnPlay.disabled = true;
      ui.btnPrev.disabled = true;
      ui.btnNext.disabled = true;
    }
  }

  function exit() {
    state.token += 1;
    resetPlayback();
    view.close();
    clearStatus();
    ui.reader.hidden = true;
    ui.library.hidden = false;
    ui.btnPlay.disabled = !voicesReady;
    if (state.trigger && document.contains(state.trigger)) {
      state.trigger.focus();
    } else {
      ui.libraryTitle.focus();
    }
    state.trigger = null;
    onExit();
  }

  /* --------------------------------------------------------------- playback */

  function resetPlayback() {
    speech.stop();
    view.unpin();
    state.mode = IDLE;
    state.page = 1;
    state.word = 0;
    state.wordsOnPage = 0;
    syncControls();
  }

  function togglePlay() {
    if (state.mode === IDLE) {
      readFrom(view.currentPage, 0);
    } else if (state.mode === PAUSED) {
      readFrom(state.page, state.word);
    } else {
      pause();
    }
  }

  function pause() {
    speech.stop();
    state.mode = PAUSED;
    syncControls();
  }

  function stop() {
    speech.stop();
    view.unpin();
    state.mode = IDLE;
    state.word = 0;
    setProgress(0);
    syncControls();
  }

  function finish() {
    speech.stop();
    state.mode = IDLE;
    setProgress(1);
    syncControls();
  }

  /** Restarts the current utterance in place, for a voice or speed change. */
  function restartIfReading() {
    if (state.mode !== READING) return;
    readFrom(state.page, state.word);
  }

  async function readFrom(page, word) {
    const token = ++state.token;
    speech.stop();
    state.mode = READING;
    syncControls();

    // Cover pages, plates and blank pages carry no extractable text; walk
    // forward until there is something to say.
    let n = page;
    let start = word;
    let words = await view.getWords(n);
    while (!words.length && n < view.totalPages) {
      n += 1;
      start = 0;
      words = await view.getWords(n);
    }
    if (token !== state.token) return;

    if (!words.length) {
      finish();
      return;
    }

    state.page = n;
    state.word = start;
    state.wordsOnPage = words.length;
    await view.pinPage(n);
    if (token !== state.token) return;

    const total = view.totalPages;
    speech.speak({
      tokens: words.map((entry) => entry.str),
      from: start,
      onWord: (index) => {
        if (token !== state.token) return;
        state.word = index;
        view.keepInView(view.markWord(n, index));
        setPage(n);
        setProgress((n - 1 + index / words.length) / total);
      },
      onDone: () => {
        if (token !== state.token) return;
        if (n >= total) {
          finish();
          return;
        }
        readFrom(n + 1, 0);
      },
      onError: (event) => {
        if (token !== state.token) return;
        console.error("La síntesis de voz falló.", event);
        showError(
          "La voz seleccionada dejó de responder. Elige otra voz en la barra superior."
        );
        stop();
      },
    });
  }

  /* --------------------------------------------------------------- movement */

  function move(delta) {
    const next = view.currentPage + delta;
    if (next < 1 || next > view.totalPages) return;
    view.goToPage(next);
    if (state.mode !== IDLE) readFrom(next, 0);
  }

  /* ----------------------------------------------------------------- voices */

  function hideSpeechControls() {
    ui.speechGroups.forEach((group) => {
      group.hidden = true;
    });
    ui.speechNotice.hidden = false;
  }

  function fillVoices() {
    if (!speech.supported) {
      hideSpeechControls();
      return;
    }
    speech.whenVoicesReady((voices) => {
      if (!voices.length) {
        hideSpeechControls();
        return;
      }

      const groups = new Map();
      voices.forEach((entry, index) => {
        const lang = entry.lang || "—";
        if (!groups.has(lang)) groups.set(lang, []);
        groups.get(lang).push({ entry, index });
      });

      const fragment = document.createDocumentFragment();
      for (const [lang, items] of [...groups].sort((a, b) => a[0].localeCompare(b[0]))) {
        const group = document.createElement("optgroup");
        group.label = lang;
        for (const { entry, index } of items) {
          const option = document.createElement("option");
          option.value = String(index);
          option.textContent = entry.name;
          group.append(option);
        }
        fragment.append(group);
      }
      ui.voiceSelect.replaceChildren(fragment);

      // The bundled documents are in English, so an English voice is the
      // sensible starting point when the system offers one.
      const preferred = voices.findIndex((entry) => (entry.lang || "").startsWith("en"));
      const chosen = preferred >= 0 ? preferred : 0;
      ui.voiceSelect.value = String(chosen);
      speech.setVoice(voices[chosen]);
      voicesReady = true;
      ui.btnPlay.disabled = false;
    });
  }

  /* ------------------------------------------------------------------ wiring */

  ui.btnBack.addEventListener("click", exit);
  ui.btnPlay.addEventListener("click", togglePlay);
  ui.btnStop.addEventListener("click", stop);
  ui.btnPrev.addEventListener("click", () => move(-1));
  ui.btnNext.addEventListener("click", () => move(1));

  ui.voiceSelect.addEventListener("change", () => {
    speech.setVoice(speech.voices[Number(ui.voiceSelect.value)]);
    restartIfReading();
  });

  ui.speedRange.addEventListener("input", () => {
    const rate = Number(ui.speedRange.value);
    const label = `${rate.toFixed(1).replace(".", ",")}×`;
    speech.setRate(rate);
    ui.speedOutput.textContent = label;
    // Without this the slider is announced as a bare "1" instead of "1,0x".
    ui.speedRange.setAttribute("aria-valuetext", label);
  });
  // Restarting on release rather than on every tick keeps the drag smooth.
  ui.speedRange.addEventListener("change", restartIfReading);

  document.addEventListener("keydown", (event) => {
    if (ui.reader.hidden) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const tag = event.target instanceof HTMLElement ? event.target.tagName : "";
    const typing = tag === "SELECT" || tag === "INPUT" || tag === "TEXTAREA";

    if (event.key === "Escape") {
      event.preventDefault();
      exit();
      return;
    }
    if (typing) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
    }
  });

  // Without this the voice keeps talking after the tab is closed or reloaded.
  window.addEventListener("pagehide", () => speech.stop());

  fillVoices();
  syncControls();

  return { open, exit };
}
