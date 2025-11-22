# Moya - AI Novel Writing Assistant

[中文](README.md) | [English](README_EN.md)

# Moya - AI Novel Writing Assistant

Moya is an AI-powered creative writing assistant designed to help novelists craft better stories with memory and context awareness. It serves not just as an editor, but as an intelligent co-author that "remembers" your plot and settings.

## ✨ Key Features

*   **Smart Editor**: Rich text editing with Markdown support via Tiptap.
*   **AI Co-Author**: Context-aware continuation powered by Zhipu AI (GLM-4.5).
*   **Long-term Memory (RAG)**: Retrieval-Augmented Generation system that remembers previous chapters and settings using Supabase Vector.
*   **World Building**: Dedicated panel for characters, locations, and items, automatically embedded for AI retrieval.
*   **Cloud Sync**: Real-time data persistence with Supabase.

## 🛠 Tech Stack

*   **Frontend**: React 19, Vite, Tailwind CSS
*   **State Management**: Zustand
*   **Database & Auth**: Supabase (PostgreSQL + Auth + Vector)
*   **AI & Vectors**: Zhipu AI (GLM-4.5), Transformers.js (Embeddings), Supabase Vector
*   **Editor**: Tiptap

## 🚀 Quick Start

### 1. Prerequisites
- Node.js (v18+)
- npm or yarn

### 2. Clone & Install
```bash
git clone <repository-url>
cd moya
npm install
```

### 3. Environment Variables
Create a `.env` file in the `moya` directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_ZHIPU_API_KEY=your_zhipu_api_key
```

### 4. Database Setup (Supabase)
Run the SQL script provided in the [Chinese Section - Database Setup](README.md#4-数据库设置-supabase) in your Supabase SQL Editor to initialize the database.

### 5. Run
```bash
npm run dev
```

## 📅 Roadmap & Status

**Current Status: MVP Complete (Day 1-5)**

- [x] **Day 1: Setup & Auth** - Project initialization, Supabase integration.
- [x] **Day 2: Editor Core** - Tiptap integration, chapter management, auto-save.
- [x] **Day 3: AI Integration** - Zhipu GLM-4.5 connectivity, streaming generation.
- [x] **Day 4: RAG Memory System** - Vector database setup, embeddings, context retrieval.
- [x] **Day 5: World Bible & Sync** - Settings panel, active memory synchronization.
- [ ] **Day 6: UI Polish** - Visual enhancements, dark mode.
- [ ] **Day 7: Deployment** - Production build.

## 🤝 Contributing

1.  **Branches**:
    -   `main`: Stable.
    -   `feat/*`: New features.
    -   `fix/*`: Bug fixes.

2.  **Commit Messages**:
    -   Use standard prefixes: `feat`, `fix`, `docs`, `style`, `refactor`.

