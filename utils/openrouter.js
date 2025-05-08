// utils/openRouter.js
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = process.env.OPENROUTER_API_KEY; // store in .env

const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'; // or another free one from OpenRouter

export const classifyAndSummarizeEmail = async (emailBody) => {
  const prompt = `
You are a support ticket assistant.

Given the email body below, respond only with a JSON object containing the following fields:
{
  "team": one of "Billing", "Tech Support", "Sales", "HR", or "IT",
  "priority": an integer from 1 (highest) to 5 (lowest),
  "subject": a short title describing the issue,
  "summary": a one-sentence summary of the issue
}

Email body:
"""${emailBody}"""
`;

  try {
    const res = await axios.post(API_URL, {
      model: MODEL,
      messages: [
        { role: 'user', content: prompt }
      ],
    }, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const raw = res.data.choices[0].message.content;
    const cleaned = raw.replace(/```json|```/g, '').trim();

    return JSON.parse(cleaned);
    // return JSON.parse(content);
} catch (err) {
    console.error('OpenRouter API error:', err.response?.data || err.message);
    throw err;
  }
};
