import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Brain, Database, Check } from 'lucide-react';
import { streamCompletion } from '../lib/zhipu';
import EmbeddingService from '../lib/embedding';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

interface EditorProps {
  initialContent?: any;
  onUpdate: (json: any, text: string) => void;
  isSaving?: boolean;
  novelId: string;
  chapterId: string;
}

const TRIM_WINDOW = 200;

const trimOverlap = (existing: string, incoming: string) => {
  if (!incoming) return incoming;
  const tail = existing.slice(-TRIM_WINDOW);
  const maxCompare = Math.min(tail.length, incoming.length);
  for (let len = maxCompare; len > 0; len--) {
    if (tail.slice(-len) === incoming.slice(0, len)) {
      return incoming.slice(len);
    }
  }
  return incoming;
};

const THINKING_KEY = 'moya-thinking-mode';

const Editor = ({ initialContent, onUpdate, isSaving = false, novelId, chapterId }: EditorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState('');
  
  // AI Prompt UI State
  const [showAiPrompt, setShowAiPrompt] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [thinkingMode, setThinkingMode] = useState<boolean>(() => {
    const stored = localStorage.getItem(THINKING_KEY);
    return stored !== 'false';
  });

  useEffect(() => {
    localStorage.setItem(THINKING_KEY, JSON.stringify(thinkingMode));
  }, [thinkingMode]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始你的故事... (输入 / 唤起 AI，或直接点击右上角)',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-lg prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[calc(100vh-200px)] px-8 py-4 font-serif leading-relaxed',
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON(), editor.getText());
    },
  });

  useEffect(() => {
    EmbeddingService.getInstance();
  }, []);

  const handleSyncMemory = async () => {
    if (!editor || isSyncing) return;
    const text = editor.getText();
    if (text.length < 50) {
      alert("内容太少，无需记忆");
      return;
    }

    setIsSyncing(true);
    logger.info('memory', 'Syncing chapter memory', { chapterId, length: text.length });
    setStatus('正在写入记忆库...');

    try {
      const chunks = [];
      for (let i = 0; i < text.length; i += 500) {
        chunks.push(text.slice(i, i + 500));
      }

      await supabase.from('documents').delete().eq('chapter_id', chapterId);
      logger.info('memory', 'Cleared existing fragments', { chapterId });

      let count = 0;
      for (const chunk of chunks) {
        const vector = await EmbeddingService.getEmbedding(chunk);
        await supabase.from('documents').insert({
          novel_id: novelId,
          chapter_id: chapterId,
          content: chunk,
          embedding: vector,
          metadata: { type: 'chapter_fragment', index: count++ }
        });
      }
      logger.info('memory', 'Inserted memory fragments', { count });
      setStatus(`✅ 已同步 ${count} 条记忆片段`);
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      logger.error('memory', 'Sync failed', err);
      setStatus('❌ 记忆同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAIContinue = () => {
    setShowAiPrompt(!showAiPrompt);
  };

  const executeAI = async () => {
    if (!editor || isGenerating) return;
    setShowAiPrompt(false); // Close popover

    const text = editor.getText();
    const currentContext = text.slice(-1000);
    
    if (currentContext.length < 10) {
      alert("请先写一点内容，AI 才知道怎么接！");
      return;
    }

    setIsGenerating(true);
    logger.info('ai', 'Starting AI continuation', { chapterId, contextLength: currentContext.length, instruction: aiInstruction });
      setStatus(thinkingMode ? '🧠 深度思考中，正在回忆剧情...' : '⚡ 速写模式，正在回忆剧情...');
    
    try {
      const vector = await EmbeddingService.getEmbedding(currentContext);
      
      const [{ data: relatedDocs }, { data: outlineDocs }] = await Promise.all([
        supabase.rpc('match_documents', {
          query_embedding: vector,
          match_threshold: 0.3,
          match_count: 5,
          filter_novel_id: novelId
        }),
        supabase
          .from('documents')
          .select('content, metadata')
          .eq('novel_id', novelId)
          .contains('metadata', { type: 'outline' })
          .limit(3)
      ]);

      let outlineContext = "";
      if (outlineDocs && outlineDocs.length > 0) {
        outlineContext = `
【剧情大纲提示】：
${outlineDocs
  .map((d: any, idx: number) => `${idx + 1}. ${d.content}`)
  .join('\n')}

`;
      }

      let ragContext = "";
      if (relatedDocs && relatedDocs.length > 0) {
        logger.info('ai', 'Found related documents', { count: relatedDocs.length });
        setStatus(`📖 参考了 ${relatedDocs.length} 处相关设定${outlineContext ? ' + 大纲' : ''}...`);
        ragContext = `【相关剧情回忆】：
${relatedDocs.map((d: any) => d.content).join('\n---\n')}

`;
      } else {
        setStatus(outlineContext ? '🧭 正在参考大纲续写...' : '✨ 灵感生成中...');
      }

      const finalPrompt = outlineContext + ragContext + `【当前正文】：
${currentContext}`;

      editor.commands.insertContent('\n');
      setStatus(thinkingMode ? '✍️ 深度模式续写（自动避免重复）...' : '✍️ 快速续写（自动避免重复）...');

      await streamCompletion(
        finalPrompt,
        aiInstruction || null, // Pass the instruction
        (chunk) => {
          const cleanChunk = trimOverlap(editor.getText(), chunk);
          if (!cleanChunk) return;
          editor.commands.insertContent(cleanChunk);
          editor.commands.scrollIntoView();
        },
        (err) => {
          throw err;
        },
        { type: thinkingMode ? 'enabled' : 'disabled' }
      );
      
      // Clear instruction after success
      setAiInstruction('');

    } catch (err: any) {
      logger.error('ai', 'AI generation failed', err);
      alert(`AI 生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setStatus(thinkingMode ? '✨ 深度生成完成（已去重）' : '✨ 速写完成（已去重）');
      setTimeout(() => setStatus(''), 2500);
    }
  };

  const renderPromptCard = () => (
    <div className="glass-panel rounded-2xl shadow-elevation p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted">AI Copilot</p>
          <p className="text-sm font-semibold text-primary">续写指令</p>
        </div>
        <button
          onClick={() => setShowAiPrompt(false)}
          className="text-muted hover:text-primary text-lg leading-none"
        >
          ×
        </button>
      </div>
      <textarea
        value={aiInstruction}
        onChange={(e) => setAiInstruction(e.target.value)}
        placeholder="想要怎么写？(例如：'加入一个反转'，留空则自由发挥)"
        className="w-full p-3 text-sm border border-surface-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-300 focus:border-sky-400 resize-none bg-surface-1 text-primary placeholder:text-muted"
        rows={5}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeAI();
          }
        }}
      />
      <div className="flex justify-between items-center pt-3">
        <span className="text-[10px] text-muted">Enter 发送，Shift+Enter 换行</span>
        <button
          onClick={executeAI}
          className="px-4 py-1.5 btn-primary text-xs font-medium rounded-md hover:opacity-90 transition-opacity"
        >
          开始生成
        </button>
      </div>
    </div>
  );

  const renderPlaceholderCard = () => (
    <div className="glass-panel border border-dashed border-surface-3 rounded-2xl p-4 text-sm text-muted">
      <p className="font-medium text-primary mb-1">AI 续写提示区</p>
      <p>点击上方 <span className="font-semibold text-primary">AI 续写</span> 按钮，给 AI 一条指令，这里会展示可编辑的提示框。</p>
    </div>
  );

  if (!editor) return null;

  return (
    <div className="relative flex flex-col h-full">
      {/* 悬浮工具栏 (Glassmorphism) */}
      <div className="sticky top-6 z-20 mx-auto mb-8 flex items-center gap-3 glass-panel shadow-elevation rounded-full px-4 py-2 transition-all">
        <div className="flex items-center gap-2 border-r pr-4 mr-2 border-surface-3">
          {isSaving ? (
            <span className="text-xs text-muted flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          ) : (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {status ? (
          <div className="text-xs text-indigo-500 animate-pulse font-medium flex items-center gap-1">
            <Brain className="w-3 h-3" />
            {status}
          </div>
        ) : (
          <>
            <button
              onClick={handleSyncMemory}
              disabled={isSyncing}
              className="p-2 text-muted hover:text-primary hover:bg-surface-3 rounded-full transition-colors"
              title="同步记忆"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            </button>
            
            <div className="w-px h-4 bg-surface-3"></div>

          <button
            onClick={() => setThinkingMode(!thinkingMode)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              thinkingMode
                ? 'bg-surface-3 border-surface-4 text-primary'
                : 'bg-transparent border-surface-3 text-muted hover:text-primary'
            }`}
            title="深度思考模式会更严格遵守剧情/大纲，但速度略慢"
          >
            {thinkingMode ? '🧠 深度思考 ON' : '⚡ 速写模式 ON'}
          </button>

          <div className="w-px h-4 bg-surface-3"></div>

            <button 
              onClick={handleAIContinue}
              disabled={isGenerating}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${isGenerating 
                  ? 'bg-surface-3 text-muted cursor-wait' 
                  : showAiPrompt
                    ? 'bg-surface-4 text-primary'
                    : 'btn-primary text-white hover:scale-105 active:scale-95'
                }
              `}
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>{isGenerating ? '思考中...' : 'AI 续写'}</span>
            </button>
          </>
        )}
      </div>

      <div className="relative flex justify-center px-4 lg:px-0 pb-16">
        <div className="w-full max-w-3xl bg-surface-2 rounded-none sm:rounded-xl shadow-elevation sm:shadow-none min-h-[80vh] mx-auto border border-surface-3">
          <EditorContent editor={editor} />
        </div>

        {/* 宽屏悬浮 (Fixed) - 仅在屏幕足够宽 (>1380px) 时显示，避免遮挡正文 */}
        <div className="hidden min-[1380px]:block fixed top-32 right-6 w-80 z-20">
          {showAiPrompt ? renderPromptCard() : renderPlaceholderCard()}
        </div>
      </div>

      {/* 中小屏 (流式布局) - 显示在正文下方 */}
      <div className="min-[1380px]:hidden max-w-3xl mx-auto mt-4 px-4 pb-12">
        {showAiPrompt ? renderPromptCard() : renderPlaceholderCard()}
      </div>
    </div>
  );
};

export default Editor;
