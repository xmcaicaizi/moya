# Moya - AI Novel Writing Assistant

Moya (墨矢) is an AI-powered creative writing assistant designed to help novelists craft better stories with memory and context awareness.

## 🚀 Project Status

**Current Status: MVP Complete (Day 1-5)**

- [x] **Day 1: Setup & Auth** - Project initialization, Supabase integration, Google OAuth.
- [x] **Day 2: Editor Core** - Tiptap editor integration, chapter management, auto-save.
- [x] **Day 3: AI Integration** - Zhipu GLM-4.5 connectivity, streaming text generation.
- [x] **Day 4: RAG Memory System** - Vector database setup (Supabase pgvector), Transformers.js embedding, context retrieval.
- [x] **Day 5: World Bible & Memory Sync** - Settings panel (Characters/World/Items), active memory synchronization.
- [ ] **Day 6: UI Polish** - Visual enhancements, dark mode, better typography.
- [ ] **Day 7: Deployment** - Production build, Vercel/Netlify deployment.

## ✨ Key Features

*   **Smart Editor**: Rich text editing with Markdown support via Tiptap.
*   **AI Co-Author**: Context-aware continuation powered by GLM-4.5.
*   **Long-term Memory**: RAG (Retrieval-Augmented Generation) system that "remembers" your previous chapters and settings.
*   **World Building**: Dedicated panel to manage characters, locations, and items, which are automatically embedded for AI retrieval.
*   **Cloud Sync**: Real-time data persistence with Supabase.

## 🛠 Tech Stack

*   **Frontend**: React 19, Vite, Tailwind CSS
*   **State Management**: Zustand
*   **Database & Auth**: Supabase
*   **AI & Vectors**: Zhipu AI (GLM), Transformers.js (Embeddings), Supabase Vector
*   **Editor**: Tiptap

## 🗄️ Database Schema (Supabase)

To replicate this project, execute the following SQL in your Supabase SQL Editor:

```sql
-- 1. Enable Vector Extension
create extension if not exists vector;
create extension if not exists moddatetime;

-- 2. Novels Table
create table novels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table novels enable row level security;
create policy "Users can manage their own novels" on novels for all using (auth.uid() = user_id);

-- 3. Chapters Table
create table chapters (
  id uuid default gen_random_uuid() primary key,
  novel_id uuid references novels(id) on delete cascade not null,
  title text not null,
  content jsonb,
  plain_text text,
  word_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table chapters enable row level security;
create policy "Users can manage their own chapters" on chapters for all using (
  exists (select 1 from novels where novels.id = chapters.novel_id and novels.user_id = auth.uid())
);
create trigger handle_updated_at before update on chapters for each row execute procedure moddatetime (updated_at);

-- 4. Documents (Vectors) Table
create table documents (
  id uuid default gen_random_uuid() primary key,
  novel_id uuid references novels(id) on delete cascade not null,
  chapter_id uuid references chapters(id) on delete cascade, -- nullable for global settings
  content text not null,
  metadata jsonb, -- Stores type: 'setting' | 'fragment', name: '...'
  embedding vector(384) -- Matches all-MiniLM-L6-v2
);
create index on documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table documents enable row level security;
create policy "Users can manage their own documents" on documents for all using (
  exists (select 1 from novels where novels.id = documents.novel_id and novels.user_id = auth.uid())
);

-- 5. Vector Search Function
create or replace function match_documents (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_novel_id uuid
)
returns table (
  id uuid,
  content text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    documents.id,
    documents.content,
    1 - (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > match_threshold
  and documents.novel_id = filter_novel_id
  order by documents.embedding <=> query_embedding
  limit match_count;
end;
$$;
```

## Agent Workflow

This project uses a dual-agent workflow:
1. **Coder Agent**: Implements features on `feat/*` branches.
2. **Reviewer Agent**: Reviews code and merges to `main`.
