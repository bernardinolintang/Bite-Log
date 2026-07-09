type SpeechRecognitionInstance = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

function getSpeechRecognition(): SpeechRecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function listenForSpeech(
  onTranscript: (text: string) => void,
  onError: () => void,
  onEnd: () => void,
): boolean {
  const SpeechRecognition = getSpeechRecognition();
  if (!SpeechRecognition) return false;
  const recognition = new SpeechRecognition();
  recognition.lang = "en-SG";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    onEnd();
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim();
    if (transcript) onTranscript(transcript);
    finish();
  };
  recognition.onerror = () => {
    onError();
    finish();
  };
  recognition.onend = finish;
  recognition.start();
  return true;
}
