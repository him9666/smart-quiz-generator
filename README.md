# Smart Quiz Generator

A Next.js app that lets users upload notes as a PDF, stores the file in Supabase storage, parses the content, and generates a smart quiz with feedback and improvement suggestions.

## Features

- PDF upload and storage in Supabase
- PDF text extraction for quiz creation
- AI-powered quiz generation, feedback, and revision suggestions
- Caching via Supabase to speed up repeated generation from the same note
- Vercel-ready for Git-connected deployment

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a new Supabase project at https://app.supabase.com
2. Create a storage bucket named `notes`
   - Make the bucket public or configure appropriate access rules
3. Create a database table for cached notes:

```sql
create table notes (
  id uuid primary key default uuid_generate_v4(),
  file_name text,
  file_key text,
  content_hash text unique,
  extracted_text text,
  quiz_response jsonb,
  created_at timestamp with time zone default now()
);
```

### 3. Configure environment variables

Create a `.env.local` file in the project root with:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=your-openai-key
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:3000 to access the app.

## Deployment on Vercel

1. Push the repository to GitHub.
2. Link the repo to Vercel.
3. Add the same environment variables in the Vercel project settings.
4. Set the build command to `npm run build`.

Vercel will automatically deploy the app each time you push new commits.

## Notes

- The app expects a Supabase storage bucket named `notes`.
- The API route uses the Supabase service role key on the server side to upload files and cache quiz generation results.
- The AI prompt returns JSON with `quiz`, `feedback`, and `suggestions` so the frontend renders structured output.
