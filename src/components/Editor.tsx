import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

interface EditorProps {
  initialContent?: any;
  onUpdate: (json: any, text: string) => void;
  isSaving?: boolean;
}

const Editor = ({ initialContent, onUpdate, isSaving = false }: EditorProps) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: '开始你的创作... (输入 / 可以唤起 AI，稍后实现)',
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
      // 只在初次加载或切换章节时设置内容，避免光标跳动
      // 这里简单处理，实际可能需要更复杂的 diff 逻辑，或者由父组件控制 key
    }
  }, [initialContent, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative border rounded-xl bg-white shadow-sm min-h-[600px]">
      <div className="border-b p-2 flex justify-end items-center gap-2 bg-gray-50 rounded-t-xl">
        {isSaving && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            保存中...
          </span>
        )}
        {!isSaving && <span className="text-xs text-gray-400">已保存</span>}
      </div>
      <EditorContent editor={editor} className="p-4" />
    </div>
  );
};

export default Editor;

