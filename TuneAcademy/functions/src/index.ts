import { onObjectFinalized } from "firebase-functions/v2/storage";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initializeApp();

export const analyzeRecording = onObjectFinalized(
  { region: "us-east1" },
  async (event) => {
    const name = event.data.name;
    const bucket = event.data.bucket;

    // Only handle recordings/{userId}/{recordingId}.wav
    if (!name?.startsWith("recordings/")) return;
    const parts = name.split("/");
    if (parts.length !== 3 || !parts[2].endsWith(".wav")) return;

    const userId = parts[1];
    const recordingId = parts[2].slice(0, -4);

    const db = getFirestore();
    const reportRef = db.collection("reports").doc(recordingId);
    const snap = await reportRef.get();
    if (!snap.exists) return;

    const { instrument } = snap.data() as { instrument: string; challenge: string };

    // Download the WAV
    const [fileBuffer] = await getStorage().bucket(bucket).file(name).download();

    // POST to the Python analysis API
    const apiUrl = process.env.ANALYSIS_API_URL ?? "http://localhost:8000";

    const form = new FormData();
    form.append("instrument", instrument);
    form.append("audio", new Blob([new Uint8Array(fileBuffer)], { type: "audio/wav" }), "recording.wav");

    let result: {
      pitch_centre: number;
      pitch_stability: number;
      rhythm: number;
      tone_quality: number;
      note_attack: number;
      weaknesses: string[];
    };

    try {
      const resp = await fetch(`${apiUrl}/analyze`, { method: "POST", body: form });
      if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
      result = (await resp.json()) as typeof result;
    } catch (err) {
      await reportRef.update({ status: "error", error: String(err) });
      return;
    }

    const overall = Math.round(
      (result.pitch_centre +
        result.pitch_stability +
        result.rhythm +
        result.tone_quality +
        result.note_attack) / 5,
    );

    await reportRef.update({
      status: "done",
      overall_score: overall,
      dimension_scores: {
        pitch_centre: result.pitch_centre,
        pitch_stability: result.pitch_stability,
        rhythm: result.rhythm,
        tone_quality: result.tone_quality,
        note_attack: result.note_attack,
      },
      weaknesses: result.weaknesses,
      analyzedAt: new Date(),
    });

    console.log(`Report ${recordingId} for user ${userId} written with score ${overall}`);
  },
);
