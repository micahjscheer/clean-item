# CleanItem - Post-Detail Photo Cleaner

AI-powered tool to clean photos by removing dust, dirt, and smudges while preserving every detail, defect, and exact composition. Powered by Google's Gemini image generation.

## Features

- **Drag & drop upload** - Upload multiple images at once
- **Cleanliness levels** - Light (dust only), Standard (vacuum + wipe), Deep (seams + high-touch areas)
- **Resolution options** - Match original, 2K, or 4K output
- **Real-time progress** - Live job status updates via Convex subscriptions
- **Before/After viewer** - Interactive slider to compare original vs cleaned
- **Batch download** - Download all cleaned images as a ZIP

## Tech Stack

- **Frontend**: Vite + React + TanStack Router + Tailwind CSS
- **Backend**: Convex (database, file storage, actions)
- **AI**: Google Gemini (image generation/editing)

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure Convex

Run Convex dev to create a new project:

```bash
bunx convex dev
```

This will:
- Prompt you to log in or create a Convex account
- Create a new Convex project
- Generate the `_generated` folder with types
- Set `VITE_CONVEX_URL` in `.env.local`

### 3. Set up Google API Key

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create an API key
3. In the Convex dashboard, go to **Settings → Environment Variables**
4. Add `GOOGLE_API_KEY` with your API key

### 4. Run the app

In one terminal, run Convex:

```bash
bunx convex dev
```

In another terminal, run the frontend:

```bash
bun run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
clean-item/
├── convex/                 # Convex backend
│   ├── schema.ts          # Database schema (uploads, images, jobs, outputs)
│   ├── uploads.ts         # File upload mutations/queries
│   ├── jobs.ts            # Job processing + Gemini API integration
│   └── outputs.ts         # Output queries
├── src/
│   ├── components/        # React components
│   │   ├── UploadZone.tsx
│   │   ├── ImageGrid.tsx
│   │   ├── OptionsPanel.tsx
│   │   ├── JobsPanel.tsx
│   │   └── BeforeAfterViewer.tsx
│   ├── routes/            # TanStack Router pages
│   ├── lib/utils.ts       # Utility functions
│   └── main.tsx           # App entry point
└── index.html
```

## Data Model

| Table | Fields |
|-------|--------|
| `uploads` | clientSessionId, notes, createdAt |
| `images` | uploadId, storageId, fileName, width, height, mimeType |
| `jobs` | imageId, status, progressPct, error, modelId, promptVersion, cleanlinessLevel, targetOutput, retryCount |
| `outputs` | jobId, storageId, width, height, notes |

## Prompt Engineering

The AI is given strict instructions to:
- Keep scene identical (camera, framing, perspective, background, shadows, reflections)
- Only change cleanliness (remove dust, dirt, crumbs, smudges)
- Preserve all wear and defects (scratches, dents, stains, chips)
- Retry with stricter prompt if scene drift is detected

## Configuration

The model ID can be changed in `convex/jobs.ts`:

```typescript
const MODEL_ID = "gemini-2.0-flash-exp";
```

Available models:
- `gemini-2.0-flash-exp` - Fast, good quality
- `gemini-2.0-pro-exp` - Higher quality, slower
- Future: `gemini-3-pro-image` when available

## License

MIT
