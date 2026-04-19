import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";

type TuneCoachSpeechRequest = {
  text: string;
};

type TuneCoachSpeechResponse = {
  audioBase64: string;
  mimeType: string;
};

export async function synthesizeTuneCoachSpeech(text: string): Promise<TuneCoachSpeechResponse> {
  const fn = httpsCallable<TuneCoachSpeechRequest, TuneCoachSpeechResponse>(
    getFirebaseFunctions(),
    "synthesizeTuneCoachSpeech",
  );
  const result = await fn({ text });
  return result.data;
}
