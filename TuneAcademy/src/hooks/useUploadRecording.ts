import { useCallback, useState } from "react";
import { collection, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAuth, getFirestoreDb, getFirebaseStorage } from "@/lib/firebase";

const ANALYZE_URL = "https://musilearn-api-966115096812.us-east1.run.app/analyze";

export function useUploadRecording(): {
  uploadRecording: (args: { wavBlob: Blob; instrument: string; challenge: string }) => Promise<string>;
  progress: number;
  uploading: boolean;
  error: string | null;
} {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadRecording = useCallback(
    async (args: { wavBlob: Blob; instrument: string; challenge: string; name?: string; referenceId?: string }): Promise<string> => {
      setError(null);
      const user = getFirebaseAuth().currentUser;
      if (!user) throw new Error("Must be signed in.");

      const db = getFirestoreDb();
      const storage = getFirebaseStorage();
      const recordingId = doc(collection(db, "reports")).id;
      const userId = user.uid;

      await setDoc(doc(db, "reports", recordingId), {
        userId,
        instrument: args.instrument,
        challenge: args.challenge,
        name: args.name ?? "",
        referenceId: args.referenceId ?? null,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      const storageRef = ref(storage, `recordings/${userId}/${recordingId}.wav`);
      setUploading(true);
      setProgress(0);

      try {
        await new Promise<void>((resolve, reject) => {
          const task = uploadBytesResumable(storageRef, args.wavBlob, {
            contentType: "audio/wav",
          });
          task.on(
            "state_changed",
            (snap) => setProgress(snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0),
            reject,
            resolve,
          );
        });
        setProgress(1);

        // Call analyze API and write results back to Firestore
        try {
          const form = new FormData();
          form.append("instrument", args.instrument);
          form.append("audio", args.wavBlob, "recording.wav");
          if (args.referenceId) form.append("reference_id", args.referenceId);

          const res = await fetch(ANALYZE_URL, { method: "POST", body: form });
          if (res.ok) {
            const analysis = await res.json();
            await updateDoc(doc(db, "reports", recordingId), {
              status: "done",
              overallScore: analysis.overall_score,
              dimensionScores: analysis.dimension_scores,
              weaknesses: analysis.weaknesses,
              ...(analysis.comparison ? { comparison: analysis.comparison } : {}),
            });
          } else {
            await updateDoc(doc(db, "reports", recordingId), { status: "error" });
          }
        } catch {
          await updateDoc(doc(db, "reports", recordingId), { status: "error" }).catch(() => null);
        }

        return recordingId;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setError(msg);
        await updateDoc(doc(db, "reports", recordingId), { status: "error" }).catch(() => null);
        throw new Error(msg);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return { uploadRecording, progress, uploading, error };
}
