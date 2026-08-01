/**
 * speech.js
 *
 * A thin wrapper over the Web Speech API that reads a list of words and
 * reports which one is being spoken.
 *
 * Text is sent in short chunks rather than as one long utterance. Chrome cuts
 * synthesis off after roughly fifteen seconds, so the chunk size is scaled by
 * the speaking rate to stay under that ceiling at every speed.
 */

/** Words per utterance at rate 1. Scaled by rate, then clamped. */
const BASE_CHUNK = 24;
const MIN_CHUNK = 8;
const MAX_CHUNK = 40;

/** Chrome drops an utterance queued in the same tick as a cancel(). */
const RESTART_DELAY = 80;

export function createSpeech() {
  const synth = window.speechSynthesis;
  const supported =
    Boolean(synth) && typeof window.SpeechSynthesisUtterance === "function";

  let voices = [];
  let voice = null;
  let rate = 1;
  /** Identity of the active reading run; anything from an older run is ignored. */
  let session = null;
  let timer = 0;

  /**
   * Chrome returns an empty list until `voiceschanged` fires, and a few builds
   * never fire it at all, so the event is backed by a short poll.
   * @param {(voices: SpeechSynthesisVoice[]) => void} callback
   */
  function whenVoicesReady(callback) {
    if (!supported) {
      callback([]);
      return;
    }
    let settled = false;
    let attempts = 0;

    const check = () => {
      if (settled) return;
      voices = synth.getVoices();
      if (!voices.length) return;
      settled = true;
      synth.removeEventListener("voiceschanged", check);
      window.clearInterval(poll);
      callback(voices);
    };

    synth.addEventListener("voiceschanged", check);
    const poll = window.setInterval(() => {
      attempts += 1;
      check();
      if (settled || attempts > 20) {
        window.clearInterval(poll);
        synth.removeEventListener("voiceschanged", check);
        if (!settled) callback(voices);
      }
    }, 150);
    check();
  }

  function setVoice(next) {
    voice = next || null;
  }

  function setRate(next) {
    rate = Math.min(Math.max(Number(next) || 1, 0.5), 2.5);
  }

  function stop() {
    session = null;
    window.clearTimeout(timer);
    if (supported) synth.cancel();
  }

  /**
   * @param {object} options
   * @param {string[]} options.tokens Words to read, in order.
   * @param {number} [options.from]   Index of the first word.
   * @param {(index: number) => void} options.onWord
   * @param {() => void} options.onDone   Reached the end of `tokens`.
   * @param {(error: SpeechSynthesisErrorEvent) => void} options.onError
   */
  function speak({ tokens, from = 0, onWord, onDone, onError }) {
    stop();
    if (!supported || !tokens.length) {
      onDone();
      return;
    }

    const id = {};
    session = id;
    let index = Math.min(Math.max(from, 0), tokens.length);

    function step() {
      if (session !== id) return;
      if (index >= tokens.length) {
        session = null;
        onDone();
        return;
      }

      const size = Math.min(
        Math.max(Math.round(BASE_CHUNK * rate), MIN_CHUNK),
        MAX_CHUNK
      );
      const slice = tokens.slice(index, index + size);

      // Character offset of each word inside the utterance, so a boundary
      // event can be resolved back to a word without re-splitting the string.
      const offsets = [];
      let text = "";
      for (const token of slice) {
        if (text) text += " ";
        offsets.push(text.length);
        text += token;
      }

      const base = index;
      let lastReported = -1;

      const utterance = new window.SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }

      // Engines that never emit boundary events still move the highlight once
      // per chunk, which keeps the page following along.
      utterance.onstart = () => {
        if (session === id) onWord(base);
      };

      utterance.onboundary = (event) => {
        if (session !== id || event.name === "sentence") return;
        let i = 0;
        while (i + 1 < offsets.length && offsets[i + 1] <= event.charIndex) {
          i += 1;
        }
        if (i === lastReported) return;
        lastReported = i;
        onWord(base + i);
      };

      utterance.onend = () => {
        if (session !== id) return;
        index = base + slice.length;
        step();
      };

      utterance.onerror = (event) => {
        if (session !== id) return;
        // Cancelling to pause, change voice or change speed lands here.
        if (event.error === "interrupted" || event.error === "canceled") return;
        session = null;
        onError(event);
      };

      synth.speak(utterance);
    }

    timer = window.setTimeout(step, RESTART_DELAY);
  }

  return {
    supported,
    whenVoicesReady,
    setVoice,
    setRate,
    speak,
    stop,
    get voices() {
      return voices;
    },
  };
}
