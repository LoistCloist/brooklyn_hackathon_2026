# brooklyn_hackathon_2026

Music stuff yeyeye

## TuneAcademy web app

The Vite + TanStack app lives in the `TuneAcademy` folder.

### Run locally

From the repository root:

```bash
cd TuneAcademy
npm install
npm run dev
```

After `npm run dev`, open the URL Vite prints in the terminal (usually `http://localhost:8080`).

### Environment variables

Create a file named **`.env`** in the **`TuneAcademy`** directory (next to `package.json`). 

#### Required for Firebase

These values come from the Firebase console: Project settings → Your apps → Web app config.

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (e.g. `your-project.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Cloud Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender ID |
| `VITE_FIREBASE_APP_ID` | App ID |

#### Optional

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics for Firebase (only if enabled for the app) |
| `VITE_BYPASS_AUTH` | Set to `true` to skip auth checks in the app shell during local development (see `TuneAcademy/src/routes/app.tsx`) |

Example shape (replace placeholders with your own values):

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef
# VITE_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
# VITE_BYPASS_AUTH=true
```

Do not commit real `.env` files; keep secrets out of git.

### Hackathon leakage-prevention demo

TuneAcademy demonstrates link-leakage prevention in the frontend so judges can see the intended product behavior without requiring production-grade backend enforcement.

- Google Meet URLs are treated as protected room details, not user-facing links.
- The session page hides the raw Meet URL and removes copy-link sharing.
- The join button unlocks 10 minutes before the scheduled lesson and closes after the lesson ends.
- Users join through TuneAcademy first, which records attendance before opening the Meet room.
- A visible "Leakage Shield" panel explains that links are hidden, copy sharing is removed, and budget is charged after both sides join.
- In-app messages block obvious emails, phone numbers, outside URLs, Google Meet links, Zoom/WhatsApp/Discord mentions, and common payment handles.
- Student-facing tutoring cards replace direct email exposure with protected-profile language.

For production, the next step would be moving enforcement into trusted backend code: stricter Firestore rules, backend-created Meet spaces, backend moderation, payment enforcement, and Google Meet event verification where available.

repo bot test.
