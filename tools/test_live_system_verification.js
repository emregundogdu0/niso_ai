const http = require('http');
const { execSync } = require('child_process');

async function queryOllamaEmbedding(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: 'qwen3-embedding:0.6b', prompt: text });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/embeddings',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function queryOllamaChat(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ model: 'qwen3.5:9b', prompt: prompt, stream: false });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function runLiveVerification() {
  console.log('================================================================');
  console.log('  LIVE ENVIRONMENT & WORKFLOW INTEGRATION VERIFICATION SUITE    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assertTest(name, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`[PASS] ${name} ${details ? '-> ' + details : ''}`);
    } else {
      console.error(`[FAIL] ${name} ${details ? '-> ' + details : ''}`);
    }
  }

  // 1. Ollama Health & Models
  try {
    const tagsRes = execSync('curl -s http://localhost:11434/api/tags', { encoding: 'utf8' });
    const tags = JSON.parse(tagsRes);
    const modelNames = tags.models.map(m => m.name);
    assertTest('Ollama Tags API', modelNames.includes('qwen3.5:9b') && modelNames.includes('qwen3-embedding:0.6b'), `Models: ${modelNames.join(', ')}`);
    
    const emb = await queryOllamaEmbedding('Eldor NISO AI Test');
    assertTest('Ollama Embedding 1024-dim', emb.embedding && emb.embedding.length === 1024, `Dim: ${emb.embedding?.length}`);

    const chat = await queryOllamaChat('Merhaba');
    assertTest('Ollama Qwen3.5-9B Generation', chat.response && chat.response.length > 0, `Response length: ${chat.response?.length}`);
  } catch (e) {
    assertTest('Ollama Healthcheck', false, e.message);
  }

  // 2. PostgreSQL & PGVector
  try {
    const pgRes = execSync('docker exec management-postgres psql -U management_admin -d management_ai -t -c "SELECT extname, extversion FROM pg_extension WHERE extname = \'vector\';"', { encoding: 'utf8' });
    assertTest('PostgreSQL pgvector Extension', pgRes.includes('vector'), pgRes.trim());

    const rolesRes = execSync('docker exec management-postgres psql -U management_admin -d management_ai -t -c "SELECT rolname, rolsuper, rolconfig FROM pg_roles WHERE rolname = \'chatbot_reader\';"', { encoding: 'utf8' });
    assertTest('PostgreSQL chatbot_reader Role', rolesRes.includes('chatbot_reader') && rolesRes.includes('statement_timeout=3000ms'), rolesRes.trim());
  } catch (e) {
    assertTest('PostgreSQL Checks', false, e.message);
  }

  // 3. n8n Workflow Count & Linkages
  try {
    const wfRes = execSync('node tools/audit_live_n8n_export.js', { encoding: 'utf8' });
    assertTest('n8n Zero Invalid/Unrecognized Nodes', wfRes.includes('Unrecognized/Invalid Nodes: 0'));
    assertTest('n8n Zero Outdated Nodes', wfRes.includes('Outdated Nodes: 0'));
    assertTest('n8n Zero Placeholder Sub-workflow IDs', wfRes.includes('Placeholder Workflow IDs: 0'));
    assertTest('n8n Zero Invalid Credential IDs', wfRes.includes('Invalid Credential IDs: 0'));
  } catch (e) {
    assertTest('n8n Workflow Audit', false, e.message);
  }

  // 4. UI Server Healthcheck
  try {
    const uiRes = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:3000', res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve({ code: res.statusCode, body: d }));
      }).on('error', reject);
    });
    assertTest('UI Server Endpoint (HTTP 200)', uiRes.code === 200 && uiRes.body.includes('Yönetim Bilgi Asistanı'), `Status: ${uiRes.code}`);
  } catch (e) {
    assertTest('UI Server Endpoint', false, e.message);
  }

  console.log('\n================================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} / ${total} Checks Passed (${Math.round(passed/total*100)}%)`);
  console.log('================================================================\n');
}

runLiveVerification().catch(console.error);
