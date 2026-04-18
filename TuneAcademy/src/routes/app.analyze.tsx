import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { InstrumentIcon } from "@/components/tuneacademy/InstrumentIcon";
import { challenges } from "@/lib/mockData";
import { useUploadRecording } from "@/hooks/useUploadRecording";
import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/app/analyze")({
  head: () => ({ meta: [{ title: "Analyze — TuneAcademy" }] }),
  component: AnalyzeTab,
});

type ChallengeKey = keyof typeof challenges;

// ── WAV encoding ──────────────────────────────────────────────────────────────

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);        // PCM
  view.setUint16(22, 1, true);        // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buf], { type: "audio/wav" });
}

// ── Component ─────────────────────────────────────────────────────────────────

function AnalyzeTab() {
  const [picked, setPicked] = useState<ChallengeKey | null>(null);
  const [recording, setRecording] = useState(false);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wavUrlRef = useRef<string | null>(null);

  const { uploadRecording, progress, uploading } = useUploadRecording();
  const nav = useNavigate();

  useEffect(() => {
    if (recording) {
      timerRef.current = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [recording]);

  useEffect(() => {
    return () => {
      if (wavUrlRef.current) URL.revokeObjectURL(wavUrlRef.current);
      mediaRecorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function startRecording() {
    setMicError(null);
    if (wavUrlRef.current) { URL.revokeObjectURL(wavUrlRef.current); wavUrlRef.current = null; }
    setWavBlob(null);
    setWavUrl(null);
    chunksRef.current = [];

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch {
      setMicError("Microphone access denied. Allow mic permission and try again.");
      return;
    }

    streamRef.current = stream;
    const mr = new MediaRecorder(stream);
    mediaRecorderRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const rawBlob = new Blob(chunksRef.current, { type: mr.mimeType });
      const arrayBuf = await rawBlob.arrayBuffer();
      const ctx = new AudioContext();
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      void ctx.close();

      // Mix down to mono
      const numCh = audioBuf.numberOfChannels;
      const mono = new Float32Array(audioBuf.length);
      for (let ch = 0; ch < numCh; ch++) {
        const data = audioBuf.getChannelData(ch);
        for (let i = 0; i < audioBuf.length; i++) mono[i] += data[i] / numCh;
      }

      const blob = encodeWav(mono, audioBuf.sampleRate);
      const url = URL.createObjectURL(blob);
      wavUrlRef.current = url;
      setWavBlob(blob);
      setWavUrl(url);
    };

    mr.start();
    setSeconds(0);
    setRecording(true);
  }

  function stopRecording() {
    setRecording(false);
    mediaRecorderRef.current?.stop();
  }

  function toggle() {
    if (recording) stopRecording();
    else void startRecording();
  }

  async function submit() {
    if (!wavBlob || !picked) return;
    const c = challenges[picked];
    try {
      const reportId = await uploadRecording({
        wavBlob,
        instrument: c.instrument,
        challenge: c.text,
      });
      nav({ to: "/app/analyze/result", search: { reportId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  function reset() {
    setPicked(null);
    if (wavUrlRef.current) { URL.revokeObjectURL(wavUrlRef.current); wavUrlRef.current = null; }
    setWavBlob(null);
    setWavUrl(null);
    setRecording(false);
    setSeconds(0);
    setMicError(null);
  }

  return (
    <AppShell>
      <header className="px-5 pt-8 pb-2">
        <h1 className="text-2xl font-bold tracking-tight">Submit a recording</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {picked ? "Follow the challenge below." : "Choose your instrument."}
        </p>
      </header>

      {!picked && (
        <div className="grid grid-cols-2 gap-3 px-5 pt-4">
          {(Object.keys(challenges) as ChallengeKey[]).map((k) => {
            const c = challenges[k];
            return (
              <button key={k} onClick={() => setPicked(k)} className="text-left">
                <Card className="flex h-44 flex-col justify-between p-4 transition-colors hover:border-foreground/40">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline">
                    <InstrumentIcon instrument={c.instrument} className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Solo {c.instrument}</p>
                    <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{c.text}</p>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {picked && (
        <div className="px-5 pt-4">
          <Card className="p-5">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Challenge</p>
            <p className="mt-2 text-lg font-semibold leading-snug">{challenges[picked].text}</p>
            <button
              onClick={reset}
              className="mt-3 text-xs text-muted-foreground underline underline-offset-4"
            >
              Change instrument
            </button>
          </Card>

          <div className="mt-10 flex flex-col items-center">
            <Waveform active={recording} />
            <p className="mt-4 text-3xl font-bold tabular-nums">
              {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
            </p>
            <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {recording ? "Recording" : wavUrl ? "Stopped" : "Ready"}
            </p>

            {micError && (
              <p className="mt-3 text-center text-xs text-destructive">{micError}</p>
            )}

            <button
              onClick={toggle}
              disabled={uploading}
              aria-label={recording ? "Stop" : "Record"}
              className="relative mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-background shadow-elevated transition-transform active:scale-95 disabled:opacity-50"
            >
              {recording && (
                <motion.div
                  className="absolute inset-0 rounded-full border border-foreground"
                  animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "easeOut" }}
                />
              )}
              {recording ? <Square className="h-7 w-7 fill-background" /> : <Mic className="h-8 w-8" />}
            </button>

            {wavUrl && !recording && (
              <div className="mt-8 w-full space-y-3">
                <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
                  Listen back
                </p>
                <audio src={wavUrl} controls className="w-full rounded-lg" />

                {uploading ? (
                  <div className="space-y-2">
                    <Progress value={Math.round(progress * 100)} />
                    <p className="text-center text-xs text-muted-foreground">Uploading…</p>
                  </div>
                ) : (
                  <Pill
                    size="lg"
                    className="w-full"
                    onClick={() => void submit()}
                  >
                    Submit recording
                  </Pill>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Waveform({ active }: { active: boolean }) {
  const bars = Array.from({ length: 28 });
  return (
    <div className="flex h-16 items-center gap-[3px]">
      {bars.map((_, i) => (
        <motion.span
          key={i}
          className="block w-[3px] rounded-full bg-foreground"
          animate={
            active
              ? { height: [6, 10 + Math.random() * 36, 6] }
              : { height: 4 }
          }
          transition={{
            duration: 0.7 + (i % 5) * 0.07,
            repeat: active ? Infinity : 0,
            ease: "easeInOut",
          }}
          style={{ height: 4 }}
        />
      ))}
    </div>
  );
}
