import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

async function testQuotaApi() {
  const authFile = path.join(os.homedir(), '.ccs', 'cliproxy', 'auth', 'antigravity-etiksilawati21@gmail.com.json');
  if (!fs.existsSync(authFile)) {
    console.log('File not found');
    return;
  }
  const data = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
  const token = data.access_token;
  if (!token) {
    console.log('No access token');
    return;
  }

  // Test retrieveUserQuotaSummary
  const endpoints = [
    'https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuotaSummary',
    'https://cloudcode-pa.googleapis.com/v1internal:fetchAvailableModels',
  ];

  for (const url of endpoints) {
    try {
      console.log('Testing endpoint:', url);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'antigravity/1.0.0',
        },
        body: JSON.stringify({}),
      });
      console.log('Status:', res.status, res.statusText);
      const text = await res.text();
      // Mask any tokens in output
      console.log('Response body:', text.slice(0, 500));
    } catch (e) {
      console.error('Error for', url, e.message);
    }
  }
}

testQuotaApi();

