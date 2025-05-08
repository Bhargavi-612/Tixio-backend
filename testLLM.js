import dotenv from 'dotenv';
import { classifyAndSummarizeEmail } from './utils/openrouter.js';

dotenv.config();

const sampleEmail = `
Hi team,

I’ve been charged twice on my invoice for April and I’d like a refund for the duplicate payment.

Thanks,
John
`;

(async () => {
  try {
    const result = await classifyAndSummarizeEmail(sampleEmail);
    console.log('LLM Output:', result);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
