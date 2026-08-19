const SpeechRecognitionImpl = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speechSupported = !!SpeechRecognitionImpl;

/**
 * Wraps the Web Speech API. Callers always get the same interface whether
 * or not the browser supports live recognition, so UI code never branches.
 */
export class SpeechInput {
  constructor({ onInterim, onFinal, onStart, onEnd, onError } = {}) {
    this.onInterim = onInterim || (() => {});
    this.onFinal = onFinal || (() => {});
    this.onStart = onStart || (() => {});
    this.onEnd = onEnd || (() => {});
    this.onError = onError || (() => {});
    this.recognizing = false;
    this.finalText = "";
    this.recognition = null;

    if (speechSupported) {
      this.recognition = new SpeechRecognitionImpl();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = "en-US";

      this.recognition.onresult = (event) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            this.finalText += (this.finalText && !this.finalText.endsWith(" ") ? " " : "") + transcript.trim();
            this.onFinal(this.finalText);
          } else {
            interim += transcript;
          }
        }
        if (interim) this.onInterim(interim);
      };

      this.recognition.onstart = () => {
        this.recognizing = true;
        this.onStart();
      };

      this.recognition.onend = () => {
        this.recognizing = false;
        this.onEnd();
      };

      this.recognition.onerror = (event) => {
        this.recognizing = false;
        this.onError(event.error || "speech-error");
      };
    }
  }

  start() {
    if (!speechSupported) {
      this.onError("unsupported");
      return;
    }
    this.finalText = "";
    try {
      this.recognition.start();
    } catch (err) {
      this.onError(err.message || "start-failed");
    }
  }

  stop() {
    if (!speechSupported || !this.recognition) return;
    try {
      this.recognition.stop();
    } catch {
      /* already stopped */
    }
  }
}
