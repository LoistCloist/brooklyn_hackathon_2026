"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRecording = exports.createGoogleMeetLinksForEngagement = exports.getGoogleCalendarConnectionStatus = exports.googleCalendarOAuthCallback = exports.createGoogleCalendarAuthUrl = void 0;
const crypto_1 = require("crypto");
const storage_1 = require("firebase-functions/v2/storage");
const https_1 = require("firebase-functions/v2/https");
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const storage_2 = require("firebase-admin/storage");
(0, app_1.initializeApp)();
const REGION = "us-east1";
const GOOGLE_CALENDAR_SCOPE = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
function requiredEnv(name) {
    const value = process.env[name]?.trim();
    if (!value)
        throw new https_1.HttpsError("failed-precondition", `Missing server environment variable ${name}.`);
    return value;
}
function redirectAppOrigin() {
    return process.env.APP_ORIGIN?.trim() || "http://localhost:5173";
}
function oauthConfig() {
    return {
        clientId: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
        clientSecret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
        redirectUri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
    };
}
async function readJsonResponse(resp) {
    const text = await resp.text();
    if (!resp.ok) {
        throw new Error(text || `HTTP ${resp.status}`);
    }
    return JSON.parse(text);
}
async function refreshGoogleAccessToken(uid, connection) {
    if (connection.accessToken && (connection.accessTokenExpiresAt ?? 0) > Date.now() + 60000) {
        return connection.accessToken;
    }
    if (!connection.refreshToken) {
        throw new https_1.HttpsError("failed-precondition", "Connect Google Calendar before creating Meet links.");
    }
    const { clientId, clientSecret } = oauthConfig();
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: connection.refreshToken,
        grant_type: "refresh_token",
    });
    const token = await readJsonResponse(await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
    }));
    const expiresAt = Date.now() + (token.expires_in ?? 3600) * 1000;
    await (0, firestore_1.getFirestore)()
        .collection("googleCalendarConnections")
        .doc(uid)
        .set({
        accessToken: token.access_token,
        accessTokenExpiresAt: expiresAt,
        scope: token.scope ?? connection.scope ?? "",
        updatedAt: firestore_1.FieldValue.serverTimestamp(),
    }, { merge: true });
    return token.access_token;
}
function timestampToDate(value) {
    if (value instanceof firestore_1.Timestamp)
        return value.toDate();
    if (value &&
        typeof value === "object" &&
        "toDate" in value &&
        typeof value.toDate === "function") {
        const out = value.toDate();
        return out instanceof Date ? out : null;
    }
    return null;
}
function eventMeetUri(event) {
    const videoEntry = event?.conferenceData?.entryPoints?.find((entry) => entry?.entryPointType === "video");
    return videoEntry?.uri || event?.hangoutLink || null;
}
exports.createGoogleCalendarAuthUrl = (0, https_1.onCall)({ region: REGION }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Sign in before connecting Google Calendar.");
    const { clientId, redirectUri } = oauthConfig();
    const state = (0, crypto_1.randomUUID)();
    await (0, firestore_1.getFirestore)()
        .collection("googleCalendarOAuthStates")
        .doc(state)
        .set({ uid, createdAt: firestore_1.FieldValue.serverTimestamp() });
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
exports.googleCalendarOAuthCallback = (0, https_1.onRequest)({ region: REGION }, async (req, res) => {
    const appOrigin = redirectAppOrigin();
    try {
        const code = typeof req.query.code === "string" ? req.query.code : "";
        const state = typeof req.query.state === "string" ? req.query.state : "";
        if (!code || !state) {
            res.redirect(`${appOrigin}/app/profile?calendar=error`);
            return;
        }
        const db = (0, firestore_1.getFirestore)();
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
        const token = await readJsonResponse(await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body,
        }));
        const profile = await readJsonResponse(await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
            headers: { Authorization: `Bearer ${token.access_token}` },
        }));
        await db
            .collection("googleCalendarConnections")
            .doc(uid)
            .set({
            accessToken: token.access_token,
            ...(token.refresh_token ? { refreshToken: token.refresh_token } : {}),
            accessTokenExpiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
            googleEmail: profile.email ?? "",
            scope: token.scope ?? GOOGLE_CALENDAR_SCOPE,
            connectedAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }, { merge: true });
        await stateRef.delete();
        res.redirect(`${appOrigin}/app/profile?calendar=connected`);
    }
    catch (error) {
        console.error("Google Calendar OAuth failed", error);
        res.redirect(`${appOrigin}/app/profile?calendar=error`);
    }
});
exports.getGoogleCalendarConnectionStatus = (0, https_1.onCall)({ region: REGION }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Sign in first.");
    const snap = await (0, firestore_1.getFirestore)().collection("googleCalendarConnections").doc(uid).get();
    const data = snap.data();
    return { connected: Boolean(data?.refreshToken), googleEmail: data?.googleEmail ?? "" };
});
exports.createGoogleMeetLinksForEngagement = (0, https_1.onCall)({ region: REGION }, async (request) => {
    const uid = request.auth?.uid;
    if (!uid)
        throw new https_1.HttpsError("unauthenticated", "Sign in first.");
    const engagementId = String(request.data?.engagementId ?? "").trim();
    if (!engagementId)
        throw new https_1.HttpsError("invalid-argument", "Missing engagementId.");
    const db = (0, firestore_1.getFirestore)();
    const engRef = db.collection("tutoringEngagements").doc(engagementId);
    const engSnap = await engRef.get();
    if (!engSnap.exists)
        throw new https_1.HttpsError("not-found", "Engagement not found.");
    const eng = engSnap.data();
    if (eng.instructorId !== uid) {
        throw new https_1.HttpsError("permission-denied", "Only the instructor can create Meet links for this booking.");
    }
    const connectionSnap = await db.collection("googleCalendarConnections").doc(uid).get();
    const connection = connectionSnap.data();
    if (!connection?.refreshToken) {
        throw new https_1.HttpsError("failed-precondition", "Connect Google Calendar before creating Meet links.");
    }
    const accessToken = await refreshGoogleAccessToken(uid, connection);
    const [instructorSnap, learnerSnap] = await Promise.all([
        db.collection("users").doc(eng.instructorId).get(),
        db.collection("users").doc(eng.learnerId).get(),
    ]);
    const instructor = instructorSnap.data();
    const learner = learnerSnap.data();
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
            description: "TuneAcademy protected lesson. Join from TuneAcademy so scheduling, payment, and attendance stay together.",
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
        const createdEvent = await readJsonResponse(await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify(eventBody),
        }));
        const meetingUri = eventMeetUri(createdEvent);
        if (!meetingUri)
            throw new https_1.HttpsError("internal", "Google created the event but did not return a Meet link.");
        await sessionRef.set({
            meetLink: meetingUri,
            meetingUri,
            googleCalendarEventId: createdEvent.id ?? "",
            googleCalendarHtmlLink: createdEvent.htmlLink ?? "",
            googleCalendarSyncedAt: firestore_1.FieldValue.serverTimestamp(),
            conferenceProvider: "google_calendar",
            instructorCalendarEmail: connection.googleEmail || instructor?.email || "",
        }, { merge: true });
        created++;
    }
    return { created, skipped };
});
exports.analyzeRecording = (0, storage_1.onObjectFinalized)({ region: REGION }, async (event) => {
    const name = event.data.name;
    const bucket = event.data.bucket;
    // Only handle recordings/{userId}/{recordingId}.wav
    if (!name?.startsWith("recordings/"))
        return;
    const parts = name.split("/");
    if (parts.length !== 3 || !parts[2].endsWith(".wav"))
        return;
    const userId = parts[1];
    const recordingId = parts[2].slice(0, -4);
    const db = (0, firestore_1.getFirestore)();
    const reportRef = db.collection("reports").doc(recordingId);
    const snap = await reportRef.get();
    if (!snap.exists)
        return;
    const { instrument, referenceId } = snap.data();
    // Download the WAV
    const [fileBuffer] = await (0, storage_2.getStorage)().bucket(bucket).file(name).download();
    // POST to the Python analysis API
    const apiUrl = process.env.ANALYSIS_API_URL ?? "http://localhost:8000";
    const form = new FormData();
    form.append("instrument", instrument);
    form.append("audio", new Blob([new Uint8Array(fileBuffer)], { type: "audio/wav" }), "recording.wav");
    if (referenceId)
        form.append("reference_id", referenceId);
    let result;
    try {
        const resp = await fetch(`${apiUrl}/analyze`, { method: "POST", body: form });
        if (!resp.ok)
            throw new Error(`API ${resp.status}: ${await resp.text()}`);
        result = (await resp.json());
    }
    catch (err) {
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
    const computedOverall = Math.round((dimensionScores.pitch_centre +
        dimensionScores.pitch_stability +
        dimensionScores.rhythm +
        dimensionScores.tone_quality +
        dimensionScores.note_attack) /
        5);
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
//# sourceMappingURL=index.js.map