import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';
import { Loader2, Sparkles, StopCircle } from 'lucide-react';
import { streamCompletion } from '../lib/zhipu';

interface EditorProps {
  initialContent?: any;
  onUpdate: (json: any, text: string) => void;
  isSaving?: boolean;
}

const Editor = ({ initialContent, onUpdate, isSaving = false }: EditorProps) => {
  const [isGenerating, setIsGenerating] = useState(false);

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
    if (editor && initialContent) {
      // 仅在初始加载时设置，避免重置打断
    }
  }, [initialContent, editor]);

  const handleAIContinue = async () => {
    if (!editor || isGenerating) return;

    // 获取上文 (取最后 2000 字以节省 Token)
    const text = editor.getText();
    const context = text.slice(-2000);
    
    if (context.length < 10) {
      alert("请先写一点内容，AI 才知道怎么接！");
      return;
    }

    setIsGenerating(true);
    
    // 插入一个换行，准备接收 AI 内容
    editor.commands.insertContent('\n');

    await streamCompletion(
      context,
      (chunk) => {
        // 实时插入内容，实现打字机效果
        editor.commands.insertContent(chunk);
        // 滚动到底部
        editor.commands.scrollIntoView();
      },
      (err) => {
        alert(`AI 生成失败: ${err.message}`);
        setIsGenerating(false);
      }
    );

    setIsGenerating(false);
  };

  if (!editor) {
    return null;
  }

  return (
    <div className="relative border rounded-xl bg-white shadow-sm min-h-[600px] flex flex-col">
      {/* 顶部工具栏 */}
      <div className="border-b p-2 flex justify-between items-center gap-2 bg-gray-50 rounded-t-xl sticky top-0 z-10">
        <div className="flex items-center gap-2">
          {isSaving && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              保存中...
            </span>
          )}
          {!isSaving && <span className="text-xs text-gray-400">已保存</span>}
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

      <EditorContent editor={editor} className="flex-1 p-4" />
    </div>
  );
};

export default Editor;
