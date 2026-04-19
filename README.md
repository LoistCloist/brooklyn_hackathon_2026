# TuneAcademy

# Project Story

## About the Project

## Inspiration

The job market for musicians and music educators has never been easy. Talented instructors spend more time searching for students than actually teaching, and when they do find them, there's no guarantee the match is a good one. On the other side, students who want to learn an instrument are left scrolling through generic tutor listings with no real way to know who is actually right for them.

We wanted to fix both sides of that problem at once. TuneAcademy was born out of the idea that music instruction deserves the same kind of intelligent matchmaking that exists in other industries, paired with a social layer that lets musicians of all levels connect, share, and grow together.

## What it does

Learning an instrument is one of the most personal journeys a person can go on, but finding the right teacher has always been a shot in the dark.

TuneAcademy changes that.

Students come to the app, pick up their instrument, and record themselves playing. Our AI model listens and doesn't just tell you that you're off. It tells you exactly what's weak, whether that's pitch stability, rhythm consistency, or tone quality. Then, instead of browsing a generic list of tutors, the app surfaces instructors who specifically specialize in fixing those exact weaknesses. The match isn't based on location or price. It's based on what you actually need.

From there, students can book 1-on-1 sessions, or jump into one of our 3-on-1 group sessions if they want a more social learning experience. And beyond lessons, there's a reels-style feed, think TikTok for musicians, where students post their progress, get discovered by instructors, get recruited into bands, and build a real presence in the music community before they even feel ready.

Now flip to the instructor side. TuneAcademy is the foundation for building or growing a music teaching business without the overhead. Instructors can browse our full catalog of students, and for those who've run their recording through the AI, the app surfaces them as a prioritized match based on the instructor's specific strengths. They choose their format, solo sessions, group sessions, or both. Every completed session earns them a verified rating from their student, building a public portfolio of proof that they're the real deal.

Two sides, one platform, one engine driving all of it, and that engine is the AI.

TuneAcademy isn't just an app for learning music. It's the infrastructure for the entire music instruction economy.

## How we built it

TuneAcademy is built on a modern, scalable stack designed to support both the consumer-facing app and the AI pipeline running underneath it.

- **Frontend:** React.js + Tailwind CSS (Huge thanks to Loveable for a beautiful foundation)
- **Database:** Cloud Firestore for real-time data sync across all users, sessions, messages, and reels
- **Backend:** Python with FastAPI, containerized using Docker so the API and model runtime are fully portable and easy to deploy
- **AI Model:** Built using Essentia for audio feature extraction and NumPy for the comparison and scoring engine. The model extracts pitch accuracy, rhythm consistency, tonal quality, and note attack characteristics from a user's recording and compares them against curated golden reference recordings to generate a structured weakness profile
- **Infrastructure:** Google Cloud Platform for hosting, storage, and scalability

## Challenges we ran into

The hardest part of building TuneAcademy was sourcing and validating the golden reference recordings that the AI model uses as its benchmark. For the model to produce meaningful, actionable feedback, the reference audio has to be as close to technically perfect as possible. Too much natural variation in the reference and the model flags weaknesses that aren't really there. Too clean and it becomes unrealistic to compare against.

We spent significant time sourcing, evaluating, and validating reference recordings across each supported instrument, defining quality thresholds for pitch stability, beat consistency, and confidence scores before any reference was accepted into the pipeline.

## Accomplishments that we're proud of

Getting the model to actually work end to end was a major milestone. Taking a raw audio file, running it through Essentia, comparing it against our golden references, and returning a structured, human-readable weakness report in a single API call is something we're genuinely proud of.

Beyond the technical side, we're proud of what TuneAcademy means for music instructors. We built something that gives educators a real foundation to start or grow their teaching business quickly, find students who are a strong fit for their skillset, and build a verifiable reputation through student ratings. That felt meaningful to ship.

## What we learned

Building TuneAcademy pushed us into territory none of us had worked in before. We learned a lot about Google Cloud Platform, specifically how to architect a project that relies on Cloud Firestore, Firebase Auth, Firebase Storage, and a containerized Python backend all working together in a single cohesive system.

On the AI side, we learned how to work with audio as a data format, how to use Essentia to extract musically meaningful features from a raw recording, and how to design a comparison pipeline that produces scores and feedback a real user can act on. Turning audio into useful, structured insight turned out to be one of the most interesting engineering challenges any of us had tackled.

## What's next for TuneAcademy

The current model supports a focused set of instruments and challenge prompts, but the vision is much bigger. Next, we want to scale the reference library so that users can submit a recording of virtually any song or exercise and have the model evaluate their performance against it. Instead of a fixed challenge, imagine submitting your own cover of a piece you're learning and getting a detailed breakdown of exactly where you're struggling and which instructor on the platform is best positioned to help you level up.

The goal is a model that grows with the platform, one that gets smarter the more students use it, and one that makes TuneAcademy the definitive home for music education at every level.

# Running TuneAcademy

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