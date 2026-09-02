const { execSync } = require('child_process');

const script = `
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('/home/node/.n8n/database.sqlite');
const workflows = db.prepare('SELECT id, name, nodes, connections, active FROM workflow_entity ORDER BY name ASC;').all();

const report = [];

workflows.forEach(w => {
  const nodes = JSON.parse(w.nodes || '[]');
  const conns = JSON.parse(w.connections || '{}');
  
  const nodeSummary = nodes.map(n => ({
    name: n.name,
    type: n.type,
    version: n.typeVersion,
    creds: n.credentials,
    subwf: n.parameters?.workflowId?.value || n.parameters?.workflowId
  }));

  report.push({
    id: w.id,
    name: w.name,
    active: Boolean(w.active),
    nodeCount: nodes.length,
    nodes: nodeSummary
  });
});

console.log(JSON.stringify(report));
`;

const res = execSync('docker exec -i n8n node --experimental-sqlite -e "' + script.replace(/"/g, '\\"').replace(/\n/g, ' ') + '"', {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024
});

const report = JSON.parse(res);
report.forEach(w => {
  console.log(`\n========================================================`);
  console.log(`[${w.id}] ${w.name} (Nodes: ${w.nodeCount}, Active: ${w.active})`);
  console.log(`========================================================`);
  w.nodes.forEach(n => {
    console.log(` - Node: "${n.name}" | Type: ${n.type} (v${n.version})`);
    if (n.creds) console.log(`   Credentials:`, JSON.stringify(n.creds));
    if (n.subwf) console.log(`   Sub-workflow Target:`, JSON.stringify(n.subwf));
  });
});
