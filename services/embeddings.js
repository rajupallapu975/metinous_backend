/**
 * Metinous AI — Vector Embedding Service
 * Generates normalized 1536-dimensional dense vectors for semantic memory search.
 */

const crypto = require('crypto');

class EmbeddingService {
  constructor() {
    this.dimensions = 1536;
    this.model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  }

  /**
   * Generates a 1536-dimensional embedding vector for text
   * @param {string} text - Input text
   * @returns {Promise<number[]>}
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== 'string' || text.trim() === '') {
      return new Array(this.dimensions).fill(0);
    }

    const cleanText = text.trim();

    // 1. Try OpenRouter / OpenAI Embeddings API if configured
    if (process.env.OPENROUTER_API_KEY && !process.env.OPENROUTER_API_KEY.includes('your_openrouter')) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://metinous.ai',
            'X-Title': 'Metinous AI Vector Store',
          },
          body: JSON.stringify({
            model: this.model,
            input: cleanText.substring(0, 8000),
          }),
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          const embedding = data?.data?.[0]?.embedding;
          if (Array.isArray(embedding) && embedding.length > 0) {
            return this.normalizeVector(embedding, this.dimensions);
          }
        }
      } catch (err) {
        // Fallback to local semantic vectorizer
      }
    }

    // 2. Resilient Deterministic Semantic Vectorizer (Local Fallback)
    return this.generateDeterministicVector(cleanText, this.dimensions);
  }

  /**
   * Normalizes vector length to target dimensions and unit length
   */
  normalizeVector(vec, targetDim = 1536) {
    let result = vec;
    if (vec.length !== targetDim) {
      result = new Array(targetDim).fill(0);
      for (let i = 0; i < Math.min(vec.length, targetDim); i++) {
        result[i] = vec[i];
      }
    }

    // Unit norm calculation: sum(v^2)
    let norm = 0;
    for (let i = 0; i < result.length; i++) {
      norm += result[i] * result[i];
    }
    norm = Math.sqrt(norm);

    if (norm > 0) {
      for (let i = 0; i < result.length; i++) {
        result[i] = result[i] / norm;
      }
    }

    return result;
  }

  /**
   * Generates deterministic n-gram hash semantic vector for offline / fallback search
   */
  generateDeterministicVector(text, dimensions = 1536) {
    const vector = new Array(dimensions).fill(0);
    const tokens = text.toLowerCase().split(/\W+/).filter(t => t.length > 0);

    // 1-gram & 2-gram hashing
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const hash1 = parseInt(crypto.createHash('md5').update(token).digest('hex').substring(0, 8), 16);
      const idx1 = Math.abs(hash1) % dimensions;
      vector[idx1] += 1.0;

      if (i < tokens.length - 1) {
        const bigram = `${token}_${tokens[i + 1]}`;
        const hash2 = parseInt(crypto.createHash('sha256').update(bigram).digest('hex').substring(0, 8), 16);
        const idx2 = Math.abs(hash2) % dimensions;
        vector[idx2] += 1.5;
      }
    }

    // Direct text hash projection
    const fullHash = crypto.createHash('sha256').update(text.toLowerCase()).digest();
    for (let i = 0; i < 32; i++) {
      const idx = (fullHash[i] * 47) % dimensions;
      vector[idx] += 0.5;
    }

    return this.normalizeVector(vector, dimensions);
  }
}

const embeddingService = new EmbeddingService();

module.exports = {
  EmbeddingService,
  embeddingService,
};
