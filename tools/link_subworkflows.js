const { execSync } = require('child_process');

const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');

const routerId = 'm3C576WsNJ765h0S';
const hrId = 'X48s6TzlpKpVNu2w';
const sqlId = 'DowKEdcS2nQbR1wc';
const mailId = 'aopNq0brScuCKrU7';
const hybridId = 'uSevqGz9uojM7OM7';
const commonIngestionId = 'a4o1zq8xsRaRQv7b';
const gmailId = 'HZZQ0Ck54VYbfWx6';
const outlookId = 'Tol7bGYEacspOQzs';

// 1. Update Router
const router = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(routerId);
if (router) {
  const nodes = JSON.parse(router.nodes);
  nodes.forEach(n => {
    if (n.name === 'Execute Sub-Workflow HR Hybrid' && n.parameters?.workflowId) n.parameters.workflowId.value = hrId;
    if (n.name === 'Execute Sub-Workflow Attendance SQL' && n.parameters?.workflowId) n.parameters.workflowId.value = sqlId;
    if (n.name === 'Execute Sub-Workflow Project Mail RAG' && n.parameters?.workflowId) n.parameters.workflowId.value = mailId;
    if (n.name === 'Execute Sub-Workflow Hybrid Evidence Merger' && n.parameters?.workflowId) n.parameters.workflowId.value = hybridId;
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), routerId);
  console.log('Router linked.');
}

// 2. Update Gmail Source
const gmail = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(gmailId);
if (gmail) {
  const nodes = JSON.parse(gmail.nodes);
  nodes.forEach(n => {
    if (n.parameters?.workflowId) n.parameters.workflowId.value = commonIngestionId;
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), gmailId);
  console.log('Gmail linked.');
}

// 3. Update Outlook Source
const outlook = db.prepare('SELECT nodes FROM workflow_entity WHERE id = ?').get(outlookId);
if (outlook) {
  const nodes = JSON.parse(outlook.nodes);
  nodes.forEach(n => {
    if (n.parameters?.workflowId) n.parameters.workflowId.value = commonIngestionId;
  });
  db.prepare('UPDATE workflow_entity SET nodes = ? WHERE id = ?').run(JSON.stringify(nodes), outlookId);
  console.log('Outlook linked.');
}
`;

const res = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', { encoding: 'utf8' });
console.log(res);
