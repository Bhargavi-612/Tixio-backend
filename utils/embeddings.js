import { pipeline } from '@huggingface/transformers';

// Create a feature-extraction pipeline
const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');

export const getEmbedding = async (text) => {
    const [embedding] = await extractor(text, { pooling: 'mean', normalize: true });
    return embedding;
  };