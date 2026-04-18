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

repo bot test.