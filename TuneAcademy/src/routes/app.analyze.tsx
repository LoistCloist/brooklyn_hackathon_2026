import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { InstrumentIcon } from "@/components/tuneacademy/InstrumentIcon";
import { challenges } from "@/lib/mockData";
import { useUploadRecording } from "@/hooks/useUploadRecording";
import { Mic, Square, Loader2, ChevronLeft, Music2, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";
import { collection, getDocs } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

export const Route = createFileRoute("/app/analyze")({
  head: () => ({ meta: [{ title: "Analyze — TuneAcademy" }] }),
  component: AnalyzeTab,
});

type ChallengeKey = keyof typeof challenges;
type Step = "pick-instrument" | "record";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackInfo {
  track_id: string;
  progression: string;
  tempo: number;
  key: string;
  style: string;
}

interface SongInfo {
  track_id: string;
  title: string;
  artist: string;
  tempo_bpm: number;
  duration_seconds: number;
  instrument: string;
}

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
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
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

// ── Inline MIDI section ───────────────────────────────────────────────────────

function MidiSection({
  isGuitar,
  selectedTrack,
  selectedSong,
  onPickTrack,
  onPickSong,
  onClear,
}: {
  isGuitar: boolean;
  selectedTrack: TrackInfo | null;
  selectedSong: SongInfo | null;
  onPickTrack: (track: TrackInfo) => void;
  onPickSong: (song: SongInfo) => void;
  onClear: () => void;
}) {
  const [tracks, setTracks] = useState<TrackInfo[]>([]);
  const [songs, setSongs] = useState<SongInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [styleFilter, setStyleFilter] = useState<"all" | "solo" | "comp">("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const col = isGuitar ? "guitarset_tracks" : "lakh_tracks";
    getDocs(collection(getFirestoreDb(), col))
      .then((snap) => {
        if (isGuitar) {
          setTracks(snap.docs.map((d) => ({ track_id: d.id, ...(d.data() as Omit<TrackInfo, "track_id">) })));
        } else {
          setSongs(snap.docs.map((d) => ({ track_id: d.id, ...(d.data() as Omit<SongInfo, "track_id">) })));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isGuitar]);

  function fmtDuration(secs: number) {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  const filteredTracks = tracks.filter((t) => styleFilter === "all" || t.style === styleFilter);
  const filteredSongs = songs.filter((s) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return s.title?.toLowerCase().includes(q) || s.artist?.toLowerCase().includes(q);
  });

  const hasSelection = selectedTrack !== null || selectedSong !== null;
  const selectionLabel = selectedTrack
    ? `${selectedTrack.progression} — ${selectedTrack.key}`
    : selectedSong
    ? selectedSong.title ?? selectedSong.track_id
    : null;
  const selectionSub = selectedTrack
    ? `${selectedTrack.style} · ${selectedTrack.tempo} BPM`
    : selectedSong
    ? `${selectedSong.artist ?? ""}${selectedSong.tempo_bpm ? ` · ${selectedSong.tempo_bpm} BPM` : ""}`
    : null;

  return (
    <div className="space-y-3">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          MIDI Reference <span className="normal-case">(optional)</span>
        </p>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {hasSelection && !expanded && (
        <Card className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{selectionLabel}</p>
            {selectionSub && <p className="mt-0.5 text-xs text-muted-foreground capitalize">{selectionSub}</p>}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Clear
          </button>
        </Card>
      )}

      {expanded && (
        <div className="space-y-3">
          {isGuitar ? (
            <div className="flex gap-2">
              {(["all", "solo", "comp"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setStyleFilter(f)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                    styleFilter === f
                      ? "border-foreground bg-foreground text-background"
                      : "border-hairline text-muted-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          ) : (
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by title or artist…"
              className="w-full rounded-lg border border-hairline bg-transparent px-4 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (isGuitar ? filteredTracks.length === 0 : filteredSongs.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Music2 className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {!isGuitar && query ? "No songs match your search." : "No MIDI tracks loaded yet."}
              </p>
            </div>
          )}

          {isGuitar
            ? filteredTracks.map((track) => (
                <button
                  key={track.track_id}
                  onClick={() => { onPickTrack(track); setExpanded(false); }}
                  className="w-full text-left"
                >
                  <Card
                    className={`flex items-center justify-between px-4 py-3 transition-colors hover:border-foreground/40 ${
                      selectedTrack?.track_id === track.track_id ? "border-foreground" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">
                        {track.progression} — {track.key}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground capitalize">
                        {track.style} · {track.tempo} BPM
                      </p>
                    </div>
                    <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                  </Card>
                </button>
              ))
            : filteredSongs.map((song) => (
                <button
                  key={song.track_id}
                  onClick={() => { onPickSong(song); setExpanded(false); }}
                  className="w-full text-left"
                >
                  <Card
                    className={`flex items-center justify-between px-4 py-3 transition-colors hover:border-foreground/40 ${
                      selectedSong?.track_id === song.track_id ? "border-foreground" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-semibold">{song.title ?? song.track_id}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {song.artist ?? "Unknown artist"}
                        {song.tempo_bpm ? ` · ${song.tempo_bpm} BPM` : ""}
                        {song.duration_seconds ? ` · ${fmtDuration(song.duration_seconds)}` : ""}
                      </p>
                    </div>
                    <ChevronLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                  </Card>
                </button>
              ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function AnalyzeTab() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("pick-instrument");
  const [picked, setPicked] = useState<ChallengeKey | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackInfo | null>(null);
  const [selectedSong, setSelectedSong] = useState<SongInfo | null>(null);
  const [recording, setRecording] = useState(false);
  const [wavBlob, setWavBlob] = useState<Blob | null>(null);
  const [wavUrl, setWavUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const wavUrlRef = useRef<string | null>(null);

  const { uploadRecording, progress, uploading } = useUploadRecording();

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

  function reset() {
    setPicked(null);
    setSelectedTrack(null);
    setSelectedSong(null);
    setStep("pick-instrument");
    if (wavUrlRef.current) { URL.revokeObjectURL(wavUrlRef.current); wavUrlRef.current = null; }
    setWavBlob(null);
    setWavUrl(null);
    setRecording(false);
    setSeconds(0);
    setMicError(null);
    setName("");
  }

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
        challenge: selectedTrack
          ? `${selectedTrack.progression} — ${selectedTrack.key} (${selectedTrack.style}, ${selectedTrack.tempo} BPM)`
          : selectedSong
          ? `${selectedSong.title} — ${selectedSong.artist}`
          : c.instrument,
        name: name.trim() || `${c.instrument} take`,
        referenceId: selectedTrack?.track_id ?? selectedSong?.track_id,
      });
      void navigate({ to: "/app/analyze/result", search: { reportId } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    }
  }

  // ── Pick instrument ──────────────────────────────────────────────────────────
  if (step === "pick-instrument") {
    return (
      <AppShell>
        <header className="px-5 pt-8 pb-2">
          <h1 className="text-2xl font-bold tracking-tight">What did you play?</h1>
          <p className="mt-1 text-sm text-muted-foreground">Choose your instrument to get started.</p>
        </header>
        <div className="grid grid-cols-2 gap-3 px-5 pt-4">
          {(Object.keys(challenges) as ChallengeKey[]).map((k) => {
            const c = challenges[k];
            return (
              <button
                key={k}
                onClick={() => { setPicked(k); setStep("record"); }}
                className="text-left"
              >
                <Card className="flex h-44 flex-col justify-between p-4 transition-colors hover:border-foreground/40">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-hairline">
                    <InstrumentIcon instrument={c.instrument} className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold">{c.instrument}</p>
                </Card>
              </button>
            );
          })}
        </div>
      </AppShell>
    );
  }

  // ── Record + MIDI + Name ─────────────────────────────────────────────────────
  if (step === "record" && picked) {
    const c = challenges[picked];
    const isGuitar = c.instrument === "Guitar";

    return (
      <AppShell>
        <header className="flex items-center gap-3 px-5 pt-8 pb-2">
          <button onClick={reset} className="text-muted-foreground">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-hairline">
              <InstrumentIcon instrument={c.instrument} className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">{c.instrument}</h1>
          </div>
        </header>

        <div className="px-5 pt-6 pb-10 space-y-8">
          {/* Recording controls */}
          <div className="flex flex-col items-center">
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
              aria-label={recording ? "Stop" : "Record"}
              className="relative mt-8 flex h-24 w-24 items-center justify-center rounded-full bg-foreground text-background shadow-elevated transition-transform active:scale-95"
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
              <div className="mt-6 w-full space-y-2">
                <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">Listen back</p>
                <audio src={wavUrl} controls className="w-full rounded-lg" />
                <button
                  onClick={toggle}
                  className="w-full text-center text-xs text-muted-foreground underline underline-offset-4"
                >
                  Re-record
                </button>
              </div>
            )}
          </div>

          {/* Name input */}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Name</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${c.instrument} take…`}
              maxLength={60}
              className="w-full rounded-lg border border-hairline bg-transparent px-4 py-3 text-sm font-semibold placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/30"
            />
          </div>

          {/* Inline MIDI section */}
          <MidiSection
            isGuitar={isGuitar}
            selectedTrack={selectedTrack}
            selectedSong={selectedSong}
            onPickTrack={(t) => { setSelectedTrack(t); setSelectedSong(null); }}
            onPickSong={(s) => { setSelectedSong(s); setSelectedTrack(null); }}
            onClear={() => { setSelectedTrack(null); setSelectedSong(null); }}
          />

          {/* Submit */}
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
              disabled={!wavBlob || recording}
            >
              Submit recording
            </Pill>
          )}
        </div>
      </AppShell>
    );
  }

  return null;
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
