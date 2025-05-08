import fs from 'fs';
import path from 'path';
import { authenticate } from '@google-cloud/local-auth';
import { google } from 'googleapis';
import { simpleParser } from 'mailparser';

const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'credentials.json');

// Load saved token or authenticate
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.promises.readFile(TOKEN_PATH, 'utf8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch {
    return null;
  }
}

async function saveCredentials(client) {
  const credentials = JSON.parse(await fs.promises.readFile(CREDENTIALS_PATH, 'utf8'));
  const key = credentials.installed || credentials.web;
  const payload = JSON.stringify({
    type: 'authorized_user',
    client_id: key.client_id,
    client_secret: key.client_secret,
    refresh_token: client.credentials.refresh_token,
  });
  await fs.promises.writeFile(TOKEN_PATH, payload);
}

async function authorize() {
  let client = await loadSavedCredentialsIfExist();
  if (client) return client;
  client = await authenticate({
    scopes: ['https://www.googleapis.com/auth/gmail.modify'],
    keyfilePath: CREDENTIALS_PATH,
  });
  await saveCredentials(client);
  return client;
}

// Fetch and parse unread emails
async function fetchEmails() {
  const auth = await authorize();
  const gmail = google.gmail({ version: 'v1', auth });

  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'in:inbox is:unread category:primary',
    maxResults: 10,
  });

  const messages = res.data.messages || [];
  const emails = [];

  for (const msg of messages) {
    const msgRes = await gmail.users.messages.get({
      userId: 'me',
      id: msg.id,
      format: 'raw',
    });

    const raw = msgRes.data.raw;
    const buffer = Buffer.from(raw, 'base64');
    const parsed = await simpleParser(buffer);

    const from = parsed.from?.value?.[0]?.address || 'unknown';
    const body = parsed.text?.trim() || '';

    emails.push({ sender: from, body });

    // ✅ Mark message as read
    gmail.users.messages.modify({
        userId: 'me',
        id: msg.id,
        requestBody: {
        removeLabelIds: ['UNREAD'],
        },
    });
  }

  return emails;
}

export default fetchEmails;
