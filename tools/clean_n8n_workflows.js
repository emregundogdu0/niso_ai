const { execSync } = require('child_process');

const dupeIds = [
  'gHkXE8VJzlV57WBp', 'nS0jj9XmDGp3lOHh', 'CxuVcAIyrGZ1WeLf',
  'xAmkMbT6l0d18x6T', 'vTnOzKIMNCqpwFKH', 'Xi5hb6RFGNEbUoyj', 'CbXvZAUKXhp4dqNc'
];

const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const dupeIds = ${JSON.stringify(dupeIds)};

for (const id of dupeIds) {
  try { db.prepare('DELETE FROM shared_workflow WHERE workflowId = ?').run(id); } catch(e){}
  try { db.prepare('DELETE FROM workflow_history WHERE workflowId = ?').run(id); } catch(e){}
  try { db.prepare('DELETE FROM workflow_entity WHERE id = ?').run(id); } catch(e){}
}

const list = db.prepare('SELECT id, name FROM workflow_entity ORDER BY name ASC;').all();
console.log(JSON.stringify(list));
`;

const result = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });

try {
  const wfs = JSON.parse(result.trim());
  console.log('Cleaned n8n workflow list. Total workflows in n8n:', wfs.length);
  wfs.forEach((w, i) => console.log(`${i + 1}. [${w.id}] ${w.name}`));
} catch (e) {
  console.log(result);
}
