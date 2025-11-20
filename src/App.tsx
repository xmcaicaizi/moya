import { useEffect, useState, useCallback } from 'react';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { Loader2, BookOpen, LogOut, Plus, Save, AlertTriangle, ArrowLeft, FileText } from 'lucide-react';
import Editor from './components/Editor';
import { useDebouncedCallback } from 'use-debounce';

interface Novel {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
}

interface Chapter {
  id: string;
  title: string;
  content: any;
  updated_at: string;
}

function App() {
  const { user, loading, error, initialize, signIn, signOut } = useAuthStore();
  
  // 状态管理
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  // UI 状态
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => { initialize(); }, [initialize]);

  // 加载小说列表
  useEffect(() => {
    if (user && !selectedNovel) {
      const fetchNovels = async () => {
        const { data } = await supabase
          .from('novels')
          .select('*')
          .order('created_at', { ascending: false });
        if (data) setNovels(data as Novel[]);
      };
      fetchNovels();
    }
  }, [user, selectedNovel]);

  // 加载章节列表
  useEffect(() => {
    if (selectedNovel) {
      const fetchChapters = async () => {
        const { data } = await supabase
          .from('chapters')
          .select('*')
          .eq('novel_id', selectedNovel.id)
          .order('created_at', { ascending: true });
        if (data) setChapters(data as Chapter[]);
      };
      fetchChapters();
    }
  }, [selectedNovel]);

  // 自动保存逻辑 (防抖 1000ms)
  const autoSave = useDebouncedCallback(async (chapterId: string, json: any, text: string) => {
    if (!chapterId) return;
    setIsSaving(true);
    try {
      await supabase
        .from('chapters')
        .update({ 
          content: json, 
          plain_text: text,
          word_count: text.length,
          updated_at: new Date().toISOString() 
        })
        .eq('id', chapterId);
    } catch (err) {
      console.error("Auto save failed:", err);
    } finally {
      setIsSaving(false);
    }
  }, 1000);

  // 创建小说
  const createNovel = async () => {
    if (!newTitle.trim() || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('novels')
        .insert([{ title: newTitle, user_id: user.id }])
        .select();
      if (error) throw error;
      if (data) {
        setNovels([data[0] as Novel, ...novels]);
        setNewTitle('');
      }
    } catch (error) {
      alert('创建失败，请重试');
    } finally {
      setCreating(false);
    }
  };

  // 创建章节
  const createChapter = async () => {
    if (!selectedNovel) return;
    const title = prompt("请输入章节标题", "新章节");
    if (!title) return;
    
    try {
      const { data, error } = await supabase
        .from('chapters')
        .insert([{ 
          novel_id: selectedNovel.id, 
          title, 
          content: {},
          plain_text: ''
        }])
        .select();
        
      if (data) {
        setChapters([...chapters, data[0] as Chapter]);
        setSelectedChapter(data[0] as Chapter);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 视图渲染逻辑
  if (error) return <div className="p-8 text-red-600 bg-red-50 h-screen flex items-center justify-center">{error}</div>;
  if (loading) return <div className="h-screen flex items-center justify-center">启动中...</div>;
  if (!user) return (
    <div className="h-screen flex items-center justify-center flex-col gap-4">
      <h1 className="text-4xl font-bold">墨矢 Moya</h1>
      <button onClick={signIn} className="px-6 py-3 bg-black text-white rounded-lg">登录开始写作</button>
    </div>
  );

  // 编辑器视图
  if (selectedChapter) {
    return (
      <div className="h-screen flex flex-col bg-gray-50">
        <header className="bg-white border-b p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedChapter(null)} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-lg">{selectedChapter.title}</h2>
              <p className="text-xs text-gray-500">
                {isSaving ? '保存中...' : '已保存'} · {selectedChapter.updated_at ? new Date(selectedChapter.updated_at).toLocaleTimeString() : ''}
              </p>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full p-8">
          <Editor 
            key={selectedChapter.id} // 关键：切换章节时重置编辑器
            initialContent={selectedChapter.content}
            isSaving={isSaving}
            onUpdate={(json, text) => autoSave(selectedChapter.id, json, text)}
          />
        </main>
      </div>
    );
  }

  // 章节列表视图 (进入小说后)
  if (selectedNovel) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center gap-4 mb-8">
            <button onClick={() => setSelectedNovel(null)} className="p-2 hover:bg-gray-100 rounded-full">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-3xl font-bold">{selectedNovel.title}</h1>
            <button onClick={createChapter} className="ml-auto px-4 py-2 bg-black text-white rounded-lg flex items-center gap-2">
              <Plus className="w-4 h-4" /> 新建章节
            </button>
          </header>
          
          <div className="space-y-4">
            {chapters.length === 0 && <div className="text-center py-10 text-gray-400">暂无章节，点击右上角新建</div>}
            {chapters.map(chapter => (
              <div 
                key={chapter.id} 
                onClick={() => setSelectedChapter(chapter)}
                className="p-4 bg-white border rounded-xl cursor-pointer hover:shadow-md transition flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-gray-400" />
                  <span className="font-medium">{chapter.title}</span>
                </div>
                <span className="text-sm text-gray-400">
                  {new Date(chapter.updated_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // 小说列表视图 (默认首页)
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <header className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-gray-900" />
            <h1 className="text-2xl font-bold">我的作品</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user.email}</span>
            <button onClick={signOut}><LogOut className="w-5 h-5 text-gray-500" /></button>
          </div>
        </header>

        <div className="flex gap-3 mb-8">
          <input 
            type="text" 
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="输入新书名..." 
            className="flex-1 p-4 border rounded-xl focus:ring-2 focus:ring-black"
            onKeyDown={(e) => e.key === 'Enter' && createNovel()}
          />
          <button onClick={createNovel} className="px-8 bg-black text-white rounded-xl font-medium">新建</button>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          {novels.map((novel) => (
            <div 
              key={novel.id} 
              onClick={() => setSelectedNovel(novel)}
              className="p-6 bg-white border rounded-2xl hover:shadow-xl cursor-pointer transition group"
            >
              <h3 className="text-xl font-bold mb-2 group-hover:text-blue-600 transition-colors">{novel.title}</h3>
              <p className="text-sm text-gray-400">{new Date(novel.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
