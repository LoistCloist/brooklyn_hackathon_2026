import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useUploadReel } from "@/hooks/useUploadReel";
import { videoFileToJpegBlob } from "@/lib/videoThumbnail";
import { cn } from "@/lib/utils";

const INSTRUMENTS = [
  { label: "Voice", value: "voice" },
  { label: "Guitar", value: "guitar" },
  { label: "Piano", value: "piano" },
  { label: "Saxophone", value: "saxophone" },
] as const;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploaderName: string;
  uploaderAvatarUrl: string;
  onPosted: (reelId: string) => void;
};

export function CreateReelDialog({
  open,
  onOpenChange,
  uploaderName,
  uploaderAvatarUrl,
  onPosted,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [instrument, setInstrument] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const { uploadReel, progress, uploading, error } = useUploadReel();

  useEffect(() => {
    if (!open) {
      setVideoFile(null);
      setInstrument(null);
      setCaption("");
    }
  }, [open]);

  useEffect(() => {
    if (!open && previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [open, previewUrl]);

  const pickVideo = () => fileInputRef.current?.click();

  const onFile: React.ChangeEventHandler<HTMLInputElement> = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !file.type.startsWith("video/")) {
      toast.error("Please choose a video file.");
      return;
    }
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    try {
      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => resolve();
        video.onerror = () => reject(new Error("Invalid video"));
      });
      if (video.duration > 60) {
        URL.revokeObjectURL(url);
        toast.error("Video must be 60 seconds or shorter.");
        return;
      }
    } catch {
      URL.revokeObjectURL(url);
      toast.error("Could not read that video.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(url);
    setVideoFile(file);
  };

  const post = async () => {
    if (!videoFile || !instrument) {
      toast.error("Pick a video and an instrument.");
      return;
    }
    let thumb: Blob;
    try {
      thumb = await videoFileToJpegBlob(videoFile);
    } catch {
      toast.error("Could not create a thumbnail; try another clip.");
      return;
    }
    try {
      const reelId = await uploadReel({
        videoFile,
        thumbnailBlob: thumb,
        instrument,
        caption,
        uploaderName,
        uploaderAvatarUrl,
      });
      onOpenChange(false);
      onPosted(reelId);
      toast.success("Reel posted!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !uploading && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border-border bg-background">
        <DialogHeader>
          <DialogTitle>New reel</DialogTitle>
        </DialogHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={onFile}
        />

        <Button type="button" variant="outline" onClick={pickVideo} disabled={uploading}>
          Pick video
        </Button>

        {previewUrl ? (
          <video
            src={previewUrl}
            className="mt-2 max-h-52 w-full rounded-md bg-black object-contain"
            muted
            playsInline
            loop
            autoPlay
            controls={false}
          />
        ) : null}

        <p className="text-xs text-muted-foreground">Clips over 60 seconds are not accepted.</p>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Instrument</p>
          <div className="flex flex-wrap gap-2">
            {INSTRUMENTS.map((chip) => {
              const selected = instrument === chip.value;
              return (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setInstrument(chip.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-muted/40 text-foreground hover:bg-muted",
                  )}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Caption (optional)</p>
          <Input
            placeholder="Short caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, 150))}
            maxLength={150}
            disabled={uploading}
          />
        </div>

        {uploading ? (
          <div className="space-y-2">
            <Progress value={Math.round(progress * 100)} />
            <p className="text-xs text-muted-foreground">Uploading…</p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void post()}
            disabled={!videoFile || !instrument || uploading}
          >
            Post reel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
