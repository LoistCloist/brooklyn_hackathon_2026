import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { ScoreBar } from "@/components/tuneacademy/ScoreBar";
import { dimensionLabels } from "@/lib/mockData";
import {
  Conversation,
  type Conversation as ElevenLabsConversation,
  type PartialOptions,
} from "@elevenlabs/react";
import { ArrowLeft, ArrowRight, Mic, Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

const DEFAULT_TUNE_COACH_AGENT_ID = "agent_4301kpj8w620ectvz76fns3ckyj3";
const AGENT_ID = import.meta.env.VITE_ELEVENLABS_AGENT_ID?.trim() || DEFAULT_TUNE_COACH_AGENT_ID;

const TUNE_COACH_SYSTEM_PROMPT = `
You are TuneCoach, a concise music coach inside TuneAcademy.

You receive a TuneAcademy analysis report generated from Essentia audio features and, when available, a reference comparison. Use only that report context. Do not invent song details, notes, teacher names, audio events, diagnoses, or scores that are not present.

Report interpretation:
- Scores are 0-100. Lower scores are the highest-priority practice targets.
- dimensionScores include pitch_centre, pitch_stability, rhythm, tone_quality, and note_attack.
- comparison.note_accuracy measures how closely the learner matched reference pitches.
- comparison.timing_accuracy measures timing alignment against the reference.
- comparison.missed_notes and comparison.extra_notes are counts from the reference comparison.
- weaknesses are backend-generated plain-English findings and should be treated as important evidence.

Coaching rules:
1. Start with the single biggest priority from the numbers.
2. Explain what the metric means in learner-friendly language.
3. Give 2 or 3 concrete practice steps the learner can try right now.
4. Tie advice back to the instrument when possible.
5. Keep responses under 120 words unless the learner asks for detail.
6. If the learner asks about something outside the report, answer briefly and bring the focus back to practice.
`.trim();

const INITIAL_COACH_REQUEST =
  "Give the learner an initial TuneCoach response from the report context. Include the top issue, why it matters, and two specific practice steps.";

type ChatMessage = { role: "user" | "agent"; text: string };

function useTextChat(agentId: string, reportSummary: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationRef = useRef<ElevenLabsConversation | null>(null);
  const connectPromiseRef = useRef<Promise<ElevenLabsConversation | null> | null>(null);
  const reportSummaryRef = useRef(reportSummary);
  const ignoredUserEchoesRef = useRef<string[]>([]);
  const hiddenUserPromptsRef = useRef<string[]>([]);
  const initialCoachRequestedRef = useRef(false);
  const intentionalDisconnectRef = useRef(false);

  useEffect(() => {
    reportSummaryRef.current = reportSummary;
    initialCoachRequestedRef.current = false;
    ignoredUserEchoesRef.current = [];
    hiddenUserPromptsRef.current = [];
    setMessages([]);
    setError(null);
  }, [reportSummary]);

  const appendMessage = useCallback((role: ChatMessage["role"], text: string) => {
    const clean = text.trim();
    if (!clean) return;

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === role && last.text === clean) return prev;
      return [...prev, { role, text: clean }];
    });
  }, []);

  const handleIncomingMessage = useCallback(
    (message: { role?: string; source?: string; message?: string }) => {
      const text = message.message?.trim();
      if (!text) return;

      const role: ChatMessage["role"] =
        message.role === "user" || message.source === "user" ? "user" : "agent";

      if (role === "user") {
        const hiddenIndex = hiddenUserPromptsRef.current.indexOf(text);
        if (hiddenIndex >= 0) {
          hiddenUserPromptsRef.current.splice(hiddenIndex, 1);
          return;
        }

        const echoIndex = ignoredUserEchoesRef.current.indexOf(text);
        if (echoIndex >= 0) {
          ignoredUserEchoesRef.current.splice(echoIndex, 1);
          return;
        }
      }

      appendMessage(role, text);
    },
    [appendMessage],
  );

  const buildSessionOptions = useCallback(
    (): PartialOptions => ({
      agentId,
      connectionType: "websocket",
      textOnly: true,
      dynamicVariables: {
        report_summary: reportSummaryRef.current,
        tune_coach_instructions: TUNE_COACH_SYSTEM_PROMPT,
      },
      overrides: {
        conversation: {
          textOnly: true,
        },
      },
      onConnect: () => {
        setConnected(true);
        setConnecting(false);
        setError(null);
      },
      onDisconnect: (details) => {
        setConnected(false);
        setConnecting(false);
        conversationRef.current = null;
        connectPromiseRef.current = null;

        if (!intentionalDisconnectRef.current && details.reason === "error") {
          setError(details.message || "TuneCoach disconnected before it could answer.");
        }
        intentionalDisconnectRef.current = false;
      },
      onError: (message) => {
        setError(message || "TuneCoach could not complete the request.");
      },
      onMessage: handleIncomingMessage,
    }),
    [agentId, handleIncomingMessage],
  );

  const connect = useCallback(async () => {
    if (!agentId) {
      setError("TuneCoach agent is not configured.");
      return null;
    }

    if (conversationRef.current?.isOpen()) return conversationRef.current;
    if (connectPromiseRef.current) return connectPromiseRef.current;

    setConnecting(true);
    setError(null);

    const promise = (async () => {
      try {
        const conversation = await Conversation.startSession(buildSessionOptions());
        conversationRef.current = conversation;
        conversation.sendContextualUpdate(
          `TuneAcademy report context:\n${reportSummaryRef.current}\n\nTuneCoach instructions:\n${TUNE_COACH_SYSTEM_PROMPT}`,
        );

        if (!initialCoachRequestedRef.current) {
          initialCoachRequestedRef.current = true;
          hiddenUserPromptsRef.current.push(INITIAL_COACH_REQUEST);
          conversation.sendUserMessage(INITIAL_COACH_REQUEST);
        }

        return conversation;
      } catch (connectionError) {
        const message =
          connectionError instanceof Error
            ? connectionError.message
            : "TuneCoach could not connect.";
        setConnected(false);
        setConnecting(false);
        setError(message);
        return null;
      }
    })();

    connectPromiseRef.current = promise;
    const conversation = await promise;
    connectPromiseRef.current = null;
    setConnecting(false);
    return conversation;
  }, [agentId, buildSessionOptions]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean) return false;

      const conversation = conversationRef.current?.isOpen()
        ? conversationRef.current
        : await connect();
      if (!conversation?.isOpen()) {
        setError("TuneCoach is offline. Try sending again in a moment.");
        return false;
      }

      ignoredUserEchoesRef.current.push(clean);
      appendMessage("user", clean);
      conversation.sendUserMessage(clean);
      return true;
    },
    [appendMessage, connect],
  );

  const disconnect = useCallback(() => {
    intentionalDisconnectRef.current = true;
    void conversationRef.current?.endSession().catch(() => null);
    conversationRef.current = null;
    connectPromiseRef.current = null;
    setConnected(false);
    setConnecting(false);
  }, []);

  useEffect(() => disconnect, [disconnect]);

  return { messages, connected, connecting, error, connect, send, disconnect };
}

export const Route = createFileRoute("/app/analyze/result")({
  validateSearch: z.object({ reportId: z.string().optional() }),
  head: () => ({ meta: [{ title: "Your analysis - TuneAcademy" }] }),
  component: ResultPage,
});

function useCount(target: number, durationMs = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return n;
}

type ReportComparison = {
  reference_id?: string;
  note_accuracy?: number;
  timing_accuracy?: number;
  missed_notes?: number;
  extra_notes?: number;
  total_reference_notes?: number;
  [key: string]: unknown;
};

type ReportData = {
  instrument: string;
  overallScore: number;
  dimensionScores: Record<string, number>;
  weaknesses: string[];
  status: string;
  comparison?: ReportComparison;
  comparisonError?: string;
};

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizeScores(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(toRecord(value)).map(([key, score]) => [key, toNumber(score)]),
  );
}

function normalizeWeaknesses(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function normalizeComparison(value: unknown): ReportComparison | undefined {
  const record = toRecord(value);
  return Object.keys(record).length ? (record as ReportComparison) : undefined;
}

function ResultPage() {
  const nav = useNavigate();
  const { reportId } = Route.useSearch();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!reportId) {
      setLoading(false);
      return;
    }
    const db = getFirestoreDb();
    const unsub = onSnapshot(doc(db, "reports", reportId), (snap) => {
      if (!snap.exists()) return;
      const d = snap.data();
      if (d.status === "done" || d.status === "error") {
        setReport({
          instrument: typeof d.instrument === "string" ? d.instrument : "Unknown",
          overallScore: toNumber(d.overallScore ?? d.overall_score),
          dimensionScores: normalizeScores(d.dimensionScores ?? d.dimension_scores),
          weaknesses: normalizeWeaknesses(d.weaknesses),
          status: typeof d.status === "string" ? d.status : "done",
          comparison: normalizeComparison(d.comparison),
          comparisonError: typeof d.comparison_error === "string" ? d.comparison_error : undefined,
        });
        setLoading(false);
      }
    });
    return unsub;
  }, [reportId]);

  const score = useCount(report?.overallScore ?? 0);

  if (loading) {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Analyzing your recording...</p>
        </div>
      </AppShell>
    );
  }

  if (!report || report.status === "error") {
    return (
      <AppShell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-lg font-semibold">Analysis unavailable</p>
          <p className="text-sm text-muted-foreground">
            Something went wrong. Try recording again.
          </p>
          <Pill size="lg" onClick={() => nav({ to: "/app/analyze" })}>
            Try again
          </Pill>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <header className="flex items-center justify-between px-5 pt-6">
        <button
          onClick={() => nav({ to: "/app/analyze" })}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-hairline"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Analysis</p>
        <div className="w-10" />
      </header>

      <motion.div
        className="px-5 pt-6 text-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Overall score</p>
        <p className="mt-2 text-[96px] font-extrabold leading-none tracking-tighter tabular-nums">
          {score}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">/ 100 - {report.instrument}</p>
      </motion.div>

      <section className="px-5 pt-8">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">By dimension</h2>
        <Card className="space-y-4 p-5">
          {dimensionLabels.map((d) => (
            <ScoreBar
              key={d.key}
              label={d.label}
              value={report.dimensionScores[d.key] ?? 0}
              animate
            />
          ))}
        </Card>
      </section>

      {report.weaknesses.length > 0 && (
        <section className="px-5 pt-6">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Weaknesses</h2>
          <Card className="p-5">
            <ul className="space-y-2.5 text-sm">
              {report.weaknesses.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-foreground" />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <div className="px-5 pt-6">
        <TuneCoachCard report={report} />
      </div>

      <div className="px-5 pt-4 pb-10">
        <Link to="/app/instructors">
          <Pill size="lg" className="w-full">
            See suggested instructors
            <ArrowRight className="h-4 w-4" />
          </Pill>
        </Link>
      </div>
    </AppShell>
  );
}

function formatMetricName(metric: string): string {
  return metric.replace(/_/g, " ");
}

function buildReportSummary(report: ReportData): string {
  const dims = Object.entries(report.dimensionScores)
    .map(([key, value]) => `${formatMetricName(key)}: ${value}/100`)
    .join(", ");
  const weak = report.weaknesses.length ? report.weaknesses.join("; ") : "none";
  const comparison = report.comparison
    ? Object.entries(report.comparison)
        .filter(([, value]) => value !== undefined && value !== null)
        .map(([key, value]) => `${formatMetricName(key)}: ${String(value)}`)
        .join(", ")
    : "not available";

  return [
    `Instrument: ${report.instrument}`,
    `Overall score: ${report.overallScore}/100`,
    `Dimension scores: ${dims || "not available"}`,
    `Weaknesses: ${weak}`,
    `Essentia reference comparison: ${comparison}`,
    report.comparisonError ? `Comparison note: ${report.comparisonError}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function TuneCoachCard({ report }: { report: ReportData }) {
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const reportSummary = buildReportSummary(report);

  const { messages, connected, connecting, error, connect, send } = useTextChat(
    AGENT_ID,
    reportSummary,
  );

  useEffect(() => {
    void connect();
  }, [connect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || connecting) return;

    setInput("");
    const sent = await send(text);
    if (!sent) setInput(text);
  };

  const handleVoiceInput = () => {
    type SRConstructor = new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onresult:
        | ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void)
        | null;
      start: () => void;
      stop: () => void;
    };
    const w = window as unknown as {
      SpeechRecognition?: SRConstructor;
      webkitSpeechRecognition?: SRConstructor;
    };
    const SR: SRConstructor | undefined = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR || connecting) return;

    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const rec = new SR();
    recognitionRef.current = rec;
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript.trim();
      if (transcript) {
        setInput("");
        void send(transcript);
      }
    };
    rec.start();
  };

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">TuneCoach</p>
        <span className="rounded-full border border-hairline px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {connected ? "Live" : connecting ? "Connecting" : "Offline"}
        </span>
      </div>

      <div className="flex h-56 flex-col gap-2 overflow-y-auto pr-1">
        {connecting && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-hairline px-3 py-2 text-xs text-muted-foreground">
            {error}
          </div>
        )}
        {!connecting && !error && messages.length === 0 && (
          <p className="py-6 text-center text-xs text-muted-foreground">
            Preparing feedback from your report...
          </p>
        )}
        {messages.map((m, i) => (
          <div
            key={`${m.role}-${i}`}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <span
              className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                m.role === "user" ? "bg-foreground text-background" : "bg-muted text-foreground"
              }`}
            >
              {m.text}
            </span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void handleSend();
            }
          }}
          placeholder={connecting ? "Connecting to TuneCoach..." : "Ask your coach..."}
          className="flex-1 rounded-full border border-hairline bg-transparent px-4 py-2 text-xs outline-none placeholder:text-muted-foreground"
        />
        <button
          onClick={handleVoiceInput}
          disabled={connecting}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
            listening ? "bg-red-500 text-white" : "border border-hairline text-foreground"
          }`}
        >
          <Mic className="h-4 w-4" />
        </button>
        <button
          onClick={() => void handleSend()}
          disabled={!input.trim() || connecting}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
