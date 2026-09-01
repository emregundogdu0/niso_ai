const { execSync } = require('child_process');
const { generateAttendanceData } = require('./generate_attendance_data');

function runPsqlJson(sqlQuery) {
  const cleanQuery = sqlQuery.trim().replace(/;+$/, '');
  const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${cleanQuery}) t;`;
  const result = execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(jsonWrapped, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'null') return [];
  return JSON.parse(trimmed);
}

async function runQualitySuite() {
  console.log('================================================================');
  console.log('       PHASE 08: ATTENDANCE QUALITY & VALIDATION TEST SUITE     ');
  console.log('================================================================\n');

  let passedTests = 0;
  const totalTests = 7;

  // TEST 1: Duplicate Event Check
  console.log('--- TEST 1: Duplicate Event Check ---');
  const dupes = runPsqlJson(`
    SELECT employee_id, event_time, event_type, COUNT(*) as cnt
    FROM attendance.event
    GROUP BY employee_id, event_time, event_type
    HAVING COUNT(*) > 1;
  `);
  const t1Passed = (dupes.length === 0);
  console.log(`Duplicate Event Count: ${dupes.length} -> ${t1Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t1Passed) passedTests++;

  // TEST 2: IN / OUT Chronological Consistency
  console.log('\n--- TEST 2: IN/OUT Chronological Consistency ---');
  const invalidChrono = runPsqlJson(`
    SELECT day, employee_no, first_in, last_out
    FROM attendance.daily_summary
    WHERE first_in IS NOT NULL AND last_out IS NOT NULL AND first_in > last_out;
  `);
  const t2Passed = (invalidChrono.length === 0);
  console.log(`Inverted Chronology Rows: ${invalidChrono.length} -> ${t2Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t2Passed) passedTests++;

  // TEST 3: Scenario Coverage
  console.log('\n--- TEST 3: Scenario Coverage (Late, Leave, Remote, Missing, Absent) ---');
  const scenarios = runPsqlJson(`
    SELECT 
      COUNT(CASE WHEN status = 'LATE' THEN 1 END) AS late_rows,
      COUNT(CASE WHEN status = 'ON_LEAVE' THEN 1 END) AS leave_rows,
      COUNT(CASE WHEN status = 'REMOTE' THEN 1 END) AS remote_rows,
      COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) AS absent_rows,
      COUNT(CASE WHEN missing_checkout = true THEN 1 END) AS missing_out_rows
    FROM attendance.daily_summary;
  `)[0];
  console.log('Scenario Counts:', scenarios);
  const t3Passed = (
    scenarios.late_rows > 10 &&
    scenarios.leave_rows > 10 &&
    scenarios.remote_rows > 10 &&
    scenarios.absent_rows > 5 &&
    scenarios.missing_out_rows > 5
  );
  console.log(`Scenario Diversity Check -> ${t3Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t3Passed) passedTests++;

  // TEST 4: Leave Protection (Leave employees must NEVER have late_minutes)
  console.log('\n--- TEST 4: Approved Leave Protection ---');
  const leakLeave = runPsqlJson(`
    SELECT day, employee_no, late_minutes, status, exception_types
    FROM attendance.daily_summary
    WHERE has_approved_exception = true AND late_minutes > 0;
  `);
  const t4Passed = (leakLeave.length === 0);
  console.log(`Approved Leave Records with Late Minutes: ${leakLeave.length} -> ${t4Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t4Passed) passedTests++;

  // TEST 5: Holiday Protection
  console.log('\n--- TEST 5: Official Holiday Protection ---');
  const leakHoliday = runPsqlJson(`
    SELECT day, employee_no, late_minutes, status
    FROM attendance.daily_summary
    WHERE is_holiday = true AND (late_minutes > 0 OR status = 'LATE' OR status = 'ABSENT');
  `);
  const t5Passed = (leakHoliday.length === 0);
  console.log(`Holiday Records with LATE/ABSENT: ${leakHoliday.length} -> ${t5Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t5Passed) passedTests++;

  // TEST 6: Hand-Calculated Late Minutes Verification
  console.log('\n--- TEST 6: Late Minutes Formula Verification ---');
  const sampleLate = runPsqlJson(`
    SELECT 
      day, employee_no, first_in, shift_start, grace_minutes, late_minutes,
      ROUND(EXTRACT(EPOCH FROM (first_in - ((day::text || ' ' || shift_start::text || ' Europe/Istanbul')::timestamptz + (grace_minutes || ' minutes')::interval))) / 60)::integer AS hand_calculated
    FROM attendance.daily_summary
    WHERE status = 'LATE'
    LIMIT 5;
  `);
  let t6Passed = (sampleLate.length > 0);
  for (const s of sampleLate) {
    if (s.late_minutes !== s.hand_calculated) {
      t6Passed = false;
      console.log(`Mismatch on ${s.employee_no} ${s.day}: DB=${s.late_minutes}, Calc=${s.hand_calculated}`);
    }
  }
  console.log(`Sample Late Calculations (5 sample rows):`, sampleLate.map(s => ({
    emp: s.employee_no,
    day: s.day,
    db_late: s.late_minutes,
    calc_late: s.hand_calculated,
    match: s.late_minutes === s.hand_calculated
  })));
  console.log(`Late Calculation Precision -> ${t6Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t6Passed) passedTests++;

  // TEST 7: Idempotency (Second Run does not duplicate rows)
  console.log('\n--- TEST 7: Idempotency Verification (Re-running Generator) ---');
  const beforeCount = runPsqlJson(`
    SELECT 
      (SELECT COUNT(*) FROM attendance.employee) as employees,
      (SELECT COUNT(*) FROM attendance.event) as events,
      (SELECT COUNT(*) FROM attendance.exception) as exceptions;
  `)[0];

  // Re-run generator
  await generateAttendanceData(42);

  const afterCount = runPsqlJson(`
    SELECT 
      (SELECT COUNT(*) FROM attendance.employee) as employees,
      (SELECT COUNT(*) FROM attendance.event) as events,
      (SELECT COUNT(*) FROM attendance.exception) as exceptions;
  `)[0];

  const t7Passed = (
    beforeCount.employees === afterCount.employees &&
    beforeCount.events === afterCount.events &&
    beforeCount.exceptions === afterCount.exceptions
  );
  console.log('Before Counts:', beforeCount);
  console.log('After Counts: ', afterCount);
  console.log(`Idempotency Check (Counts Unchanged) -> ${t7Passed ? 'PASSED ✅' : 'FAILED ❌'}`);
  if (t7Passed) passedTests++;

  console.log('\n================================================================');
  console.log('                    QUALITY SUITE SUMMARY                       ');
  console.log('================================================================');
  console.log(`Total Quality Tests: ${totalTests}`);
  console.log(`Passed Tests: ${passedTests} / ${totalTests}`);
  console.log(`Status: ${passedTests === totalTests ? 'ALL PASSED ✅' : 'SOME FAILED ❌'}`);
  console.log('================================================================\n');

  return {
    total: totalTests,
    passed: passedTests,
    success: passedTests === totalTests
  };
}

if (require.main === module) {
  runQualitySuite().then(res => {
    if (!res.success) process.exit(1);
  }).catch(err => {
    console.error('Fatal quality test error:', err);
    process.exit(1);
  });
}

module.exports = { runQualitySuite };
