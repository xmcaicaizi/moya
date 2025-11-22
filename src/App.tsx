import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { Loader2, LogOut, Plus, ArrowLeft, Book, PenLine } from 'lucide-react';
import Editor from './components/Editor';
import SettingsPanel from './components/SettingsPanel';
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
  
  const [novels, setNovels] = useState<Novel[]>([]);
  const [selectedNovel, setSelectedNovel] = useState<Novel | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => { initialize(); }, [initialize]);

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
        
      if (error) {
          console.error("Create chapter error:", error);
      }

      if (data) {
        setChapters([...chapters, data[0] as Chapter]);
        setSelectedChapter(data[0] as Chapter);
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (error) return <div className="p-8 text-red-600 bg-red-50 h-screen flex items-center justify-center">{error}</div>;
  if (loading) return <div className="h-screen flex items-center justify-center text-gray-400"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  
  // Login Screen
  if (!user) return (
    <div className="h-screen flex flex-col items-center justify-center bg-paper p-6">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-5xl font-serif font-bold text-ink tracking-tight">墨矢 Moya</h1>
          <p className="text-gray-500 font-light text-lg">你写一句，我记一辈子</p>
        </div>
        <button 
          onClick={signIn}
          className="w-full py-3 px-6 bg-ink text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
          <span className="font-medium">开启创作之旅</span>
        </button>
      </div>
    </div>
  );

  // Editor View
  if (selectedChapter) {
    return (
      <div className="h-screen flex flex-col bg-paper">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedChapter(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-lg text-ink font-serif">{selectedChapter.title}</h2>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>}
                {isSaving ? '保存中...' : '已同步'}
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Book className="w-4 h-4" />
            <span className="hidden sm:inline">设定集</span>
          </button>
        </header>
        <main className="flex-1 max-w-3xl mx-auto w-full p-6 sm:p-12">
          <Editor 
            key={selectedChapter.id}
            novelId={selectedNovel!.id}
            chapterId={selectedChapter.id}
            initialContent={selectedChapter.content}
            isSaving={isSaving}
            onUpdate={(json, text) => autoSave(selectedChapter.id, json, text)}
          />
        </main>

        <SettingsPanel 
          novelId={selectedNovel!.id}
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />
      </div>
    );
  }

  // Chapter List View
  if (selectedNovel) {
    return (
      <div className="min-h-screen bg-paper p-6 sm:p-12">
        <div className="max-w-4xl mx-auto">
          <header className="flex items-center gap-4 mb-12">
            <button onClick={() => setSelectedNovel(null)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors text-gray-500">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-3xl font-serif font-bold text-ink">{selectedNovel.title}</h1>
              <p className="text-gray-400 text-sm mt-1">共 {chapters.length} 章</p>
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setShowSettings(true)} className="px-4 py-2 bg-white border border-gray-200 text-ink rounded-xl flex items-center gap-2 hover:bg-gray-50 shadow-sm transition-all">
                <Book className="w-4 h-4" /> 
                <span className="hidden sm:inline">设定集</span>
              </button>
              <button onClick={createChapter} className="px-4 py-2 bg-ink text-white rounded-xl flex items-center gap-2 hover:opacity-90 shadow-lg shadow-gray-200 transition-all">
                <Plus className="w-4 h-4" /> 
                <span className="hidden sm:inline">新建章节</span>
              </button>
            </div>
          </header>
          
          <div className="grid gap-3">
            {chapters.length === 0 && (
              <div className="text-center py-20 border-2 border-dashed border-gray-100 rounded-2xl">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300">
                  <PenLine className="w-8 h-8" />
                </div>
                <p className="text-gray-400">暂无章节，开始你的第一章吧</p>
              </div>
            )}
            {chapters.map((chapter, index) => (
              <div 
                key={chapter.id} 
                onClick={() => setSelectedChapter(chapter)}
                className="group p-5 bg-white border border-gray-100 rounded-xl cursor-pointer hover:border-gray-300 hover:shadow-md transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <span className="text-gray-300 font-serif text-lg font-bold italic w-8">
                    {(index + 1).toString().padStart(2, '0')}
                  </span>
                  <div>
                    <h3 className="font-medium text-ink text-lg group-hover:text-blue-600 transition-colors">{chapter.title}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      上次编辑: {new Date(chapter.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-gray-300 rotate-180 group-hover:translate-x-1 transition-transform" />
              </div>
            ))}
          </div>
        </div>
        
        <SettingsPanel 
          novelId={selectedNovel!.id}
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />
      </div>
    );
  }

  // Novel List View (Home)
  return (
    <div className="min-h-screen bg-paper p-6 sm:p-12">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-ink text-white rounded-lg flex items-center justify-center">
              <span className="font-serif font-bold text-xl">M</span>
            </div>
            <h1 className="text-2xl font-serif font-bold text-ink tracking-tight">墨矢</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-ink">{user.email}</p>
              <p className="text-xs text-gray-400">Pro Plan</p>
            </div>
            <button onClick={signOut} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        <div className="mb-12">
          <h2 className="text-4xl font-serif font-bold text-ink mb-6">我的作品</h2>
          <div className="flex gap-3 max-w-xl">
            <input 
              type="text" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="给新书起个名字..." 
              className="flex-1 p-4 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-ink/10 focus:border-ink transition-all shadow-sm"
              onKeyDown={(e) => e.key === 'Enter' && createNovel()}
            />
            <button 
              onClick={createNovel} 
              disabled={!newTitle.trim() || creating}
              className="px-8 bg-ink text-white rounded-xl font-medium hover:opacity-90 disabled:opacity-50 shadow-lg shadow-gray-200 transition-all"
            >
              {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : '新建'}
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {novels.map((novel, index) => (
            <div 
              key={novel.id} 
              onClick={() => setSelectedNovel(novel)}
              className="group relative bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-gray-300 hover:shadow-xl transition-all cursor-pointer h-72 flex flex-col"
            >
              {/* 封面占位 */}
              <div className={`h-32 w-full bg-gradient-to-br ${getGradient(index)} opacity-80 group-hover:opacity-100 transition-opacity`}></div>
              
              <div className="p-6 flex-1 flex flex-col">
                <h3 className="text-xl font-serif font-bold text-ink mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {novel.title}
                </h3>
                <div className="mt-auto flex items-center text-xs text-gray-400">
                  <span className="bg-gray-50 px-2 py-1 rounded text-gray-500">连载中</span>
                  <span className="ml-auto">{new Date(novel.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 辅助函数：生成随机渐变色封面
function getGradient(index: number) {
  const gradients = [
    'from-pink-300 to-rose-300',
    'from-orange-300 to-amber-300',
    'from-emerald-300 to-teal-300',
    'from-cyan-300 to-blue-300',
    'from-indigo-300 to-violet-300',
    'from-fuchsia-300 to-purple-300',
  ];
  return gradients[index % gradients.length];
}

export default App;
