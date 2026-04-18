import { createFileRoute } from "@tanstack/react-router";
import { reels } from "@/lib/mockData";
import { Heart, MessageCircle, Play } from "lucide-react";
import { useState } from "react";
import { InstrumentIcon } from "@/components/tuneacademy/InstrumentIcon";

export const Route = createFileRoute("/app/musireels")({
  head: () => ({ meta: [{ title: "Musireels — TuneAcademy" }] }),
  component: Musireels,
});

function Musireels() {
  return (
    <div className="mx-auto h-screen w-full max-w-md overflow-hidden bg-black">
      <div className="h-screen w-full snap-y snap-mandatory overflow-y-scroll pb-16">
        {reels.map((r) => (
          <ReelCard key={r.id} reel={(r as unknown) as Parameters<typeof ReelCard>[0]["reel"]} />
        ))}
      </div>
    </div>
  );
}

function ReelCard({ reel }: { reel: (typeof reels)[number] }) {
  const [playing, setPlaying] = useState(false);
  const [liked, setLiked] = useState(false);

  return (
    <div
      onClick={() => setPlaying((p) => !p)}
      className="relative flex h-screen w-full snap-start items-center justify-center overflow-hidden bg-black"
    >
      {/* Placeholder: monochrome gradient + giant note */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 30%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%), linear-gradient(180deg, #0a0a0a 0%, #000 100%)",
        }}
      />
      <InstrumentIcon
        instrument={reel.instrument}
        className="relative h-32 w-32 text-foreground/20"
      />

      {!playing && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-foreground/10 backdrop-blur-md">
            <Play className="h-8 w-8 text-foreground" />
          </div>
        </div>
      )}

      {/* Bottom-left: meta */}
      <div className="absolute bottom-24 left-5 right-20 text-foreground">
        <p className="text-base font-semibold tracking-tight">{reel.username}</p>
        <span className="mt-2 inline-block rounded-full border border-foreground/40 px-2.5 py-0.5 text-[10px] uppercase tracking-widest">
          {reel.instrument}
        </span>
        <p className="mt-3 max-w-[16rem] text-sm text-foreground/85">{reel.caption}</p>
      </div>

      {/* Bottom-right: actions */}
      <div className="absolute bottom-24 right-4 flex flex-col items-center gap-5 text-foreground">
        <button
          onClick={(e) => {
            e.stopPropagation();
            setLiked((v) => !v);
          }}
          className="flex flex-col items-center gap-1"
          aria-label="Like"
        >
          <Heart className={"h-7 w-7 " + (liked ? "fill-foreground" : "")} />
          <span className="text-[10px] tabular-nums">{(reel.likes + (liked ? 1 : 0)).toLocaleString()}</span>
        </button>
        <button className="flex flex-col items-center gap-1" aria-label="Comments">
          <MessageCircle className="h-7 w-7" />
          <span className="text-[10px] tabular-nums">{reel.comments}</span>
        </button>
      </div>
    </div>
  );
}
