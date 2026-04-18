import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Heart, Loader2, MessageCircle, Play, UserPlus } from "lucide-react";
import { InstrumentIcon } from "@/components/tuneacademy/InstrumentIcon";
import type { Instrument } from "@/lib/mockData";
import { useLike } from "@/hooks/useLike";
import type { Reel } from "@/types";
import { cn } from "@/lib/utils";

function instrumentLabel(slug: string): string {
  if (!slug) return "";
  return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function reelInstrumentToIcon(slug: string): Instrument {
  const m: Record<string, Instrument> = {
    voice: "Voice",
    guitar: "Guitar",
    piano: "Piano",
    saxophone: "Saxophone",
  };
  return m[slug.toLowerCase()] ?? "Voice";
}

type Props = {
  reel: Reel;
  isActive: boolean;
  currentUserId: string | null;
  showRecruit: boolean;
  recruitDisabled: boolean;
  onRecruit: () => void;
  onOpenComments: () => void;
};

export function ReelVideoCard({
  reel,
  isActive,
  currentUserId,
  showRecruit,
  recruitDisabled,
  onRecruit,
  onOpenComments,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const userPausedRef = useRef(false);
  const { isLiked, likesCount, toggleLike } = useLike(reel, currentUserId);
  const [buffering, setBuffering] = useState(true);
  const [likePulse, setLikePulse] = useState(0);
  const [manualPauseUi, setManualPauseUi] = useState(false);
  /** Unmute only after a tap on the video so autoplay stays allowed while browsing. */
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (!isActive) {
      userPausedRef.current = false;
      setManualPauseUi(false);
      setSoundEnabled(false);
      el.pause();
      return;
    }
    if (!userPausedRef.current) {
      void el.play().catch(() => {
        /* autoplay policies */
      });
      setManualPauseUi(false);
    }
  }, [isActive]);

  const togglePausePlay = () => {
    const el = videoRef.current;
    if (!el || !reel.videoUrl || !isActive) return;
    if (!soundEnabled) {
      setSoundEnabled(true);
      el.muted = false;
      if (el.paused) {
        userPausedRef.current = false;
        void el.play().catch(() => {});
        setManualPauseUi(false);
      }
      return;
    }
    if (el.paused) {
      userPausedRef.current = false;
      void el.play().catch(() => {});
      setManualPauseUi(false);
    } else {
      userPausedRef.current = true;
      el.pause();
      setManualPauseUi(true);
    }
  };

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      {reel.thumbnailUrl ? (
        <img
          src={reel.thumbnailUrl}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
        />
      ) : null}
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover select-none"
        muted={!isActive || !soundEnabled}
        playsInline
        loop
        controls={false}
        tabIndex={isActive ? 0 : -1}
        aria-label={manualPauseUi ? "Play reel" : "Pause reel"}
        onClick={(e) => {
          e.stopPropagation();
          togglePausePlay();
        }}
        onKeyDown={(e) => {
          if (e.key !== " " && e.key !== "Enter") return;
          e.preventDefault();
          e.stopPropagation();
          togglePausePlay();
        }}
        onLoadStart={() => setBuffering(true)}
        onCanPlay={() => setBuffering(false)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
      />

      {buffering && isActive && reel.videoUrl ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        </div>
      ) : null}

      {manualPauseUi && isActive && reel.videoUrl && !buffering ? (
        <div
          className="pointer-events-none absolute inset-0 z-[12] flex items-center justify-center"
          aria-hidden
        >
          <div className="rounded-full bg-black/50 p-5 ring-1 ring-white/20">
            <Play className="h-12 w-12 fill-white text-white drop-shadow-md" aria-hidden />
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />

      <Link
        to="/app/learner/$userId"
        params={{ userId: reel.uploaderId }}
        search={{
          displayName: reel.uploaderName.trim() || undefined,
          avatarUrl: reel.uploaderAvatarUrl.trim() || undefined,
        }}
        className="pointer-events-auto absolute bottom-24 left-5 right-24 z-20 text-left text-foreground"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-white ring-1 ring-white/30">
            {reel.uploaderAvatarUrl ? (
              <img src={reel.uploaderAvatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              (reel.uploaderName.trim()[0] ?? "?").toUpperCase()
            )}
          </div>
          <div className="min-w-0">
            <p className="text-base font-semibold tracking-tight text-white">{reel.uploaderName}</p>
            <span className="mt-2 inline-block rounded-full border border-white/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
              {instrumentLabel(reel.instrument)}
            </span>
            {reel.caption ? (
              <p className="mt-3 max-w-[16rem] text-sm text-white/90">{reel.caption}</p>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="absolute bottom-24 right-4 z-20 flex flex-col items-center gap-5 text-white">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (!isLiked) setLikePulse((n) => n + 1);
            void toggleLike();
          }}
          className="flex flex-col items-center gap-1"
          aria-label="Like"
        >
          <motion.span
            key={likePulse}
            initial={{ scale: 1 }}
            animate={{ scale: likePulse > 0 ? [1, 1.3, 1] : 1 }}
            transition={
              likePulse > 0
                ? { type: "tween", duration: 0.42, ease: [0.22, 1, 0.36, 1] }
                : { duration: 0 }
            }
          >
            <Heart className={cn("h-7 w-7", isLiked && "fill-white text-white")} />
          </motion.span>
          <span className="text-[10px] tabular-nums">{likesCount}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenComments();
          }}
          className="flex flex-col items-center gap-1"
          aria-label="Comments"
        >
          <MessageCircle className="h-7 w-7" />
          <span className="text-[10px] tabular-nums">{reel.commentsCount}</span>
        </button>
        {showRecruit ? (
          <button
            type="button"
            disabled={recruitDisabled}
            onClick={(e) => {
              e.stopPropagation();
              onRecruit();
            }}
            className={cn(
              "flex flex-col items-center gap-1",
              recruitDisabled && "opacity-40",
            )}
            aria-label="Recruit learner"
          >
            <UserPlus className="h-7 w-7" />
            <span className="text-[10px] font-semibold">Recruit</span>
          </button>
        ) : null}
      </div>

      {!reel.videoUrl ? (
        <InstrumentIcon
          instrument={reelInstrumentToIcon(reel.instrument)}
          className="relative z-0 h-32 w-32 text-white/15"
        />
      ) : null}
    </div>
  );
}
