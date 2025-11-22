import { pipeline, env } from '@xenova/transformers';

// 允许从 CDN 加载模型 (默认)
env.allowLocalModels = false;
// 如果在国内下载慢，可以尝试配置 HF 镜像，但 Transformers.js 默认走 fastly CDN
// env.useBrowserCache = true;

class EmbeddingService {
  static instance: any = null;
  static modelName = 'Xenova/all-MiniLM-L6-v2';

  // 单例模式获取 pipeline
  static async getInstance() {
    if (!this.instance) {
      console.log('⏳ Loading embedding model...');
      this.instance = await pipeline('feature-extraction', this.modelName);
      console.log('✅ Model loaded');
    }
    return this.instance;
  }

  // 生成文本向量
  static async getEmbedding(text: string): Promise<number[]> {
    const extractor = await this.getInstance();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // 将 Tensor 转换为普通数组
    return Array.from(output.data);
  }
}

export default EmbeddingService;

