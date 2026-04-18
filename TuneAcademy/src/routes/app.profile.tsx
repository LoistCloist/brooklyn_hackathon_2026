import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/tuneacademy/AppShell";
import { Avatar } from "@/components/tuneacademy/Avatar";
import { Pill } from "@/components/tuneacademy/Pill";
import { useAuth } from "@/contexts/AuthContext";
import { brandTheme } from "@/lib/theme";
import { getFirestoreDb } from "@/lib/firebase";
import { useFirestoreUserDoc } from "@/hooks/useFirestoreUserDoc";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Flame, Music, Star, Clock,
  Users, BookOpen, MapPin, DollarSign, Edit3,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "Profile — TuneAcademy" }] }),
  component: ProfileTab,
});

function initialsFromName(
  name: string | undefined,
  email: string | undefined,
): string {
  const n = name?.trim();
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (
      `${parts[0][0] ?? ""}${parts[parts.length - 1]?.[0] ?? ""}`.toUpperCase() || "TA"
    );
  }
  const local = email?.split("@")[0]?.trim();
  if (local && local.length >= 2) return local.slice(0, 2).toUpperCase();
  if (local?.[0]) return local[0].toUpperCase();
  return "TA";
}

type ReportRow = {
  instrument?: string;
  overallScore?: number;
  weaknesses?: string[];
};

function ProfileTab() {
  const { user, userDoc } = useAuth();
  const { user: liveDoc } = useFirestoreUserDoc(user?.uid ?? null);
  const profile = liveDoc ?? userDoc;
  const isInstructor = profile?.role === "instructor";
  const initials = initialsFromName(profile?.fullName, profile?.email);

  const [report, setReport] = useState<ReportRow | null>(null);
  const [reelCount, setReelCount] = useState(0);
  const [instruments, setInstruments] = useState<string[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    const db = getFirestoreDb();

    const repQ = query(
      collection(db, "reports"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(1),
    );
    getDocs(repQ)
      .then((snap) => {
        if (!snap.empty) setReport(snap.docs[0].data() as ReportRow);
      })
      .catch(() => {});

    const reelQ = query(
      collection(db, "reels"),
      where("uploaderId", "==", user.uid),
    );
    getDocs(reelQ)
      .then((snap) => {
        setReelCount(snap.size);
        const instSet = new Set<string>();
        snap.docs.forEach((d) => {
          const inst = d.data().instrument as string | undefined;
          if (inst) instSet.add(inst);
        });
        setInstruments([...instSet]);
      })
      .catch(() => {});
  }, [user?.uid]);

  const studentStats = [
    {
      label: "Sessions",
      value: "12",
      icon: <BookOpen className="h-4 w-4" />,
      color: "text-[#ffd666]",
    },
    {
      label: "Hours learned",
      value: "24",
      icon: <Clock className="h-4 w-4" />,
      color: "text-[#a6eee3]",
    },
    {
      label: "Tutors had",
      value: "3",
      icon: <Users className="h-4 w-4" />,
      color: "text-[#ffd666]",
    },
    {
      label: "Day streak",
      value: "6",
      icon: <Flame className="h-4 w-4" />,
      color: "text-[#ff6b6b]",
    },
  ];

  return (
    <AppShell>
      <header className="pt-8">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.22em] ${brandTheme.teal}`}>
              TuneAcademy
            </p>
            <h1 className="mt-2 text-4xl font-black text-[#fffdf5]">
              My Profile
            </h1>
          </div>
          <button
            type="button"
            onClick={() => toast.info("Edit profile coming soon.")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[#fffdf5]/15 bg-[#fffdf5]/8 text-[#fffdf5]/70 transition hover:bg-[#fffdf5]/14"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mt-8 space-y-5 pb-28">

        <motion.section
          className="rounded-xl border border-[#fffdf5]/20 bg-[#fffdf5]/8 p-6 backdrop-blur"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-center gap-5">
            <div className="relative">
              {profile?.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-[#ffd666]/50"
                />
              ) : (
                <Avatar initials={initials} size={80} />
              )}
              {isInstructor && (
                <span className="absolute -bottom-1 -right-1 rounded-full bg-[#ffd666] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[#11140c]">
                  Tutor
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-black text-[#fffdf5]">
                {profile?.fullName || "Your Name"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-[#e8f4df]/60">
                {profile?.email || ""}
              </p>
              {isInstructor && profile?.nationality && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-[#e8f4df]/55">
                  <MapPin className="h-3 w-3" />
                  {profile.nationality}
                </div>
              )}
            </div>
          </div>
          {isInstructor && profile?.bio && (
            <p className="mt-4 border-t border-[#fffdf5]/10 pt-4 text-sm leading-6 text-[#e8f4df]/75">
              {profile.bio}
            </p>
          )}
        </motion.section>

        {!isInstructor && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className={`mb-3 text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>
              Your progress
            </p>
            <div className="grid grid-cols-2 gap-3">
              {studentStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-4"
                >
                  <div className={`mb-2 ${stat.color}`}>{stat.icon}</div>
                  <p className="text-3xl font-black text-[#fffdf5]">{stat.value}</p>
                  <p className="mt-1 text-xs font-semibold text-[#e8f4df]/55">{stat.label}</p>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {isInstructor && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl border border-[#fffdf5]/20 bg-[#fffdf5]/8 p-6"
          >
            <p className={`mb-4 text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>
              Teaching details
            </p>
            <div className="grid grid-cols-2 gap-3">
              {profile?.experienceYears != null && (
                <div className="rounded-lg border border-[#fffdf5]/10 bg-[#fffdf5]/5 p-3">
                  <p className="text-2xl font-black text-[#fffdf5]">{profile.experienceYears}</p>
                  <p className="mt-0.5 text-xs text-[#e8f4df]/55">yrs experience</p>
                </div>
              )}
              {profile?.hourlyRate != null && (
                <div className="rounded-lg border border-[#fffdf5]/10 bg-[#fffdf5]/5 p-3">
                  <div className="flex items-baseline gap-0.5">
                    <DollarSign className="h-3 w-3 self-center text-[#ffd666]" />
                    <p className="text-2xl font-black text-[#fffdf5]">
                      {profile.hourlyRate === 0 ? "Free" : profile.hourlyRate}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs text-[#e8f4df]/55">hourly rate</p>
                </div>
              )}
            </div>
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl border border-[#ffd666]/30 bg-[#ffd666]/8 p-6"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className={`text-xs font-black uppercase tracking-[0.18em] ${brandTheme.gold}`}>
                Profile rating
              </p>
              <h3 className="mt-1 text-lg font-black text-[#fffdf5]">AI Skills Analysis</h3>
            </div>
            <Star className="h-5 w-5 text-[#ffd666]" />
          </div>
          {report ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black text-[#ffd666]">{report.overallScore ?? "—"}</span>
                <span className="text-lg font-bold text-[#e8f4df]/55">/100</span>
              </div>
              <p className="text-xs font-semibold capitalize text-[#e8f4df]/60">
                Instrument: {report.instrument ?? "—"}
              </p>
              {(report.weaknesses ?? []).length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-bold uppercase tracking-widest text-[#e8f4df]/45">
                    Focus areas
                  </p>
                  {(report.weaknesses ?? []).slice(0, 3).map((w, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 rounded-lg bg-[#fffdf5]/6 px-3 py-2 text-sm text-[#e8f4df]/75"
                    >
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffd666]" />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-sm text-[#e8f4df]/55">No analysis yet.</p>
              <Link to="/app/analyze">
                <Pill className={`mt-4 ${brandTheme.primaryButton}`} size="sm">
                  Record your first take
                </Pill>
              </Link>
            </div>
          )}
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6"
        >
          <div className="mb-4 flex items-center gap-2">
            <Music className="h-4 w-4 text-[#a6eee3]" />
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#a6eee3]">
              {isInstructor ? "Specialties" : "Instruments played"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isInstructor ? (
              (profile?.specialties as string[] | undefined)?.length ? (
                (profile.specialties as string[]).map((s) => (
                  <span
                    key={s}
                    className="rounded-full border border-[#a6eee3]/30 bg-[#a6eee3]/10 px-3 py-1 text-xs font-bold capitalize text-[#a6eee3]"
                  >
                    {s}
                  </span>
                ))
              ) : (
                <p className="text-sm text-[#e8f4df]/55">No specialties listed.</p>
              )
            ) : instruments.length ? (
              instruments.map((inst) => (
                <span
                  key={inst}
                  className="rounded-full border border-[#a6eee3]/30 bg-[#a6eee3]/10 px-3 py-1 text-xs font-bold capitalize text-[#a6eee3]"
                >
                  {inst}
                </span>
              ))
            ) : (
              <p className="text-sm text-[#e8f4df]/55">Post a reel to show your instruments.</p>
            )}
          </div>
        </motion.section>

        {reelCount > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-[#fffdf5]/15 bg-[#fffdf5]/8 p-6"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#e8f4df]/55">
                  Your reels
                </p>
                <p className="mt-2 text-4xl font-black text-[#fffdf5]">{reelCount}</p>
              </div>
              <Link
                to="/app/musireels"
                className="rounded-lg border border-[#fffdf5]/15 bg-[#fffdf5]/8 px-4 py-2 text-xs font-bold text-[#fffdf5] transition hover:bg-[#fffdf5]/14"
              >
                View all →
              </Link>
            </div>
          </motion.section>
        )}

      </main>
    </AppShell>
  );
}