import dotenv from 'dotenv';
import fetchEmails from './utils/fetchEmails.js';

dotenv.config();

(async () => {
  try {
    const emails = await fetchEmails();
    console.log('📨 Fetched emails:', emails);
  } catch (err) {
    console.error('❌ Fetch failed:', err.message);
  }
})();
