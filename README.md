# Moya (墨矢) - AI Novel Writing Assistant

[中文](README.md) | [English](README_EN.md)

# 墨矢 (Moya) - AI 驱动的小说创作助手

Moya (墨矢) 是一个基于 AI 的创意写作助手，旨在通过记忆和上下文感知帮助小说家创作更好的故事。它不仅仅是一个编辑器，更是一个能够“记住”你设定和剧情的智能合著者。

## ✨ 核心功能

*   **智能编辑器**: 基于 Tiptap 的富文本编辑器，支持 Markdown 语法，提供流畅的写作体验。
*   **AI 续写 (Co-Author)**: 集成智谱 AI (GLM-4.5)，根据上下文感知自动续写情节，保持风格一致。
*   **长期记忆 (RAG)**: 基于 Supabase Vector 和 Transformers.js 的检索增强生成 (RAG) 系统，能够“记住”之前的章节和设定。
*   **世界观构建**: 专用的设定集面板（角色、地点、物品），自动向量化并用于 AI 检索，确保设定不崩坏。
*   **小说大纲**: 在“设定集”中新增“大纲”标签页，可按章节/节点维护剧情摘要，AI 续写会优先参考大纲，确保故事不跑偏。
*   **思考模式开关**: 基于 GLM-4.5 的 `thinking.type` 特性，编辑器工具栏提供“深度思考 / 速写模式”一键切换，默认开启深度思考，可随时切换为快速输出（参考 [GLM-4.5 官方文档](https://zhipu-ef7018ed.mintlify.app/cn/guide/models/free/glm-4.5-flash#%E7%BD%91%E9%A1%B5%E6%90%AD%E5%BB%BA)）。
*   **云端同步**: 使用 Supabase 进行实时数据存储和同步，随时随地写作。

## 🛠 技术栈

*   **前端**: React 19, Vite, Tailwind CSS
*   **状态管理**: Zustand
*   **后端/数据库**: Supabase (PostgreSQL + Auth + Vector)
*   **AI & 向量**: Zhipu AI (GLM-4.5), Transformers.js (本地 Embedding), Supabase Vector
*   **编辑器**: Tiptap

## 🚀 快速开始

### 1. 环境准备
确保你的开发环境已安装：
- Node.js (v18+)
- npm 或 yarn

### 2. 克隆项目
```bash
git clone <repository-url>
cd moya
npm install
```

### 3. 配置环境变量
在 `moya` 目录下创建 `.env` 文件，填入以下配置：

```env
VITE_SUPABASE_URL=你的_Supabase_Project_URL
VITE_SUPABASE_ANON_KEY=你的_Supabase_Anon_Key
VITE_ZHIPU_API_KEY=你的_智谱AI_API_Key
```

### 4. 数据库设置 (Supabase)
在 Supabase 的 SQL Editor 中执行以下 SQL 语句以初始化数据库结构：

```sql
-- 1. 启用向量扩展
create extension if not exists vector;
create extension if not exists moddatetime;

-- 2. 小说表 (Novels)
create table novels (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table novels enable row level security;
create policy "Users can manage their own novels" on novels for all using (auth.uid() = user_id);

-- 3. 章节表 (Chapters)
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

-- 4. 文档/向量表 (Documents)
create table documents (
  id uuid default gen_random_uuid() primary key,
  novel_id uuid references novels(id) on delete cascade not null,
  chapter_id uuid references chapters(id) on delete cascade, -- 可为空（全局设定）
  content text not null,
  metadata jsonb, -- 存储类型: 'setting' | 'fragment', name: '...'
  embedding vector(384) -- 匹配 all-MiniLM-L6-v2 模型
);
create index on documents using ivfflat (embedding vector_cosine_ops) with (lists = 100);
alter table documents enable row level security;
create policy "Users can manage their own documents" on documents for all using (
  exists (select 1 from novels where novels.id = documents.novel_id and novels.user_id = auth.uid())
);

-- 5. 向量搜索函数
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

### 5. 启动开发服务器
```bash
npm run dev
```

## 📅 开发计划与状态

**当前状态: MVP 完成 (Day 1-5)**

- [x] **Day 1: 基础设置与认证** - 项目初始化, Supabase 集成, Google OAuth。
- [x] **Day 2: 编辑器核心** - Tiptap 编辑器集成, 章节管理, 自动保存。
- [x] **Day 3: AI 集成** - 智谱 GLM-4.5 连接, 流式文本生成。
- [x] **Day 4: RAG 记忆系统** - 向量数据库设置 (Supabase pgvector), Transformers.js 嵌入, 上下文检索。
- [x] **Day 5: 世界观与记忆同步** - 设定集面板 (角色/世界/物品), 主动记忆同步。
- [x] **Day 6: UI 优化** - 视觉增强, 暗色模式, 更好的排版。
- [ ] **Day 7: 部署** - 生产构建, 部署上线。

### Day 6 - UI & AI 体验优化成果

- 🌗 **主题切换**：在任意页面右上角加入「日间/夜间」切换按钮，自动记忆偏好并适配系统主题。
- 🧠 **Copilot 浮窗**：AI 续写提示面板重构为右侧悬浮卡片，小屏幕自动折叠至正文下方，阅读与交互互不干扰。
- ✍️ **排版统一**：小说列表、章节面板、编辑器与设定集全面适配暗色模式，更新了卡片阴影、边框与字体对比度，视觉更统一。
- 📚 **大纲驱动写作**：设定集新增“大纲”页签，可为每个章节编写剧情摘要，系统会同步向量化并作为 RAG 重点参考。
- 🤖 **思考模式开关**：编辑器顶部提供“深度思考 / 速写模式”，会影响向智谱 GLM-4.5 发送的 `thinking.type` 参数，默认开启深度模式，用户可按需切换（参考 [GLM-4.5 官方指引](https://zhipu-ef7018ed.mintlify.app/cn/guide/models/free/glm-4.5-flash#%E7%BD%91%E9%A1%B5%E6%90%AD%E5%BB%BA)）。

## 🤝 贡献与 Git 流程

本项目采用双 Agent 工作流模式，同时也欢迎人类开发者贡献：

1.  **分支管理**:
    -   `main`: 主分支，保持稳定。
    -   `feat/feature-name`: 新功能开发分支。
    -   `fix/bug-name`: 问题修复分支。

2.  **提交规范**:
    -   `feat`: 新功能
    -   `fix`: 修复 Bug
    -   `docs`: 文档修改
    -   `style`: 代码格式修改 (不影响代码运行的变动)
    -   `refactor`: 重构 (既不是新增功能也不是修改 bug 的代码变动)
