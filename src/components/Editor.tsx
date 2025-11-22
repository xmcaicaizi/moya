import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Brain, Database, Check } from 'lucide-react';
import { streamCompletion } from '../lib/zhipu';
import EmbeddingService from '../lib/embedding';
import { supabase } from '../lib/supabase';

interface EditorProps {
  initialContent?: any;
  onUpdate: (json: any, text: string) => void;
  isSaving?: boolean;
  novelId: string;
  chapterId: string;
}

const Editor = ({ initialContent, onUpdate, isSaving = false, novelId, chapterId }: EditorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState('');

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
        class: 'prose prose-lg prose-stone max-w-none focus:outline-none min-h-[calc(100vh-200px)] px-8 py-4 font-serif leading-relaxed',
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
    setStatus('正在写入记忆库...');

    try {
      const chunks = [];
      for (let i = 0; i < text.length; i += 500) {
        chunks.push(text.slice(i, i + 500));
      }

      await supabase.from('documents').delete().eq('chapter_id', chapterId);

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
      setStatus(`✅ 已同步 ${count} 条记忆片段`);
      setTimeout(() => setStatus(''), 3000);
    } catch (err: any) {
      console.error(err);
      setStatus('❌ 记忆同步失败');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAIContinue = async () => {
    if (!editor || isGenerating) return;

    const text = editor.getText();
    const currentContext = text.slice(-1000);
    
    if (currentContext.length < 10) {
      alert("请先写一点内容，AI 才知道怎么接！");
      return;
    }

    setIsGenerating(true);
    setStatus('🧠 回忆剧情中...');
    
    try {
      const vector = await EmbeddingService.getEmbedding(currentContext);
      
      const { data: relatedDocs } = await supabase.rpc('match_documents', {
        query_embedding: vector,
        match_threshold: 0.3,
        match_count: 3,
        filter_novel_id: novelId
      });

      let ragContext = "";
      if (relatedDocs && relatedDocs.length > 0) {
        setStatus(`📖 参考了 ${relatedDocs.length} 处相关设定...`);
        ragContext = `
【相关剧情回忆】：
${relatedDocs.map((d: any) => d.content).join('\n---\n')}

【当前正文】：
`;
      } else {
        setStatus('✨ 灵感生成中...');
      }

      const finalPrompt = ragContext + currentContext;

      editor.commands.insertContent('\n');

      await streamCompletion(
        finalPrompt,
        (chunk) => {
          editor.commands.insertContent(chunk);
          editor.commands.scrollIntoView();
        },
        (err) => {
          throw err;
        }
      );

    } catch (err: any) {
      alert(`AI 生成失败: ${err.message}`);
    } finally {
      setIsGenerating(false);
      setStatus('');
    }
  };

  if (!editor) return null;

  return (
    <div className="relative flex flex-col h-full">
      {/* 悬浮工具栏 (Glassmorphism) */}
      <div className="sticky top-6 z-20 mx-auto mb-8 flex items-center gap-3 bg-white/90 backdrop-blur shadow-lg border border-gray-100 rounded-full px-4 py-2 transition-all hover:shadow-xl">
        <div className="flex items-center gap-2 border-r pr-4 mr-2">
          {isSaving ? (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Saving...
            </span>
          ) : (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <Check className="w-3 h-3" />
              Saved
            </span>
          )}
        </div>

        {status ? (
          <div className="text-xs text-indigo-600 animate-pulse font-medium flex items-center gap-1">
            <Brain className="w-3 h-3" />
            {status}
          </div>
        ) : (
          <>
            <button
              onClick={handleSyncMemory}
              disabled={isSyncing}
              className="p-2 text-gray-500 hover:text-ink hover:bg-gray-100 rounded-full transition-colors"
              title="同步记忆"
            >
              {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            </button>
            
            <div className="w-px h-4 bg-gray-200"></div>

            <button 
              onClick={handleAIContinue}
              disabled={isGenerating}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all
                ${isGenerating 
                  ? 'bg-gray-100 text-gray-400 cursor-wait' 
                  : 'bg-ink text-white hover:bg-gray-800 hover:scale-105 active:scale-95'
                }
              `}
            >
              {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              <span>{isGenerating ? '思考中...' : 'AI 续写'}</span>
            </button>
          </>
        )}
      </div>

      <div className="flex-1 bg-white rounded-none sm:rounded-xl shadow-sm sm:shadow-none min-h-[80vh]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default Editor;
