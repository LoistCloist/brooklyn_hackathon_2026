import { useCallback, useState } from "react";
import {
  collection,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { getFirebaseAuth, getFirestoreDb, getFirebaseStorage } from "@/lib/firebase";

function formatFirebaseErr(err: unknown, fallback: string): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = String((err as { code: string }).code);
    if (code === "storage/unauthorized") {
      return "Storage rejected the upload (storage/unauthorized). Publish storage.rules in Firebase Console (Storage → Rules) or run: firebase deploy --only storage";
    }
    if (code === "permission-denied") {
      return "Permission denied. Publish firestore.rules and storage.rules in Firebase Console, or run: firebase deploy --only firestore:rules,storage — then hard-refresh the app.";
    }
    if (code === "storage/canceled") {
      return "Upload was canceled.";
    }
  }
  if (err instanceof Error) {
    const m = err.message;
    if (/CORS|Failed to fetch|NetworkError/i.test(m)) {
      return "Network/CORS error while uploading. Confirm Storage rules are deployed and you are signed in.";
    }
    return m;
  }
  return fallback;
}

async function runResumableUpload(
  label: string,
  task: ReturnType<typeof uploadBytesResumable>,
  onProgress: (p: number) => void,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    task.on(
      "state_changed",
      (snap) => {
        const p = snap.totalBytes ? snap.bytesTransferred / snap.totalBytes : 0;
        onProgress(p);
      },
      (err) => reject(new Error(`${label}: ${formatFirebaseErr(err, "Upload failed.")}`)),
      () => resolve(),
    );
  });
}

export function useUploadReel(): {
  uploadReel: (args: {
    videoFile: File;
    thumbnailBlob: Blob;
    instrument: string;
    caption: string;
    uploaderName: string;
    uploaderAvatarUrl: string;
  }) => Promise<string>;
  progress: number;
  uploading: boolean;
  error: string | null;
} {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadReel = useCallback(
    async (args: {
      videoFile: File;
      thumbnailBlob: Blob;
      instrument: string;
      caption: string;
      uploaderName: string;
      uploaderAvatarUrl: string;
    }) => {
      setError(null);
      const auth = getFirebaseAuth();
      const user = auth.currentUser;
      if (!user) {
        const msg = "You must be signed in to post a reel.";
        setError(msg);
        throw new Error(msg);
      }

      const db = getFirestoreDb();
      const storage = getFirebaseStorage();
      const reelId = doc(collection(db, "reels")).id;
      const userId = user.uid;

      await user.getIdToken(true);

      const videoRef = ref(storage, `reels/${userId}/${reelId}.mp4`);
      const thumbRef = ref(storage, `reelThumbnails/${userId}/${reelId}.jpg`);

      setUploading(true);
      setProgress(0);

      try {
        const videoTask = uploadBytesResumable(
          videoRef,
          args.videoFile,
          { contentType: args.videoFile.type || "video/mp4" },
        );
        await runResumableUpload("Video upload", videoTask, (p) => setProgress(p * 0.85));

        const thumbTask = uploadBytesResumable(thumbRef, args.thumbnailBlob, {
          contentType: "image/jpeg",
        });
        await runResumableUpload("Thumbnail upload", thumbTask, (p) =>
          setProgress(0.85 + p * 0.1),
        );

        let videoUrl: string;
        let thumbnailUrl: string;
        try {
          videoUrl = await getDownloadURL(videoRef);
        } catch (e) {
          throw new Error(`Video download URL: ${formatFirebaseErr(e, "getDownloadURL failed.")}`);
        }
        try {
          thumbnailUrl = await getDownloadURL(thumbRef);
        } catch (e) {
          throw new Error(
            `Thumbnail download URL: ${formatFirebaseErr(e, "getDownloadURL failed.")}`,
          );
        }

        setProgress(0.97);
        try {
          await setDoc(doc(db, "reels", reelId), {
            uploaderId: userId,
            uploaderName: args.uploaderName,
            uploaderAvatarUrl: args.uploaderAvatarUrl,
            instrument: args.instrument,
            videoUrl,
            thumbnailUrl,
            caption: args.caption.trim(),
            likesCount: 0,
            commentsCount: 0,
            likedBy: [],
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          throw new Error(`Firestore (save reel): ${formatFirebaseErr(e, "setDoc failed.")}`);
        }

        setProgress(1);
        return reelId;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Upload failed.";
        setError(msg);
        throw new Error(msg);
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  return { uploadReel, progress, uploading, error };
}
