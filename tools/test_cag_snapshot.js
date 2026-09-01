const { execSync } = require('child_process');
const { buildCagSnapshot, getActiveSnapshot } = require('./hr_cag_snapshot_builder');

function runPsqlJson(sqlQuery) {
  const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${sqlQuery}) t;`;
  const result = execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(jsonWrapped, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'null') return [];
  return JSON.parse(trimmed);
}

function runPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('         HR CAG SNAPSHOT VERIFICATION SUITE         ');
  console.log('====================================================\n');

  // Reset snapshots table for clean test lifecycle
  console.log('Clearing hr.policy_snapshot for clean lifecycle test...');
  runPsql('TRUNCATE TABLE hr.policy_snapshot;');

  // --- TEST 1: Initial Run (snapshot_version = 1) ---
  console.log('\n--- TEST 1: Initial Snapshot Creation ---');
  const res1 = await buildCagSnapshot();
  console.log(`Action: ${res1.action}, Version: ${res1.snapshot_version}, Policy Count: ${res1.policy_count}`);
  const active1 = getActiveSnapshot();
  const test1Pass = (res1.action === 'CREATED' && res1.snapshot_version === 1 && active1 && active1.snapshot_version === 1 && active1.is_active === true && active1.policy_count === 100);
  console.log(`Test 1 Result (Version 1 Created & Active): ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  // --- TEST 2: Idempotency (Second run with no changes) ---
  console.log('\n--- TEST 2: Second Run Without Changes (Idempotency) ---');
  const res2 = await buildCagSnapshot();
  console.log(`Action: ${res2.action}, Version: ${res2.snapshot_version}`);
  const active2 = getActiveSnapshot();
  const allSnapshotsCount2 = runPsqlJson('SELECT COUNT(*)::int AS count FROM hr.policy_snapshot')[0].count;
  const test2Pass = (res2.action === 'SKIPPED' && res2.snapshot_version === 1 && allSnapshotsCount2 === 1 && active2.snapshot_version === 1);
  console.log(`Test 2 Result (Skipped / No duplicate version): ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  // --- TEST 3: Controlled Policy Modification -> Version 2 Created, Version 1 Invalidated ---
  console.log('\n--- TEST 3: Controlled Modification -> Version 2 Creation & Version 1 Invalidation ---');
  // Update HR-001 answer slightly in hr.policy_item
  const originalPolicy = runPsqlJson(`SELECT answer_text, version FROM hr.policy_item WHERE policy_code = 'HR-001'`)[0];
  const modifiedAnswer = originalPolicy.answer_text + ' (Sürüm 2 güncellemesi: Standart mesai saatleri İK portalında teyit edilmiştir.)';
  
  runPsql(`UPDATE hr.policy_item SET answer_text = '${modifiedAnswer.replace(/'/g, "''")}', version = version + 1, updated_at = now() WHERE policy_code = 'HR-001';`);
  console.log('Modified HR-001 in hr.policy_item. Building new snapshot...');

  const res3 = await buildCagSnapshot();
  console.log(`Action: ${res3.action}, Version: ${res3.snapshot_version}, Invalidated Previous: ${res3.invalidated_previous_version}`);

  const active3 = getActiveSnapshot();
  const v1Row = runPsqlJson(`SELECT snapshot_version, is_active, invalidated_at FROM hr.policy_snapshot WHERE snapshot_version = 1`)[0];
  const v2Row = runPsqlJson(`SELECT snapshot_version, is_active, invalidated_at FROM hr.policy_snapshot WHERE snapshot_version = 2`)[0];

  const test3Pass = (
    res3.action === 'CREATED' &&
    res3.snapshot_version === 2 &&
    active3 && active3.snapshot_version === 2 && active3.is_active === true &&
    v1Row && v1Row.is_active === false && v1Row.invalidated_at !== null &&
    v2Row && v2Row.is_active === true && v2Row.invalidated_at === null
  );
  console.log(`Test 3 Result (Version 2 active, Version 1 invalidated): ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  // Revert HR-001 modification to keep original clean data
  runPsql(`UPDATE hr.policy_item SET answer_text = '${originalPolicy.answer_text.replace(/'/g, "''")}', version = ${originalPolicy.version}, updated_at = now() WHERE policy_code = 'HR-001';`);
  console.log('Rebuilt and restored original HR-001 answer.');
  const res3Restore = await buildCagSnapshot();
  console.log(`Restored snapshot version: ${res3Restore.snapshot_version} (action: ${res3Restore.action})`);

  // --- TEST 4: Single Active Snapshot Rule ---
  console.log('\n--- TEST 4: Single Active Snapshot Constraint ---');
  const activeCountRows = runPsqlJson('SELECT COUNT(*)::int AS count FROM hr.policy_snapshot WHERE is_active = true');
  const activeCount = activeCountRows[0].count;
  console.log(`Active snapshot count in DB: ${activeCount}`);
  const test4Pass = (activeCount === 1);
  console.log(`Test 4 Result (Exactly 1 active snapshot): ${test4Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  // --- TEST 5: Policy Count & Item Matching ---
  console.log('\n--- TEST 5: Policy Count & Content Matching ---');
  const currentActiveSnap = getActiveSnapshot();
  const policyMatches = (currentActiveSnap.content.match(/\[POLITIKA_KODU: HR-\d{3}\]/g) || []).length;
  console.log(`Metadata policy_count: ${currentActiveSnap.policy_count}, Parsed block tags in text: ${policyMatches}`);
  const test5Pass = (currentActiveSnap.policy_count === 100 && policyMatches === 100);
  console.log(`Test 5 Result (100 policies matched): ${test5Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  // --- TEST 6: Secret Keys / Real PII Inspection ---
  console.log('\n--- TEST 6: Privacy & PII Inspection ---');
  const content = currentActiveSnap.content;
  const hasSecrets = /(sk-[a-zA-Z0-9]{20,}|password\s*=\s*['"][^'"]+['"]|bearer\s+[a-zA-Z0-9\._-]+|PRIVATE KEY)/i.test(content);
  const hasRealTc = /\b[1-9]\d{10}\b/.test(content);
  const test6Pass = !hasSecrets && !hasRealTc;
  console.log(`Secrets detected: ${hasSecrets}, Real Turkish TC IDs detected: ${hasRealTc}`);
  console.log(`Test 6 Result (No secrets / PII in snapshot): ${test6Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  // --- TEST 7: Physical Preservation of Historical Snapshots ---
  console.log('\n--- TEST 7: Physical Preservation of Historical Snapshots ---');
  const allSnapshots = runPsqlJson('SELECT snapshot_version, is_active, invalidated_at, created_at FROM hr.policy_snapshot ORDER BY snapshot_version ASC');
  console.table(allSnapshots);
  const test7Pass = (allSnapshots.length >= 2);
  console.log(`Total snapshots preserved in DB: ${allSnapshots.length}`);
  console.log(`Test 7 Result (Old versions preserved, not deleted): ${test7Pass ? 'PASSED ✅' : 'FAILED ❌'}`);

  console.log('\n====================================================');
  console.log('                  TEST SUMMARY                      ');
  console.log(`Test 1 (Initial Version 1):          ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Test 2 (Idempotency / Skip):         ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Test 3 (Controlled Update / V2):     ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Test 4 (Single Active Snapshot):     ${test4Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Test 5 (Policy Count 100 Match):     ${test5Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Test 6 (PII / Secrets Safe):         ${test6Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`Test 7 (History Preserved):          ${test7Pass ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('====================================================\n');

  const allPassed = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass && test6Pass && test7Pass;
  return {
    allPassed,
    summary: {
      test1Pass,
      test2Pass,
      test3Pass,
      test4Pass,
      test5Pass,
      test6Pass,
      test7Pass
    }
  };
}

if (require.main === module) {
  runTestSuite().then(res => {
    if (!res.allPassed) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('Test suite error:', err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
