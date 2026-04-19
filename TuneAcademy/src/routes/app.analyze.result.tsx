import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Card } from "@/components/tuneacademy/Card";
import { Pill } from "@/components/tuneacademy/Pill";
import { ScoreBar } from "@/components/tuneacademy/ScoreBar";
import { dimensionLabels } from "@/lib/mockData";
import { ArrowLeft, ArrowRight, Mic, Loader2, Send } from "lucide-react";
import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase";

const AGENT_ID = "agent_4301kpj8w620ectvz76fns3ckyj3";

type ChatMessage = { role: "user" | "agent"; text: string };

function useTextChat(agentId: string, reportSummary: string) {
   const [messages, setMessages] = useState<ChatMessage[]>([]);
   const [connected, setConnected] = useState(false);
   const [connecting, setConnecting] = useState(false);
   const wsRef = useRef<WebSocket | null>(null);
   const initSentRef = useRef(false);

   const sendRaw = useCallback((text: string) => {
      wsRef.current?.send(JSON.stringify({ type: "user_transcript", user_transcript: text }));
   }, []);

   const connect = useCallback(() => {
      if (wsRef.current) return;
      setConnecting(true);
      const ws = new WebSocket(`wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${agentId}`);
      wsRef.current = ws;

      ws.onopen = () => {
         setConnected(true);
         setConnecting(false);
      };

      ws.onmessage = (ev) => {
         try {
            const msg = JSON.parse(ev.data as string);
            console.log("[TuneCoach] ws message:", msg.type, JSON.stringify(msg).slice(0, 200));
            if (msg.type === "conversation_initiation_metadata" && !initSentRef.current) {
               initSentRef.current = true;
               const initPayload = {
                  type: "conversation_initiation_client_data",
                  conversation_config_override: {
                     agent: {
                        first_message: `Here is your performance analysis: ${reportSummary}. Give direct, specific feedback on these results — no greeting, just actionable coaching.`,
                     },
                  },
                  dynamic_variables: { report_summary: reportSummary },
               };
               console.log("[TuneCoach] sending init:", JSON.stringify(initPayload));
               ws.send(JSON.stringify(initPayload));
            }
            if (msg.type === "agent_response") {
               const text: string = msg.agent_response_event?.agent_response ?? msg.agent_response ?? "";
               console.log("[TuneCoach] agent_response text:", text);
               if (text) setMessages((prev) => [...prev, { role: "agent", text }]);
            }
         } catch { /* ignore parse errors */ }
      };

      ws.onclose = () => {
         setConnected(false);
         setConnecting(false);
         wsRef.current = null;
         initSentRef.current = false;
      };

      ws.onerror = () => setConnecting(false);
   }, [agentId, reportSummary]);

   const send = useCallback((text: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
         sendRaw(text);
         setMessages((prev) => [...prev, { role: "user", text }]);
      }
   }, [sendRaw]);

   const disconnect = useCallback(() => wsRef.current?.close(), []);

   useEffect(() => () => { wsRef.current?.close(); }, []);

   return { messages, connected, connecting, connect, send, disconnect };
}

export const Route = createFileRoute("/app/analyze/result")({
   validateSearch: z.object({ reportId: z.string().optional() }),
   head: () => ({ meta: [{ title: "Your analysis – TuneAcademy" }] }),
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

type ReportData = {
   instrument: string;
   overallScore: number;
   dimensionScores: Record<string, number>;
   weaknesses: string[];
   status: string;
};

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
               instrument: d.instrument ?? "Unknown",
               overallScore: d.overallScore ?? 0,
               dimensionScores: d.dimensionScores ?? {},
               weaknesses: d.weaknesses ?? [],
               status: d.status,
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
               <p className="text-sm text-muted-foreground">Analyzing your recording…</p>
            </div>
         </AppShell>
      );
   }

   if (!report || report.status === "error") {
      return (
         <AppShell>
            <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 px-8 text-center">
               <p className="text-lg font-semibold">Analysis unavailable</p>
               <p className="text-sm text-muted-foreground">Something went wrong. Try recording again.</p>
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
            <p className="mt-2 text-[96px] font-extrabold leading-none tracking-tighter tabular-nums">{score}</p>
            <p className="mt-1 text-xs text-muted-foreground">/ 100 · {report.instrument}</p>
         </motion.div>

         <section className="px-5 pt-8">
            <h2 className="mb-3 text-sm font-semibold tracking-tight">By dimension</h2>
            <Card className="space-y-4 p-5">
               {dimensionLabels.map((d) => (
                  <ScoreBar key={d.key} label={d.label} value={report.dimensionScores[d.key] ?? 0} animate />
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

function buildReportSummary(report: ReportData): string {
   const dims = Object.entries(report.dimensionScores)
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
      .join(", ");
   const weak = report.weaknesses.length ? report.weaknesses.join("; ") : "none";
   return `Instrument: ${report.instrument} | Overall: ${report.overallScore}/100 | Dimensions: ${dims} | Weaknesses: ${weak}`;
}

function TuneCoachCard({ report }: { report: ReportData }) {
   const [input, setInput] = useState("");
   const [listening, setListening] = useState(false);
   const messagesEndRef = useRef<HTMLDivElement>(null);
   const recognitionRef = useRef<{ stop: () => void } | null>(null);
   const reportSummary = buildReportSummary(report);

   const chat = useTextChat(AGENT_ID, reportSummary);

   // Auto-connect on mount
   useEffect(() => { chat.connect(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

   // Scroll to latest message
   useEffect(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
   }, [chat.messages]);

   const handleSend = () => {
      const text = input.trim();
      if (!text || !chat.connected) return;
      chat.send(text);
      setInput("");
   };

   const handleVoiceInput = () => {
      type SRConstructor = new () => {
         continuous: boolean;
         interimResults: boolean;
         lang: string;
         onstart: (() => void) | null;
         onend: (() => void) | null;
         onresult: ((e: { results: { [i: number]: { [i: number]: { transcript: string } } } }) => void) | null;
         start: () => void;
         stop: () => void;
      };
      const w = window as unknown as { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor };
      const SR: SRConstructor | undefined = w.SpeechRecognition ?? w.webkitSpeechRecognition;
      if (!SR) return;

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
         const transcript = e.results[0][0].transcript;
         if (transcript.trim() && chat.connected) {
            chat.send(transcript.trim());
         }
      };
      rec.start();
   };

   return (
      <Card className="p-5">
         <p className="mb-3 text-sm font-semibold">TuneCoach</p>

         {/* Message list */}
         <div className="flex h-56 flex-col gap-2 overflow-y-auto pr-1">
            {chat.connecting && (
               <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
               </div>
            )}
            {chat.messages.map((m, i) => (
               <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
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

         {/* Input row */}
         <div className="mt-3 flex gap-2">
            <input
               value={input}
               onChange={(e) => setInput(e.target.value)}
               onKeyDown={(e) => e.key === "Enter" && handleSend()}
               placeholder="Ask your coach…"
               disabled={!chat.connected}
               className="flex-1 rounded-full border border-hairline bg-transparent px-4 py-2 text-xs outline-none placeholder:text-muted-foreground disabled:opacity-40"
            />
            <button
               onClick={handleVoiceInput}
               disabled={!chat.connected}
               className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-40 ${
                  listening ? "bg-red-500 text-white" : "border border-hairline text-foreground"
               }`}
            >
               <Mic className="h-4 w-4" />
            </button>
            <button
               onClick={handleSend}
               disabled={!chat.connected || !input.trim()}
               className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
            >
               <Send className="h-4 w-4" />
            </button>
         </div>
      </Card>
   );
}
