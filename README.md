# Create Listing - Post-Detail Photo Cleaner + Pricing Research

AI-powered tool to clean photos by removing dust, dirt, and smudges while preserving every detail, defect, and exact composition. Also includes staged listing research with an OpenRouter Gemini classifier plus Gemini and OpenAI research models.

## Features

- **Drag & drop upload** - Upload multiple images at once
- **Cleanliness levels** - Light (dust only), Standard (vacuum + wipe), Deep (seams + high-touch areas)
- **Resolution options** - Match original, 2K, or 4K output
- **Real-time progress** - Live job status updates via Convex subscriptions
- **Before/After viewer** - Interactive slider to compare original vs cleaned
- **Batch download** - Download all cleaned images as a ZIP
- **Classifier stage** - Gemini 2.5 Flash (via OpenRouter) assesses item basics, condition, model hints, and image relevance
- **Product research** - Gemini 2.5 Pro + OpenAI reasoning research for identification, pricing, and listing copy
- **Pricing summary** - New vs used price ranges + recommended price by condition
- **Listing workflow** - Generates title, description, and selling notes

## Tech Stack

- **Frontend**: Vite + React + TanStack Router + Tailwind CSS
- **UI**: shadcn/ui components + Origin UI blocks
- **Backend**: Convex (database, file storage, actions)
- **AI**: OpenRouter Gemini (classifier), Google Gemini (research + image generation/editing), OpenAI (research)
- **Auth**: Clerk
- **Validation**: Zod
- **Utilities**: Remeda

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

Optional: set `GEMINI_RESEARCH_MODEL` to override Gemini research model
(defaults to `gemini-2.5-pro`).

### 4. Set up OpenRouter API Key (classifier stage)

1. Create an API key at [OpenRouter](https://openrouter.ai/)
2. In the Convex dashboard, go to **Settings → Environment Variables**
3. Add `OPENROUTER_API_KEY`

Optional:
- `OPENROUTER_CLASSIFIER_MODEL` (defaults to `google/gemini-2.5-flash`)
- `OPENROUTER_REFERER` (for OpenRouter app attribution)
- `OPENROUTER_APP_NAME` (for OpenRouter app attribution)

### 5. Set up OpenAI API Key

1. Create an API key at [OpenAI](https://platform.openai.com/)
2. In the Convex dashboard, go to **Settings → Environment Variables**
3. Add `OPENAI_API_KEY` with your API key

Optional: set `OPENAI_RESEARCH_MODEL` (defaults to `o3`).

### 6. Set up Clerk

1. Create an app in the [Clerk dashboard](https://dashboard.clerk.com/)
2. Copy your publishable key
3. Add it to `.env.local`:

```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
```

### 7. Run the app

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
create-listing/
├── convex/                 # Convex backend
│   ├── schema.ts          # Database schema (uploads, images, jobs, outputs)
│   ├── uploads.ts         # File upload mutations/queries
│   ├── jobs.ts            # Job processing + Gemini API integration
│   ├── research.ts        # Product research + OpenAI pricing analysis
│   ├── workflows.ts       # Listing workflow orchestration
│   ├── validators.ts      # Shared Convex validators
│   └── outputs.ts         # Output queries
├── src/
│   ├── components/        # React components
│   │   ├── UploadZone.tsx
│   │   ├── ImageGrid.tsx
│   │   ├── OptionsPanel.tsx
│   │   ├── JobsPanel.tsx
│   │   ├── ResearchOptionsPanel.tsx
│   │   ├── ResearchPanel.tsx
│   │   ├── auth/ClerkSignIn.tsx
│   │   ├── auth/ClerkUserButton.tsx
│   │   └── ui/tabs.tsx
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
| `productResearch` | imageId, status, progressPct, error, condition, extractModelId, researchModelId, extraction (includes relevance/model hints), product, pricing, listing |

## Prompt Engineering

The AI is given strict instructions to:
- Keep scene identical (camera, framing, perspective, background, shadows, reflections)
- Only change cleanliness (remove dust, dirt, crumbs, smudges)
- Preserve all wear and defects (scratches, dents, stains, chips)
- Retry with stricter prompt if scene drift is detected

## Configuration

Model IDs can be changed in `convex/jobs.ts` and `convex/research.ts`:

```typescript
const CLASSIFIER_MODEL_ID = "google/gemini-2.5-flash";
const GEMINI_RESEARCH_MODEL_ID = "gemini-2.5-pro";
const OPENAI_RESEARCH_MODEL_ID = "o3";
```

Available models (examples):
- `google/gemini-2.5-flash` (OpenRouter) - fast classifier
- `gemini-2.5-pro` (Google) - deeper research reasoning
- `o3` (OpenAI) - high-quality reasoning research

## License

MIT
