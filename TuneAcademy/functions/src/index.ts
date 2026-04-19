import { randomUUID } from "crypto";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Timestamp } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

initializeApp();

const REGION = "us-east1";
const GOOGLE_CALENDAR_SCOPE = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

type GoogleCalendarConnection = {
  accessToken?: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  googleEmail?: string;
  scope?: string;
};

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new HttpsError("failed-precondition", `Missing server environment variable ${name}.`);
  return value;
}

function redirectAppOrigin(): string {
  return process.env.APP_ORIGIN?.trim() || "http://localhost:5173";
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function oauthConfig(): { clientId: string; clientSecret: string; redirectUri: string } {
  return {
    clientId: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
    clientSecret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
    redirectUri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
  };
}

async function readJsonResponse<T>(resp: Response): Promise<T> {
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(text || `HTTP ${resp.status}`);
  }
  return JSON.parse(text) as T;
}

async function refreshGoogleAccessToken(
  uid: string,
  connection: GoogleCalendarConnection,
): Promise<string> {
  if (connection.accessToken && (connection.accessTokenExpiresAt ?? 0) > Date.now() + 60_000) {
    return connection.accessToken;
  }
  if (!connection.refreshToken) {
    throw new HttpsError(
      "failed-precondition",
      "Connect Google Calendar before creating Meet links.",
    );
  }

  const { clientId, clientSecret } = oauthConfig();
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: connection.refreshToken,
    grant_type: "refresh_token",
  });
  const token = await readJsonResponse<{
    access_token: string;
    expires_in?: number;
    scope?: string;
  }>(
    await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    }),
  );

  const expiresAt = Date.now() + (token.expires_in ?? 3600) * 1000;
  await getFirestore()
    .collection("googleCalendarConnections")
    .doc(uid)
    .set(
      {
        accessToken: token.access_token,
        accessTokenExpiresAt: expiresAt,
        scope: token.scope ?? connection.scope ?? "",
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  return token.access_token;
}

function timestampToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const out = value.toDate();
    return out instanceof Date ? out : null;
  }
  return null;
}

function eventMeetUri(event: any): string | null {
  const videoEntry = event?.conferenceData?.entryPoints?.find(
    (entry: any) => entry?.entryPointType === "video",
  );
  return videoEntry?.uri || event?.hangoutLink || null;
}

export const createGoogleCalendarAuthUrl = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in before connecting Google Calendar.");

  const { clientId, redirectUri } = oauthConfig();
  const state = randomUUID();
  await getFirestore()
    .collection("googleCalendarOAuthStates")
    .doc(state)
    .set({ uid, createdAt: FieldValue.serverTimestamp() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` };
});

export const googleCalendarOAuthCallback = onRequest({ region: REGION }, async (req, res) => {
  const appOrigin = redirectAppOrigin();
  try {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    if (!code || !state) {
      res.redirect(`${appOrigin}/app/profile?calendar=error`);
      return;
    }

    const db = getFirestore();
    const stateRef = db.collection("googleCalendarOAuthStates").doc(state);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      res.redirect(`${appOrigin}/app/profile?calendar=expired`);
      return;
    }
    const uid = String(stateSnap.data()?.uid ?? "");
    if (!uid) {
      res.redirect(`${appOrigin}/app/profile?calendar=error`);
      return;
    }

    const { clientId, clientSecret, redirectUri } = oauthConfig();
    const body = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });
    const token = await readJsonResponse<{
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    }>(
      await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      }),
    );

    const profile = await readJsonResponse<{ email?: string }>(
      await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      }),
    );

    await db
      .collection("googleCalendarConnections")
      .doc(uid)
      .set(
        {
          accessToken: token.access_token,
          ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
          accessTokenExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
          googleEmail: profile.email ?? "",
          scope: token.scope ?? GOOGLE_CALENDAR_SCOPE,
          connectedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    await stateRef.delete();
    res.redirect(`${appOrigin}/app/profile?calendar=connected`);
  } catch (error) {
    console.error("Google Calendar OAuth failed", error);
    res.redirect(`${appOrigin}/app/profile?calendar=error`);
  }
});

export const getGoogleCalendarConnectionStatus = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const snap = await getFirestore().collection("googleCalendarConnections").doc(uid).get();
  const data = snap.data() as GoogleCalendarConnection | undefined;
  return { connected: Boolean(data?.refreshToken), googleEmail: data?.googleEmail ?? "" };
});

export const createGoogleMeetLinksForEngagement = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  const engagementId = String(
    (request.data as { engagementId?: unknown })?.engagementId ?? "",
  ).trim();
  if (!engagementId) throw new HttpsError("invalid-argument", "Missing engagementId.");

  const db = getFirestore();
  const engRef = db.collection("tutoringEngagements").doc(engagementId);
  const engSnap = await engRef.get();
  if (!engSnap.exists) throw new HttpsError("not-found", "Engagement not found.");
  const eng = engSnap.data() as {
    learnerId: string;
    instructorId: string;
    meetings?: { startAt: unknown; endAt: unknown }[];
  };
  if (eng.instructorId !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the instructor can create Meet links for this booking.",
    );
  }

  const connectionSnap = await db.collection("googleCalendarConnections").doc(uid).get();
  const connection = connectionSnap.data() as GoogleCalendarConnection | undefined;
  if (!connection?.refreshToken) {
    throw new HttpsError(
      "failed-precondition",
      "Connect Google Calendar before creating Meet links.",
    );
  }
  const accessToken = await refreshGoogleAccessToken(uid, connection);

  const [instructorSnap, learnerSnap] = await Promise.all([
    db.collection("users").doc(eng.instructorId).get(),
    db.collection("users").doc(eng.learnerId).get(),
  ]);
  const instructor = instructorSnap.data() as { fullName?: string; email?: string } | undefined;
  const learner = learnerSnap.data() as { fullName?: string; email?: string } | undefined;
  const learnerEmail = learner?.email?.trim();

  let created = 0;
  let skipped = 0;
  const meetings = eng.meetings ?? [];

  for (let sessionIndex = 0; sessionIndex < meetings.length; sessionIndex++) {
    const sessionRef = engRef.collection("meetSessions").doc(String(sessionIndex));
    const sessionSnap = await sessionRef.get();
    if (sessionSnap.data()?.googleCalendarEventId) {
      skipped++;
      continue;
    }

    const startAt = timestampToDate(meetings[sessionIndex]?.startAt);
    const endAt = timestampToDate(meetings[sessionIndex]?.endAt);
    if (!startAt || !endAt) {
      skipped++;
      continue;
    }

    const eventBody = {
      summary: `TuneAcademy lesson with ${learner?.fullName?.trim() || "student"}`,
      description:
        "TuneAcademy protected lesson. Join from TuneAcademy so scheduling, payment, and attendance stay together.",
      start: { dateTime: startAt.toISOString() },
      end: { dateTime: endAt.toISOString() },
      attendees: learnerEmail
        ? [{ email: learnerEmail, displayName: learner?.fullName ?? "Student" }]
        : [],
      conferenceData: {
        createRequest: {
          requestId: `ta-${engagementId}-${sessionIndex}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      reminders: { useDefault: true },
    };

    const createdEvent = await readJsonResponse<any>(
      await fetch(
        "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody),
        },
      ),
    );
    const meetingUri = eventMeetUri(createdEvent);
    if (!meetingUri)
      throw new HttpsError("internal", "Google created the event but did not return a Meet link.");

    await sessionRef.set(
      {
        meetLink: meetingUri,
        meetingUri,
        googleCalendarEventId: createdEvent.id ?? "",
        googleCalendarHtmlLink: createdEvent.htmlLink ?? "",
        googleCalendarSyncedAt: FieldValue.serverTimestamp(),
        conferenceProvider: "google_calendar",
        instructorCalendarEmail: connection.googleEmail || instructor?.email || "",
      },
      { merge: true },
    );
    created++;
  }

  return { created, skipped };
});

export const synthesizeTuneCoachSpeech = onCall({ region: REGION }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in before using TuneCoach audio.");

  const text = String((request.data as { text?: unknown })?.text ?? "").trim();
  if (!text) throw new HttpsError("invalid-argument", "Missing text to speak.");
  if (text.length > 1400) {
    throw new HttpsError("invalid-argument", "TuneCoach audio is limited to 1400 characters.");
  }

  const apiKey = requiredEnv("ELEVENLABS_API_KEY");
  const voiceId =
    optionalEnv("ELEVENLABS_TTS_VOICE_ID") ||
    optionalEnv("ELEVENLABS_VOICE_ID") ||
    "JBFqnCBsd6RMkjVDRZzb";
  const modelId = optionalEnv("ELEVENLABS_TTS_MODEL_ID") || "eleven_multilingual_v2";

  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(
    voiceId,
  )}?output_format=mp3_44100_128`;

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    throw new HttpsError(
      "internal",
      detail
        ? `ElevenLabs TTS failed: ${detail.slice(0, 300)}`
        : `ElevenLabs TTS failed with ${resp.status}.`,
    );
  }

  const audioBase64 = Buffer.from(await resp.arrayBuffer()).toString("base64");
  return {
    audioBase64,
    mimeType: "audio/mpeg",
  };
});

export const analyzeRecording = onObjectFinalized({ region: REGION }, async (event) => {
  const name = event.data.name;
  const bucket = event.data.bucket;

  // Only handle recordings/{userId}/{recordingId}.wav
  if (!name?.startsWith("recordings/")) return;
  const parts = name.split("/");
  if (parts.length !== 3 || !parts[2].endsWith(".wav")) return;

  const userId = parts[1];
  const recordingId = parts[2].slice(0, -4);

  const db = getFirestore();
  const reportRef = db.collection("reports").doc(recordingId);
  const snap = await reportRef.get();
  if (!snap.exists) return;

  const { instrument, referenceId } = snap.data() as {
    instrument: string;
    challenge: string;
    referenceId?: string;
  };

  // Download the WAV
  const [fileBuffer] = await getStorage().bucket(bucket).file(name).download();

  // POST to the Python analysis API
  const apiUrl = process.env.ANALYSIS_API_URL ?? "http://localhost:8000";

  const form = new FormData();
  form.append("instrument", instrument);
  form.append(
    "audio",
    new Blob([new Uint8Array(fileBuffer)], { type: "audio/wav" }),
    "recording.wav",
  );
  if (referenceId) form.append("reference_id", referenceId);

  let result: {
    overall_score?: number;
    dimension_scores?: {
      pitch_centre?: number;
      pitch_stability?: number;
      rhythm?: number;
      tone_quality?: number;
      note_attack?: number;
    };
    weaknesses: string[];
    comparison?: {
      reference_id?: string;
      note_accuracy: number;
      timing_accuracy: number;
      missed_notes: number;
      extra_notes: number;
      total_reference_notes: number;
    };
    comparison_error?: string;
  };

  try {
    const resp = await fetch(`${apiUrl}/analyze`, { method: "POST", body: form });
    if (!resp.ok) throw new Error(`API ${resp.status}: ${await resp.text()}`);
    result = (await resp.json()) as typeof result;
  } catch (err) {
    await reportRef.update({ status: "error", error: String(err) });
    return;
  }

  const dimensionScores = {
    pitch_centre: Number(result.dimension_scores?.pitch_centre ?? 0),
    pitch_stability: Number(result.dimension_scores?.pitch_stability ?? 0),
    rhythm: Number(result.dimension_scores?.rhythm ?? 0),
    tone_quality: Number(result.dimension_scores?.tone_quality ?? 0),
    note_attack: Number(result.dimension_scores?.note_attack ?? 0),
  };

  const computedOverall = Math.round(
    (dimensionScores.pitch_centre +
      dimensionScores.pitch_stability +
      dimensionScores.rhythm +
      dimensionScores.tone_quality +
      dimensionScores.note_attack) /
      5,
  );
  const overall = Number.isFinite(result.overall_score)
    ? Number(result.overall_score)
    : computedOverall;

  await reportRef.update({
    status: "done",
    overallScore: overall,
    dimensionScores,
    overall_score: overall,
    dimension_scores: dimensionScores,
    weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses : [],
    ...(result.comparison ? { comparison: result.comparison } : {}),
    ...(result.comparison_error ? { comparison_error: result.comparison_error } : {}),
    analyzedAt: new Date(),
  });

  console.log(`Report ${recordingId} for user ${userId} written with score ${overall}`);
});
