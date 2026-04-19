import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions } from "@/lib/firebase";

export type GoogleCalendarConnectionStatus = { connected: boolean; googleEmail: string };

export type GoogleMeetLinkCreationResult = { created: number; skipped: number };

export async function getGoogleCalendarConnectionStatus(): Promise<GoogleCalendarConnectionStatus> {
   const fn = httpsCallable<void, GoogleCalendarConnectionStatus>(getFirebaseFunctions(), "getGoogleCalendarConnectionStatus");
   const res = await fn();
   return res.data;
}

export async function createGoogleCalendarAuthUrl(): Promise<string> {
   const fn = httpsCallable<void, { url: string }>(getFirebaseFunctions(), "createGoogleCalendarAuthUrl");
   const res = await fn();
   return res.data.url;
}

export async function createGoogleMeetLinksForEngagement(engagementId: string): Promise<GoogleMeetLinkCreationResult> {
   const fn = httpsCallable<{ engagementId: string }, GoogleMeetLinkCreationResult>(
      getFirebaseFunctions(),
      "createGoogleMeetLinksForEngagement",
   );
   const res = await fn({ engagementId });
   return res.data;
}
