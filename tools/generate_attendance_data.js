const { execSync } = require('child_process');

function runPsql(sql) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sql, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024
  });
}

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

// Deterministic PRNG (Mulberry32)
function createPrng(seed = 42) {
  let s = seed >>> 0;
  return function() {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function generateAttendanceData(seed = 42) {
  console.log(`=== GENERATING DETERMINISTIC ATTENDANCE DATASET (SEED: ${seed}) ===\n`);
  const prng = createPrng(seed);

  // 1. Setup Shifts
  console.log('1. Inserting/Verifying Shifts...');
  const shiftsSql = `
    INSERT INTO attendance.shift (name, start_time, end_time, grace_minutes, is_night_shift)
    VALUES 
      ('Gündüz Standart', '08:30:00', '17:30:00', 15, false),
      ('Fabrika Vardiya-1 (Sabah)', '07:00:00', '15:00:00', 10, false),
      ('Fabrika Vardiya-2 (Akşam)', '15:00:00', '23:00:00', 10, false),
      ('Fabrika Gece Vardiyası', '23:00:00', '07:00:00', 10, true)
    ON CONFLICT (name) DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      grace_minutes = EXCLUDED.grace_minutes,
      is_night_shift = EXCLUDED.is_night_shift;
  `;
  runPsql(shiftsSql);
  const shifts = runPsqlJson('SELECT id, name, start_time, end_time, grace_minutes, is_night_shift FROM attendance.shift ORDER BY id;');

  // 2. Setup 60 Synthetic Employees
  console.log('2. Inserting/Verifying 60 Synthetic Employees across 5 Departments...');
  const departments = [
    { name: 'Yazılım', count: 15, prefix: 'SW' },
    { name: 'İnsan Kaynakları', count: 8, prefix: 'HR' },
    { name: 'Üretim & Fabrika', count: 22, prefix: 'PR' },
    { name: 'Finans', count: 8, prefix: 'FN' },
    { name: 'Satış & Pazarlama', count: 7, prefix: 'SL' }
  ];

  const employeeValues = [];
  let empNum = 1;
  for (const dept of departments) {
    for (let i = 1; i <= dept.count; i++) {
      const empNo = `EMP-${String(empNum).padStart(3, '0')}`;
      const fullName = `Çalışan ${empNum} (${dept.name})`;
      employeeValues.push(`('${empNo}', '${fullName}', '${dept.name}', true)`);
      empNum++;
    }
  }

  const empSql = `
    INSERT INTO attendance.employee (employee_no, full_name, department, active)
    VALUES ${employeeValues.join(',\n')}
    ON CONFLICT (employee_no) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      department = EXCLUDED.department,
      active = EXCLUDED.active;
  `;
  runPsql(empSql);
  const employees = runPsqlJson('SELECT id, employee_no, full_name, department FROM attendance.employee ORDER BY employee_no;');

  // 3. Setup Employee Shifts
  console.log('3. Assigning Shifts to Employees...');
  const empShiftValues = [];
  const defaultShift = shifts.find(s => s.name === 'Gündüz Standart');
  const factoryShifts = shifts.filter(s => s.name.startsWith('Fabrika'));

  for (let idx = 0; idx < employees.length; idx++) {
    const emp = employees[idx];
    let assignedShiftId = defaultShift.id;
    if (emp.department === 'Üretim & Fabrika') {
      // Rotate factory workers among the 3 factory shifts deterministically
      const shiftIdx = idx % factoryShifts.length;
      assignedShiftId = factoryShifts[shiftIdx].id;
    }
    empShiftValues.push(`('${emp.id}', ${assignedShiftId}, '2026-01-01')`);
  }

  const empShiftSql = `
    INSERT INTO attendance.employee_shift (employee_id, shift_id, valid_from)
    VALUES ${empShiftValues.join(',\n')}
    ON CONFLICT (employee_id, shift_id, valid_from) DO NOTHING;
  `;
  runPsql(empShiftSql);

  // 4. Setup 60 Calendar Days (2026-01-01 to 2026-03-01)
  console.log('4. Generating 60 Calendar Days (2026-01-01 to 2026-03-01)...');
  const calendarValues = [];
  const startDate = new Date('2026-01-01T00:00:00Z');
  const totalDays = 60;

  for (let d = 0; d < totalDays; d++) {
    const curDate = new Date(startDate.getTime() + d * 24 * 60 * 60 * 1000);
    const dateStr = curDate.toISOString().split('T')[0];
    const dayOfWeek = curDate.getUTCDay(); // 0 = Sun, 6 = Sat

    let isWorkday = true;
    let isHoliday = false;
    let desc = 'İş Günü';

    if (dateStr === '2026-01-01') {
      isWorkday = false;
      isHoliday = true;
      desc = 'Yılbaşı Resmî Tatili';
    } else if (dayOfWeek === 0 || dayOfWeek === 6) {
      isWorkday = false;
      desc = dayOfWeek === 6 ? 'Cumartesi Hafta Sonu' : 'Pazar Hafta Sonu';
    }

    calendarValues.push(`('${dateStr}', ${isWorkday}, ${isHoliday}, '${desc}')`);
  }

  const calSql = `
    INSERT INTO attendance.calendar_day (day, is_workday, is_holiday, description)
    VALUES ${calendarValues.join(',\n')}
    ON CONFLICT (day) DO UPDATE SET
      is_workday = EXCLUDED.is_workday,
      is_holiday = EXCLUDED.is_holiday,
      description = EXCLUDED.description;
  `;
  runPsql(calSql);
  const calendarDays = runPsqlJson('SELECT day, is_workday, is_holiday, description FROM attendance.calendar_day ORDER BY day;');

  // 5. Generate Deterministic Exceptions and Events
  console.log('5. Generating Events & Exceptions across 60 days for 60 employees...');
  const exceptionValues = [];
  const eventValues = [];

  const turnstileDevices = [
    'TURNSTILE_MAIN_GATE',
    'TURNSTILE_FACTORY_A',
    'TURNSTILE_FACTORY_B',
    'TURNSTILE_OFFICE_A'
  ];

  function formatTimestamp(dateStr, totalMinutes, sec = 0) {
    const d = new Date(`${dateStr}T00:00:00+03:00`);
    const finalMs = d.getTime() + totalMinutes * 60 * 1000 + sec * 1000;
    const finalDate = new Date(finalMs);
    
    // Format in Europe/Istanbul (+03:00)
    // Offset is fixed +03:00
    const tzMs = finalDate.getTime() + (3 * 60 * 60 * 1000);
    const tzDate = new Date(tzMs);
    const y = tzDate.getUTCFullYear();
    const mo = String(tzDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(tzDate.getUTCDate()).padStart(2, '0');
    const h = String(tzDate.getUTCHours()).padStart(2, '0');
    const m = String(tzDate.getUTCMinutes()).padStart(2, '0');
    const s = String(tzDate.getUTCSeconds()).padStart(2, '0');
    return `${y}-${mo}-${day} ${h}:${m}:${s}+03`;
  }

  for (const dayItem of calendarDays) {
    const dateStr = dayItem.day;
    const isWorkday = dayItem.is_workday;
    const isHoliday = dayItem.is_holiday;

    for (let empIdx = 0; empIdx < employees.length; empIdx++) {
      const emp = employees[empIdx];
      const roll = prng();

      // On non-workdays / holidays, normally no events unless occasional overtime/factory shift
      if (!isWorkday || isHoliday) {
        // Exception: 5% deterministic overtime punch on factory employees
        if (emp.department === 'Üretim & Fabrika' && roll < 0.05) {
          const inTime = formatTimestamp(dateStr, 7 * 60 + 5, 0);
          const outTime = formatTimestamp(dateStr, 15 * 60 + 10, 0);
          eventValues.push(`('${emp.id}', '${inTime}', 'IN', 'TURNSTILE_FACTORY_A')`);
          eventValues.push(`('${emp.id}', '${outTime}', 'OUT', 'TURNSTILE_FACTORY_A')`);
        }
        continue;
      }

      // Workday Scenarios:
      // 1. Approved Leave (~7%): Annual Leave, Sick Leave, Maternity
      if (roll < 0.07) {
        const leaveType = (roll < 0.04) ? 'ANNUAL_LEAVE' : (roll < 0.06 ? 'SICK_LEAVE' : 'OFFICIAL_DUTY');
        exceptionValues.push(`('${emp.id}', '${dateStr} 00:00:00+03', '${dateStr} 23:59:59+03', '${leaveType}', true, 'Onaylı sistem kaydı')`);
        continue;
      }

      // 2. Remote Work (~10%)
      if (roll >= 0.07 && roll < 0.17 && emp.department !== 'Üretim & Fabrika') {
        exceptionValues.push(`('${emp.id}', '${dateStr} 08:30:00+03', '${dateStr} 17:30:00+03', 'REMOTE_WORK', true, 'Uzaktan çalışma onaylı')`);
        // Remote work logged via portal
        const inTime = formatTimestamp(dateStr, 8 * 60 + 30, 0);
        const outTime = formatTimestamp(dateStr, 17 * 60 + 30, 0);
        eventValues.push(`('${emp.id}', '${inTime}', 'IN', 'REMOTE_PORTAL')`);
        eventValues.push(`('${emp.id}', '${outTime}', 'OUT', 'REMOTE_PORTAL')`);
        continue;
      }

      // 3. Absent without approved leave (~3%)
      if (roll >= 0.17 && roll < 0.20) {
        // No events logged -> results in ABSENT status in daily_summary
        continue;
      }

      // Determine shift times for standard office vs factory
      let startH = 8, startM = 30, endH = 17, endM = 30;
      let device = 'TURNSTILE_MAIN_GATE';

      if (emp.department === 'Üretim & Fabrika') {
        const fShift = (empIdx % 3);
        if (fShift === 0) { startH = 7; startM = 0; endH = 15; endM = 0; device = 'TURNSTILE_FACTORY_A'; }
        else if (fShift === 1) { startH = 15; startM = 0; endH = 23; endM = 0; device = 'TURNSTILE_FACTORY_B'; }
        else { startH = 23; startM = 0; endH = 31; endM = 0; device = 'TURNSTILE_FACTORY_A'; } // Night shift: 23:00 to 07:00 next day
      }

      const shiftStartTotalMins = startH * 60 + startM;
      const shiftEndTotalMins = endH * 60 + endM;

      // 4. Late Arrival (~12%): 20 to 60 minutes late
      if (roll >= 0.20 && roll < 0.32) {
        const lateMin = Math.floor(20 + prng() * 45); // 20-65 mins late
        const inSec = Math.floor(prng() * 59);
        const inTime = formatTimestamp(dateStr, shiftStartTotalMins + lateMin, inSec);
        const outTime = formatTimestamp(dateStr, shiftEndTotalMins + 15, 0);

        eventValues.push(`('${emp.id}', '${inTime}', 'IN', '${device}')`);
        eventValues.push(`('${emp.id}', '${outTime}', 'OUT', '${device}')`);
        continue;
      }

      // 5. Early Exit (~5%): Leaves 30 to 75 minutes before shift_end
      if (roll >= 0.32 && roll < 0.37) {
        const inTime = formatTimestamp(dateStr, shiftStartTotalMins - 5, 0);
        const earlyMin = Math.floor(30 + prng() * 45);
        const outTime = formatTimestamp(dateStr, shiftEndTotalMins - earlyMin, 0);

        eventValues.push(`('${emp.id}', '${inTime}', 'IN', '${device}')`);
        eventValues.push(`('${emp.id}', '${outTime}', 'OUT', '${device}')`);
        continue;
      }

      // 6. Missing Checkout (~3%): Has IN punch but forgot to punch OUT
      if (roll >= 0.37 && roll < 0.40) {
        const inTime = formatTimestamp(dateStr, shiftStartTotalMins, 0);
        eventValues.push(`('${emp.id}', '${inTime}', 'IN', '${device}')`);
        continue;
      }

      // 7. Normal On-Time Attendance (~60%)
      const earlyArrivalMins = Math.floor(prng() * 15); // Arrives 0-15 mins before shift
      const afterExitMins = Math.floor(prng() * 25); // Leaves 0-25 mins after shift

      const inSec = Math.floor(prng() * 59);
      const outSec = Math.floor(prng() * 59);

      const inTime = formatTimestamp(dateStr, shiftStartTotalMins - earlyArrivalMins, inSec);
      const outTime = formatTimestamp(dateStr, shiftEndTotalMins + afterExitMins, outSec);

      eventValues.push(`('${emp.id}', '${inTime}', 'IN', '${device}')`);
      eventValues.push(`('${emp.id}', '${outTime}', 'OUT', '${device}')`);
    }
  }

  // Insert Exceptions in Batches
  console.log(`6. Inserting ${exceptionValues.length} Approved Exceptions...`);
  if (exceptionValues.length > 0) {
    const chunkSize = 200;
    for (let i = 0; i < exceptionValues.length; i += chunkSize) {
      const chunk = exceptionValues.slice(i, i + chunkSize);
      const sql = `
        INSERT INTO attendance.exception (employee_id, start_at, end_at, exception_type, approved, reason)
        VALUES ${chunk.join(',\n')}
        ON CONFLICT (employee_id, start_at, end_at, exception_type) DO UPDATE SET
          approved = EXCLUDED.approved,
          reason = EXCLUDED.reason;
      `;
      runPsql(sql);
    }
  }

  // Insert Events in Batches
  console.log(`7. Inserting ${eventValues.length} Turnstile Events...`);
  if (eventValues.length > 0) {
    const chunkSize = 500;
    for (let i = 0; i < eventValues.length; i += chunkSize) {
      const chunk = eventValues.slice(i, i + chunkSize);
      const sql = `
        INSERT INTO attendance.event (employee_id, event_time, event_type, source_device)
        VALUES ${chunk.join(',\n')}
        ON CONFLICT (employee_id, event_time, event_type) DO NOTHING;
      `;
      runPsql(sql);
    }
  }

  // 8. Fetch Summary Statistics
  console.log('\n=== ATTENDANCE DATASET SUMMARY ===');
  const stats = runPsqlJson(`
    SELECT 
      (SELECT COUNT(*) FROM attendance.employee) AS employee_count,
      (SELECT COUNT(*) FROM attendance.shift) AS shift_count,
      (SELECT COUNT(*) FROM attendance.calendar_day) AS calendar_days,
      (SELECT COUNT(*) FROM attendance.exception) AS exception_count,
      (SELECT COUNT(*) FROM attendance.event) AS total_events,
      (SELECT COUNT(*) FROM attendance.daily_summary) AS daily_summary_rows,
      (SELECT COUNT(*) FROM attendance.daily_summary WHERE status = 'LATE') AS late_count,
      (SELECT COUNT(*) FROM attendance.daily_summary WHERE status = 'ON_LEAVE') AS on_leave_count,
      (SELECT COUNT(*) FROM attendance.daily_summary WHERE status = 'REMOTE') AS remote_count,
      (SELECT COUNT(*) FROM attendance.daily_summary WHERE status = 'ABSENT') AS absent_count,
      (SELECT COUNT(*) FROM attendance.daily_summary WHERE status = 'ON_TIME') AS on_time_count,
      (SELECT COUNT(*) FROM attendance.daily_summary WHERE missing_checkout = true) AS missing_checkout_count;
  `)[0];

  console.log(JSON.stringify(stats, null, 2));

  return stats;
}

if (require.main === module) {
  const seed = parseInt(process.argv[2] || '42', 10);
  generateAttendanceData(seed).catch(err => {
    console.error('Data generation error:', err);
    process.exit(1);
  });
}

module.exports = { generateAttendanceData };
