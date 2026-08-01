/**
 * main.js — entry point.
 *
 * Collects the elements the modules need, checks that PDF.js actually arrived
 * from the CDN, and connects the library screen to the reader screen.
 */

import { createPdfView } from "./modules/pdf-view.js";
import { createSpeech } from "./modules/speech.js";
import { createReader } from "./modules/reader.js";
import { initLibrary } from "./modules/library.js";

/** @returns {HTMLElement} */
function need(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Falta el elemento #${id} en el documento.`);
  return element;
}

function start() {
  const libraryNotice = document.getElementById("library-notice");

  // The reader is useless without PDF.js, and a blocked or offline CDN should
  // say so rather than leave a list of buttons that do nothing.
  if (!window.pdfjsLib) {
    if (libraryNotice) {
      libraryNotice.textContent =
        "No se pudo cargar PDF.js desde el CDN. Comprueba tu conexión y vuelve a cargar la página.";
      libraryNotice.hidden = false;
    }
    document
      .querySelectorAll("[data-pdf], #file-input")
      .forEach((element) => {
        element.disabled = true;
      });
    return;
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = document.documentElement.dataset.pdfWorker;

  const ui = {
    library: need("library"),
    libraryTitle: need("library-title"),
    reader: need("reader"),
    title: need("reader-title"),
    subtitle: need("reader-subtitle"),
    counter: need("page-counter"),
    pageCurrent: need("page-current"),
    pageTotal: need("page-total"),
    btnBack: need("btn-back"),
    btnPlay: need("btn-play"),
    btnStop: need("btn-stop"),
    btnPrev: need("btn-prev"),
    btnNext: need("btn-next"),
    voiceSelect: need("voice"),
    speedRange: need("speed"),
    speedOutput: need("speed-value"),
    // Both speech groups disappear together when the browser has no synthesis;
    // the pager between them stays, so the document is still readable.
    speechGroups: [need("speech-playback"), need("speech-settings")],
    speechNotice: need("speech-notice"),
    progress: need("progress"),
    progressFill: need("progress-fill"),
    viewer: need("viewer"),
    status: need("viewer-status"),
  };

  const view = createPdfView({
    viewer: ui.viewer,
    pagesEl: need("pages"),
    onPageChange: (page) => {
      ui.pageCurrent.textContent = String(page);
    },
  });

  const speech = createSpeech();
  const reader = createReader({ ui, view, speech, onExit: () => {} });

  initLibrary({
    list: need("book-list"),
    fileInput: document.getElementById("file-input"),
    onOpenUrl: (path, meta) => reader.open(path, meta),
    onOpenFile: (source, name) => reader.open(source, { title: name }),
    onReject: (message) => {
      if (!libraryNotice) return;
      libraryNotice.textContent = message;
      libraryNotice.hidden = false;
    },
  });
}

start();
