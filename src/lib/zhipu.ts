import { SignJWT } from 'jose';

const API_KEY = import.meta.env.VITE_ZHIPU_API_KEY;

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
  onChunk: (text: string) => void,
  onError: (err: any) => void
) => {
  if (!API_KEY) {
    console.warn("Mocking AI response due to missing API Key");
    const mockText = "（AI Mock 生成内容）随着一阵剧烈的震动，飞船缓缓驶入了星港。眼前的景象令人惊叹...（请配置 VITE_ZHIPU_API_KEY 以使用真实 AI）";
    const chars = mockText.split('');
    for (const char of chars) {
      await new Promise(r => setTimeout(r, 50)); // Simulate typing
      onChunk(char);
    }
    return;
  }

  try {
    const token = await generateToken();
    
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
          { role: 'user', content: context }
        ],
        stream: true,
        temperature: 0.7,
        top_p: 0.9
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
    console.error("AI Generation Failed:", err);
    onError(err);
  }
};

