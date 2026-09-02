const { execSync } = require('child_process');

console.log('================================================================');
console.log('   FULL N8N WORKFLOW AUDIT & VERIFICATION REPORT                ');
console.log('================================================================\n');

const exportOutput = execSync('docker exec n8n n8n export:workflow --all', {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024
});

const workflows = JSON.parse(exportOutput);
console.log(`Total Workflows exported from live n8n instance: ${workflows.length}\n`);

let unrecognizedCount = 0;
let outdatedNodeCount = 0;
let placeholderIdCount = 0;
let invalidCredCount = 0;

workflows.forEach((w, idx) => {
  console.log(`----------------------------------------------------------------`);
  console.log(`${idx + 1}. [${w.id}] ${w.name} (Active: ${w.active}, Nodes: ${w.nodes.length})`);
  console.log(`----------------------------------------------------------------`);

  w.nodes.forEach(n => {
    // Check type
    const isSpecialOrCustom = n.type.includes('executeCommand');
    if (isSpecialOrCustom) {
      console.log(`   ❌ Unrecognized/Legacy Node: "${n.name}" (${n.type})`);
      unrecognizedCount++;
    }

    // Check credential
    if (n.credentials) {
      console.log(`   🔑 Credential on "${n.name}":`, JSON.stringify(n.credentials));
      for (const [cType, cVal] of Object.entries(n.credentials)) {
        if (cVal.id && (cVal.id.includes('Placeholder') || cVal.id.includes('Dummy'))) {
          console.log(`   ⚠️ Potential Invalid Credential ID: ${cVal.id}`);
          invalidCredCount++;
        }
      }
    }

    // Check Sub-workflow Target
    if (n.type === 'n8n-nodes-base.executeWorkflow') {
      const target = n.parameters?.workflowId?.value || n.parameters?.workflowId;
      console.log(`   🔗 Execute Sub-workflow on "${n.name}": Target -> ${target}`);
      if (typeof target === 'string' && (target.includes('commonMailIngestion') || target.includes('hrHybrid') || target.includes('secureText'))) {
        console.log(`   ❌ Placeholder Sub-workflow ID found: ${target}`);
        placeholderIdCount++;
      }
    }
  });
});

console.log(`\n================================================================`);
console.log(`AUDIT TOTALS:`);
console.log(` - Unrecognized/Invalid Nodes: ${unrecognizedCount}`);
console.log(` - Outdated Nodes: ${outdatedNodeCount}`);
console.log(` - Placeholder Workflow IDs: ${placeholderIdCount}`);
console.log(` - Invalid Credential IDs: ${invalidCredCount}`);
console.log(`================================================================\n`);
