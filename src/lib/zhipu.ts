import { SignJWT } from 'jose';
import { logger } from './logger';

const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;
export const isZhipuConfigured = Boolean(API_KEY && API_KEY.includes('.'));

// 1. 浏览器端生成 JWT (HS256)
const generateToken = async () => {
  if (!API_KEY) throw new Error("Missing VITE_ZHIPU_API_KEY in .env");
  
  const [id, secret] = API_KEY.split('.');
  if (!id || !secret) throw new Error("Invalid Zhipu API Key format");

  const now = Date.now();
  
  // Zhipu 要求: alg=HS256, sign_type=SIGN
  return new SignJWT({
    api_key: id,
    timestamp: now,
    exp: now + 3600 * 1000 // 1小时过期
  })
    .setProtectedHeader({ alg: 'HS256', sign_type: 'SIGN' })
    .sign(new TextEncoder().encode(secret));
};

// 2. 流式请求核心逻辑
export const streamCompletion = async (
  context: string,
  instruction: string | null,
  onChunk: (text: string) => void,
  onError: (err: any) => void,
  thinking?: { type: 'enabled' | 'disabled' }
) => {
  if (!API_KEY) {
    const err = new Error("Missing VITE_ZHIPU_API_KEY. 请在 .env 中配置真实的智谱 API Key。");
    logger.error('ai', err.message);
    onError(err);
    return;
  }

  try {
    const token = await generateToken();
    
    // 构造用户 Prompt
    let userContent = context;
    if (instruction) {
      userContent = `【上文内容】：\n${context}\n\n【续写指令】：\n${instruction}\n\n请根据上文内容和续写指令，继续写一段故事。`;
    }

    const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'glm-4.5-flash', // 免费且快速
        messages: [
          { 
            role: 'system', 
            content: '你是一个专业的小说续写助手。请根据用户提供的上文，续写一段情节。风格要保持一致，富有画面感。不要重复上文内容。' 
          },
          { role: 'user', content: userContent }
        ],
        stream: true,
        temperature: 0.7,
        top_p: 0.9,
        thinking: thinking
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`API Error: ${response.status} - ${errText}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim().startsWith('data:')) {
          const jsonStr = line.replace('data:', '').trim();
          if (jsonStr === '[DONE]') return;

          try {
            const json = JSON.parse(jsonStr);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              onChunk(delta);
            }
          } catch (e) {
            console.warn("JSON Parse Error:", e);
          }
        }
      }
    }
  } catch (err) {
    logger.error('ai', 'AI Generation Failed', err);
    onError(err);
  }
};

