import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Brain } from 'lucide-react';
import { streamCompletion } from '../lib/zhipu';
import EmbeddingService from '../lib/embedding';
import { supabase } from '../lib/supabase';

interface EditorProps {
  initialContent?: any;
  onUpdate: (json: any, text: string) => void;
  isSaving?: boolean;
  novelId: string; // 新增：用于 RAG 检索
}

const Editor = ({ initialContent, onUpdate, isSaving = false, novelId }: EditorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState(''); // 用于显示 RAG 状态

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

  // 初始化加载 Embedding 模型
  useEffect(() => {
    EmbeddingService.getInstance();
  }, []);

  const handleAIContinue = async () => {
    if (!editor || isGenerating) return;

    const text = editor.getText();
    const currentContext = text.slice(-1000); // 取最近 1000 字
    
    if (currentContext.length < 10) {
      alert("请先写一点内容，AI 才知道怎么接！");
      return;
    }

    setIsGenerating(true);
    setStatus('🧠 回忆剧情中...');
    
    try {
      // 1. RAG 检索
      // 计算当前上下文的向量
      const vector = await EmbeddingService.getEmbedding(currentContext);
      
      // 去数据库搜索相关的记忆
      const { data: relatedDocs } = await supabase.rpc('match_documents', {
        query_embedding: vector,
        match_threshold: 0.3, // 相似度阈值
        match_count: 3,      // 取前3条相关剧情
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

      // 2. 插入换行
      editor.commands.insertContent('\n');

      // 3. 调用 AI
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
      {/* 顶部工具栏 */}
      <div className="border-b p-2 flex justify-between items-center gap-2 bg-gray-50 rounded-t-xl sticky top-0 z-10">
        <div className="flex items-center gap-4">
          {/* 保存状态 */}
          <div className="flex items-center gap-2">
            {isSaving && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                保存中...
              </span>
            )}
            {!isSaving && <span className="text-xs text-gray-400">已保存</span>}
          </div>
          
          {/* RAG 状态提示 */}
          {status && (
            <div className="flex items-center gap-1 text-xs text-indigo-600 animate-pulse font-medium bg-indigo-50 px-2 py-1 rounded-full">
              <Brain className="w-3 h-3" />
              {status}
            </div>
          )}
        </div>

        {/* AI 按钮 */}
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
              中断
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              AI 续写
            </>
          )}
        </button>
      </div>

      <EditorContent editor={editor} className="flex-1 p-4" />
    </div>
  );
};

export default Editor;
