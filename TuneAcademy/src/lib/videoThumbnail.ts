/** First-frame JPEG from a video file (web). Falls back to a tiny black JPEG blob on failure. */
export async function videoFileToJpegBlob(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error("Video load failed"));
    });
    video.currentTime = 0;
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error("Seek timeout")), 8000);
      const done = () => {
        window.clearTimeout(t);
        resolve();
      };
      video.onseeked = done;
      video.onerror = () => {
        window.clearTimeout(t);
        reject(new Error("Seek failed"));
      };
    });
    const w = video.videoWidth || 320;
    const h = video.videoHeight || 180;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No canvas context");
    ctx.drawImage(video, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.82),
    );
    if (blob) return blob;
  } catch {
    /* fall through */
  } finally {
    URL.revokeObjectURL(url);
  }
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, 2, 2);
  }
  const fallback = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8),
  );
  if (fallback) return fallback;
  return new Blob([], { type: "image/jpeg" });
}
