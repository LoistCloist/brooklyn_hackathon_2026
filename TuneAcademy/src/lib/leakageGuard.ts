const emailPattern = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const urlPattern = /\b(?:https?:\/\/|www\.)\S+/i;
const meetLinkPattern = /\bmeet\.google\.com\/[a-z0-9-]+/i;
const phonePattern = /(?:\+?\d[\s().-]*){8,}/;
const spacedEmailPattern = /\b[A-Z0-9._%+-]+\s*(?:@|\bat\b)\s*[A-Z0-9.-]+\s*(?:\.|\bdot\b)\s*[A-Z]{2,}\b/i;
const socialHandlePattern = /\B@[a-z0-9._-]{3,}/i;
const cashTagPattern = /\$[a-z0-9_]{3,}/i;
const offPlatformWords = [
   "apple cash",
   "apple pay",
   "calendly",
   "call me",
   "cash app",
   "cashapp",
   "cell",
   "cellphone",
   "contact me",
   "direct message",
   "dm me",
   "discord",
   "email",
   "facebook",
   "facetime",
   "fb messenger",
   "gchat",
   "gmail",
   "gmeet",
   "google chat",
   "google hangouts",
   "google meet",
   "gpay",
   "hangouts",
   "ig",
   "instagram",
   "line",
   "messenger",
   "mobile",
   "number",
   "paypal",
   "phone",
   "phone number",
   "signal",
   "skype",
   "sms",
   "snap",
   "snapchat",
   "telegram",
   "text me",
   "tiktok",
   "venmo",
   "viber",
   "whatsapp",
   "wire",
   "zelle",
   "zoom",
];

export const leakageGuardMessage = "Keep contact details, outside links, and payments inside TuneAcademy for protected sessions.";

export function findLeakageIssue(text: string): string | null {
   const value = text.trim();
   if (!value) return null;
   if (emailPattern.test(value)) return "Email addresses are hidden in TuneAcademy chat.";
   if (spacedEmailPattern.test(value)) return "Email addresses are hidden in TuneAcademy chat.";
   if (meetLinkPattern.test(value)) return "Meet links should be opened through the session page.";
   if (urlPattern.test(value)) return "Outside links are blocked in TuneAcademy chat.";
   if (phonePattern.test(value)) return "Phone numbers are hidden in TuneAcademy chat.";
   if (cashTagPattern.test(value)) return "Payment handles are blocked in TuneAcademy chat.";
   if (socialHandlePattern.test(value)) return "Social handles are blocked in TuneAcademy chat.";

   const lower = value.toLowerCase();
   const word = offPlatformWords.find((term) => new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i").test(lower));
   if (word) return `${word} is off-platform. Keep coordination inside TuneAcademy.`;

   return null;
}
