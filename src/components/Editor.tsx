import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Brain, Database } from 'lucide-react';
import { streamCompletion } from '../lib/zhipu';
import EmbeddingService from '../lib/embedding';
import { supabase } from '../lib/supabase';

interface EditorProps {
  initialContent?: any;
  onUpdate: (json: any, text: string) => void;
  isSaving?: boolean;
  novelId: string;
  chapterId: string; // 新增：用于绑定向量
}

const Editor = ({ initialContent, onUpdate, isSaving = false, novelId, chapterId }: EditorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [status, setStatus] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始你的创作... (点击右上角 ✨ AI 续写)',
      }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class: 'prose prose-lg max-w-none focus:outline-none min-h-[500px] p-4',
      },
    },
    onUpdate: ({ editor }) => {
      onUpdate(editor.getJSON(), editor.getText());
    },
  });

  useEffect(() => {
    EmbeddingService.getInstance();
  }, []);

  // 手动触发记忆同步 (写入向量)
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
      // 1. 简单的切片策略：按500字切片
      const chunks = [];
      for (let i = 0; i < text.length; i += 500) {
        chunks.push(text.slice(i, i + 500));
      }

      // 2. 逐个计算向量并存入
      // 先删除旧的记忆（为了简化 MVP，全量覆盖）
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
    <div className="relative border rounded-xl bg-white shadow-sm min-h-[600px] flex flex-col">
      <div className="border-b p-2 flex justify-between items-center gap-2 bg-gray-50 rounded-t-xl sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                保存中...
              </span>
            )}
            {!isSaving && <span className="text-xs text-gray-400">已保存</span>}
          </div>
          
          {status && (
            <div className="flex items-center gap-1 text-xs text-indigo-600 animate-pulse font-medium bg-indigo-50 px-2 py-1 rounded-full">
              <Brain className="w-3 h-3" />
              {status}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          {/* 记忆同步按钮 */}
          <button
            onClick={handleSyncMemory}
            disabled={isSyncing || isGenerating}
            title="将当前章节存入长期记忆，供AI检索"
            className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            {isSyncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
          </button>

          <button 
            onClick={handleAIContinue}
            disabled={isGenerating}
            className={`
              flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${isGenerating 
                ? 'bg-red-50 text-red-600 border border-red-100 cursor-wait' 
                : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-md hover:-translate-y-0.5'
              }
            `}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                AI 续写
              </>
            )}
          </button>
        </div>
      </div>

      <EditorContent editor={editor} className="flex-1 p-4" />
    </div>
  );
};

export default Editor;
