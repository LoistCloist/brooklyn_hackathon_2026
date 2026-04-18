import { Music2, Mic2, Piano, Guitar, Drum } from "lucide-react";
import type { Instrument } from "@/lib/mockData";

export function InstrumentIcon({ instrument, className }: { instrument: Instrument; className?: string }) {
  const map: Record<Instrument, typeof Music2> = {
    Voice: Mic2,
    Guitar: Guitar,
    Piano: Piano,
    Saxophone: Music2,
    Violin: Music2,
    Drums: Drum,
    Bass: Guitar,
  };
  const I = map[instrument];
  return <I className={className} />;
}
