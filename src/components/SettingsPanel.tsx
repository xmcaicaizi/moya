import { useState, useEffect } from 'react';
import { X, Plus, Trash2, User, Map, Box, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import EmbeddingService from '../lib/embedding';

interface SettingsPanelProps {
  novelId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface SettingItem {
  id: string;
  content: string; // 存储设定的具体描述
  metadata: {
    type: 'character' | 'world' | 'item';
    name: string;
  };
}

const SettingsPanel = ({ novelId, isOpen, onClose }: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<'character' | 'world' | 'item'>('character');
  const [items, setItems] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  // 新建表单状态
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // 加载设定
  useEffect(() => {
    if (isOpen && novelId) {
      fetchSettings();
    }
  }, [isOpen, novelId, activeTab]);

  const fetchSettings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('novel_id', novelId)
      .contains('metadata', { type: activeTab }); // 利用 JSONB 查询
    
    if (data) {
      setItems(data.map(d => ({
        id: d.id,
        content: d.content,
        metadata: d.metadata
      })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newName || !newDesc) return;
    setIsCreating(true);

    try {
      // 1. 计算向量（让 AI 能搜到这个设定）
      // 组合文本：【角色】张三：他是一个...
      const fullText = `【${activeTab === 'character' ? '角色' : activeTab === 'world' ? '世界观' : '物品'}】${newName}：${newDesc}`;
      const vector = await EmbeddingService.getEmbedding(fullText);

      // 2. 存入数据库
      const { error } = await supabase.from('documents').insert({
        novel_id: novelId,
        content: fullText,
        embedding: vector,
        metadata: {
          type: activeTab,
          name: newName
        }
      });

      if (error) throw error;

      // 3. 刷新列表
      setNewName('');
      setNewDesc('');
      fetchSettings();
    } catch (err) {
      console.error(err);
      alert('创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此设定吗？')) return;
    await supabase.from('documents').delete().eq('id', id);
    fetchSettings();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl transform transition-transform z-50 flex flex-col border-l">
      {/* Header */}
      <div className="p-4 border-b flex justify-between items-center bg-gray-50">
        <h2 className="font-bold text-lg flex items-center gap-2">
          📚 设定集
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-gray-200 rounded-full">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex p-2 gap-2 border-b">
        {[
          { id: 'character', icon: User, label: '角色' },
          { id: 'world', icon: Map, label: '世界' },
          { id: 'item', icon: Box, label: '物品' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm rounded-lg transition-colors
              ${activeTab === tab.id ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">暂无设定，快去添加吧</div>
        ) : (
          items.map(item => (
            <div key={item.id} className="p-3 border rounded-lg hover:border-black transition group relative">
              <h3 className="font-bold text-sm mb-1">{item.metadata.name}</h3>
              <p className="text-xs text-gray-600 line-clamp-3">{item.content.split('：')[1]}</p>
              <button 
                onClick={() => handleDelete(item.id)}
                className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Create Form */}
      <div className="p-4 border-t bg-gray-50">
        <div className="space-y-3">
          <input 
            placeholder="名称 (如: 萧炎)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="w-full p-2 border rounded text-sm"
          />
          <textarea 
            placeholder="描述 (如: 这是一个性格坚毅的少年...)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="w-full p-2 border rounded text-sm h-24 resize-none"
          />
          <button 
            onClick={handleCreate}
            disabled={isCreating || !newName}
            className="w-full py-2 bg-black text-white rounded-lg text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
          >
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            添加设定
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;

