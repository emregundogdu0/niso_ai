const { execSync } = require('child_process');
const crypto = require('crypto');

const apiKeyFromEnv = process.env.N8N_API_KEY || '';
if (!apiKeyFromEnv) {
  console.error('Set N8N_API_KEY env var before running this script.');
  process.exit(1);
}

const script = `
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');

const existing = db.prepare("SELECT * FROM user_api_keys WHERE label = 'Automated Verification';").get();
let apiKey = ${JSON.stringify(apiKeyFromEnv)};

if (!existing) {
  const id = crypto.randomUUID();
  db.prepare("INSERT INTO user_api_keys (id, userId, label, apiKey, audience) VALUES (?, 'b471573d-5395-4f2b-a018-27ba1d32879a', 'Automated Verification', ?, 'public-api')")
    .run(id, apiKey);
  console.log('Created API Key in n8n (from N8N_API_KEY env).');
} else {
  console.log('Automated Verification API key already exists in n8n; leaving untouched.');
}
`;

const res = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
console.log(res);
