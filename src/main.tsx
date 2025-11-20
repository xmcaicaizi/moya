import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 全局错误捕获，防止白屏
window.addEventListener('error', (event) => {
  document.body.innerHTML = `
    <div style="padding: 20px; color: red; font-family: sans-serif;">
      <h1>Global Error Caught</h1>
      <pre>${event.error?.message || event.message}</pre>
      <pre>${event.error?.stack || ''}</pre>
    </div>
  `;
});

window.addEventListener('unhandledrejection', (event) => {
    document.body.innerHTML = `
      <div style="padding: 20px; color: red; font-family: sans-serif;">
        <h1>Unhandled Promise Rejection</h1>
        <pre>${event.reason?.message || event.reason}</pre>
        <pre>${event.reason?.stack || ''}</pre>
      </div>
    `;
  });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
