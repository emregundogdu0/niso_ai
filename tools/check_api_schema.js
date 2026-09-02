const { execSync } = require('child_process');

const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const schema = db.prepare("SELECT sql FROM sqlite_master WHERE name='user_api_keys';").get();
console.log(schema?.sql);
`;

const res = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
console.log(res);
