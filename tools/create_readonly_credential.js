const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ID = 'DGu4CJhdcNhB2Rjx';

const cred = [
  {
    id: 'postgresChatbotReadOnly01',
    name: 'PostgreSQL Chatbot ReadOnly',
    type: 'postgres',
    data: {
      host: 'management-postgres',
      database: 'management_ai',
      user: 'chatbot_reader',
      password: 'chatbot_read_2026_pass',
      port: 5432,
      ssl: 'disable'
    }
  }
];

execSync('docker exec -i n8n sh -c "cat > /tmp/chatbot_reader_cred.json"', {
  input: Buffer.from(JSON.stringify(cred, null, 2), 'utf8')
});

const res = execSync(`docker exec n8n n8n import:credentials --input=/tmp/chatbot_reader_cred.json --projectId=${PROJECT_ID}`, {
  encoding: 'utf8'
});
console.log(res);

// List credentials in SQLite to find the new ID
const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const creds = db.prepare('SELECT id, name, type FROM credentials_entity ORDER BY createdAt ASC;').all();
console.log(JSON.stringify(creds));
`;
const listOut = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
console.log('Credentials currently in n8n:', JSON.parse(listOut.trim()));
