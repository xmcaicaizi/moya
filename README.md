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

## Agent Workflow

This project uses a dual-agent workflow:
1. **Coder Agent**: Implements features on `feat/*` branches.
2. **Reviewer Agent**: Reviews code and merges to `main`.
