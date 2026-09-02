const { execSync } = require('child_process');

function getWorkflows() {
  const output = execSync('docker exec n8n n8n export:workflow --all', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  return JSON.parse(output);
}

const wfs = getWorkflows();
console.log('--- ALL WORKFLOWS CURRENTLY IN N8N ---');
console.log('Total count:', wfs.length);
wfs.forEach((w, idx) => {
  console.log(`${idx + 1}. [${w.id}] ${w.name} (Active: ${w.active})`);
});
