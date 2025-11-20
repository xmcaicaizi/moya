import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import VConsole from 'vconsole';

// 修复完成：恢复完整功能
// 仅在开发环境或 URL 带 ?debug=true 时开启调试面板
if (import.meta.env.DEV || new URLSearchParams(window.location.search).get('debug') === 'true') {
  // 延迟初始化 vConsole 确保 DOM 准备就绪
  setTimeout(() => {
    try {
      new VConsole();
    } catch (e) {
      console.error('vConsole failed to load', e);
    }
  }, 0);
}

// 全局错误捕获
window.addEventListener('error', (event) => {
  // 忽略 vConsole 自身的 resize 报错
  if (event.message.includes('ResizeObserver')) return;
  
  console.error("Global Error:", event.error);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
