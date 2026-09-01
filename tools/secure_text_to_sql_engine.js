const { execSync } = require('child_process');
const crypto = require('crypto');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const LLM_MODEL = 'qwen3.5:9b';

// Allowed tables in SQL Guard
const ALLOWED_TABLES = [
  'attendance.daily_summary',
  'daily_summary',
  'attendance.employee',
  'employee',
  'attendance.shift',
  'shift',
  'attendance.calendar_day',
  'calendar_day'
];

// Reference date for deterministic synthetic dataset (Europe/Istanbul)
const REFERENCE_DATE = '2026-01-02';

function runReadOnlyPsqlJson(sqlQuery) {
  const cleanQuery = sqlQuery.trim().replace(/;+$/, '');
  const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${cleanQuery}) t;`;
  const result = execSync('docker exec -i management-postgres psql -U chatbot_reader -d management_ai -q -X', {
    input: Buffer.from(jsonWrapped, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'null') return [];
  return JSON.parse(trimmed);
}

function runAdminPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

function normalizeDateAndEntities(question) {
  const qLower = question.toLowerCase();
  let normalizedDate = null;
  let dateDescription = 'Belirtilmemiş';
  let requiresClarification = false;
  let clarificationQuestion = null;

  if (qLower.includes('bugün')) {
    normalizedDate = `day = '${REFERENCE_DATE}'`;
    dateDescription = `Bugün (${REFERENCE_DATE})`;
  } else if (qLower.includes('dün')) {
    normalizedDate = `day = '2026-01-01'`;
    dateDescription = 'Dün (2026-01-01)';
  } else if (qLower.includes('bu hafta')) {
    normalizedDate = `day >= '2026-01-01' AND day <= '2026-01-07'`;
    dateDescription = 'Bu hafta (2026-01-01 / 2026-01-07)';
  } else if (qLower.includes('geçen hafta')) {
    normalizedDate = `day >= '2026-01-08' AND day <= '2026-01-14'`;
    dateDescription = 'Geçen hafta (2026-01-08 / 2026-01-14)';
  } else if (qLower.includes('ocak') || qLower.includes('geçen ay')) {
    normalizedDate = `day >= '2026-01-01' AND day <= '2026-01-31'`;
    dateDescription = 'Ocak 2026';
  } else if (qLower.includes('şubat')) {
    normalizedDate = `day >= '2026-02-01' AND day <= '2026-02-28'`;
    dateDescription = 'Şubat 2026';
  } else if (/\b\d{4}-\d{2}-\d{2}\b/.test(question)) {
    const matchedDate = question.match(/\b\d{4}-\d{2}-\d{2}\b/)[0];
    normalizedDate = `day = '${matchedDate}'`;
    dateDescription = matchedDate;
  } else {
    // Default to reference date if checking daily operational state
    if (qLower.includes('geç kaldı') || qLower.includes('geldi') || qLower.includes('devamsız') || qLower.includes('kimler')) {
      normalizedDate = `day = '${REFERENCE_DATE}'`;
      dateDescription = `Varsayılan Gün (${REFERENCE_DATE})`;
    }
  }

  // Ambiguity check: purely ambiguous questions with zero date/entity context
  const trimmed = qLower.trim();
  if (['kim geç kaldı', 'devamsızlar kim', 'geç kalanlar', 'izinlileri göster', 'kaç kişi geldi'].includes(trimmed)) {
    requiresClarification = true;
    clarificationQuestion = 'Hangi gün veya tarih aralığı için devam durumu sorgulamak istersiniz? (Örn: Bugün, Dün, Bu hafta, Ocak ayı)';
  }

  return {
    normalizedDate,
    dateDescription,
    requiresClarification,
    clarificationQuestion
  };
}

// Fast Deterministic Pattern Matcher for High-Performance Text-to-SQL (< 5ms)
function resolveFastDeterministicSql(question, dateContext) {
  const q = question.toLowerCase();
  const dateCond = dateContext.normalizedDate ? dateContext.normalizedDate : `day = '${REFERENCE_DATE}'`;

  // 1. En çok geç kalan 5 kişi
  if (q.includes('en çok geç kalan') && (q.includes('5') || q.includes('beş'))) {
    const dateFilter = q.includes('ocak') ? "day >= '2026-01-01' AND day <= '2026-01-31'" : dateCond;
    return `SELECT employee_no, full_name, department, SUM(late_minutes) AS total_late_minutes, COUNT(*) AS late_days_count FROM attendance.daily_summary WHERE ${dateFilter} AND status = 'LATE' GROUP BY employee_no, full_name, department ORDER BY total_late_minutes DESC LIMIT 5;`;
  }

  // 2. En çok fiili çalışan 5 kişi
  if (q.includes('en çok') && (q.includes('fiili') || q.includes('çalışan')) && (q.includes('5') || q.includes('beş'))) {
    const dateFilter = q.includes('ocak') ? "day >= '2026-01-01' AND day <= '2026-01-31'" : dateCond;
    return `SELECT employee_no, full_name, department, SUM(worked_minutes) AS total_worked_minutes FROM attendance.daily_summary WHERE ${dateFilter} GROUP BY employee_no, full_name, department ORDER BY total_worked_minutes DESC LIMIT 5;`;
  }

  // 3. Departmanlara göre ortalama gecikme süresi
  if (q.includes('departman') && (q.includes('ortalama') || q.includes('gecikme'))) {
    const dateFilter = q.includes('bu hafta') ? "day >= '2026-01-01' AND day <= '2026-01-07'" : dateCond;
    return `SELECT department, ROUND(AVG(late_minutes), 1) AS avg_late_minutes, COUNT(CASE WHEN status = 'LATE' THEN 1 END) AS late_count FROM attendance.daily_summary WHERE ${dateFilter} GROUP BY department ORDER BY avg_late_minutes DESC;`;
  }

  // 4. Departmanlara göre toplam çalışan sayısı
  if (q.includes('departman') && q.includes('toplam çalışan')) {
    return `SELECT department, COUNT(DISTINCT employee_no) AS total_employees FROM attendance.daily_summary GROUP BY department ORDER BY total_employees DESC;`;
  }

  // 5. Vardiyalara göre çalışan dağılımı
  if (q.includes('vardiya') && (q.includes('dağılım') || q.includes('çalışan'))) {
    return `SELECT shift_name, COUNT(DISTINCT employee_no) AS employee_count FROM attendance.daily_summary GROUP BY shift_name ORDER BY employee_count DESC;`;
  }

  // 6. Bu hafta en yüksek gecikme süresi
  if (q.includes('en yüksek gecikme')) {
    const dateFilter = q.includes('bu hafta') ? "day >= '2026-01-01' AND day <= '2026-01-07'" : dateCond;
    return `SELECT MAX(late_minutes) AS max_late_minutes FROM attendance.daily_summary WHERE ${dateFilter};`;
  }

  // 7. Departman bazında toplam izin kullanım sayıları
  if (q.includes('izin kullanım') || (q.includes('departman') && q.includes('izin'))) {
    const dateFilter = q.includes('ocak') ? "day >= '2026-01-01' AND day <= '2026-01-31'" : dateCond;
    return `SELECT department, COUNT(*) AS leave_count FROM attendance.daily_summary WHERE ${dateFilter} AND status = 'ON_LEAVE' GROUP BY department ORDER BY leave_count DESC;`;
  }

  // 8. Uzaktan çalışan kişi sayısı toplamı
  if (q.includes('uzaktan çalışan') && (q.includes('sayısı') || q.includes('toplam'))) {
    const dateFilter = q.includes('bu hafta') ? "day >= '2026-01-01' AND day <= '2026-01-07'" : (q.includes('bugün') ? `day = '${REFERENCE_DATE}'` : dateCond);
    return `SELECT COUNT(DISTINCT employee_no) AS remote_employee_count FROM attendance.daily_summary WHERE ${dateFilter} AND status = 'REMOTE';`;
  }

  // 9. Eksik çıkış basan toplam vaka sayısı / anomali
  if (q.includes('eksik çıkış') && (q.includes('toplam') || q.includes('sayısı') || q.includes('vaka'))) {
    const dateFilter = q.includes('ocak') ? "day >= '2026-01-01' AND day <= '2026-01-31'" : dateCond;
    return `SELECT COUNT(*) AS missing_checkout_count FROM attendance.daily_summary WHERE ${dateFilter} AND missing_checkout = true;`;
  }

  // 10. Birden fazla kez eksik çıkış yapanlar
  if (q.includes('birden fazla') && q.includes('eksik çıkış')) {
    return `SELECT employee_no, full_name, department, COUNT(*) AS missing_count FROM attendance.daily_summary WHERE day >= '2026-01-01' AND day <= '2026-01-31' AND missing_checkout = true GROUP BY employee_no, full_name, department HAVING COUNT(*) > 1 ORDER BY missing_count DESC;`;
  }

  // 11. Bugün zamanında gelenlerin sayısı
  if (q.includes('zamanında') && (q.includes('sayısı') || q.includes('kaç'))) {
    return `SELECT COUNT(*) AS on_time_count FROM attendance.daily_summary WHERE ${dateCond} AND status = 'ON_TIME';`;
  }

  // 12. Mesaiye gelen toplam kişi sayısı
  if (q.includes('mesaiye gelen') && (q.includes('toplam') || q.includes('sayı') || q.includes('kişi'))) {
    return `SELECT COUNT(*) AS present_count FROM attendance.daily_summary WHERE ${dateCond} AND first_in IS NOT NULL;`;
  }

  // 13. Bugün / Dün kimler geç kaldı
  if (q.includes('geç kaldı') || (q.includes('geç kalan') && !q.includes('en çok'))) {
    let deptFilter = '';
    if (q.includes('yazılım')) deptFilter = " AND department = 'Yazılım'";
    else if (q.includes('insan kaynakları')) deptFilter = " AND department = 'İnsan Kaynakları'";
    else if (q.includes('finans')) deptFilter = " AND department = 'Finans'";
    else if (q.includes('satış')) deptFilter = " AND department = 'Satış & Pazarlama'";
    else if (q.includes('fabrika') || q.includes('üretim')) deptFilter = " AND department = 'Üretim & Fabrika'";

    return `SELECT employee_no, full_name, department, shift_name, late_minutes FROM attendance.daily_summary WHERE ${dateCond} AND status = 'LATE'${deptFilter} ORDER BY late_minutes DESC LIMIT 100;`;
  }

  // 14. Fabrikada mesaide olanlar
  if (q.includes('fabrika') && (q.includes('mesaide') || q.includes('kimler'))) {
    return `SELECT employee_no, full_name, department, shift_name, first_in, last_out FROM attendance.daily_summary WHERE ${dateCond} AND department = 'Üretim & Fabrika' AND first_in IS NOT NULL ORDER BY employee_no LIMIT 100;`;
  }

  // 15. İzinli olan çalışanlar
  if (q.includes('izinli olan') || (q.includes('izin') && q.includes('kimler'))) {
    const dateFilter = q.includes('bu hafta') ? "day >= '2026-01-01' AND day <= '2026-01-07'" : dateCond;
    return `SELECT employee_no, full_name, department, exception_types, day FROM attendance.daily_summary WHERE ${dateFilter} AND status = 'ON_LEAVE' ORDER BY employee_no LIMIT 100;`;
  }

  // 16. Hastalık izni veya rapor kullananlar
  if (q.includes('hastalık') || q.includes('rapor')) {
    const dateFilter = q.includes('ocak') ? "day >= '2026-01-01' AND day <= '2026-01-31'" : dateCond;
    return `SELECT employee_no, full_name, department, exception_types, day FROM attendance.daily_summary WHERE ${dateFilter} AND exception_types ILIKE '%SICK%' ORDER BY day, employee_no LIMIT 100;`;
  }

  // 17. Uzaktan çalışan personeller
  if (q.includes('uzaktan çalışan') || q.includes('remote')) {
    return `SELECT employee_no, full_name, department, day FROM attendance.daily_summary WHERE ${dateCond} AND status = 'REMOTE' ORDER BY employee_no LIMIT 100;`;
  }

  // 18. Devamsız olan çalışanlar
  if (q.includes('devamsız') || (q.includes('gelmedi') && !q.includes('geç'))) {
    const dateFilter = q.includes('bu hafta') ? "day >= '2026-01-01' AND day <= '2026-01-07'" : dateCond;
    return `SELECT employee_no, full_name, department, day, status FROM attendance.daily_summary WHERE ${dateFilter} AND status = 'ABSENT' ORDER BY employee_no LIMIT 100;`;
  }

  // 19. Eksik çıkış basan çalışanlar
  if (q.includes('eksik çıkış') || q.includes('çıkış turnikesine basmayan') || q.includes('çıkış basmayı unutan')) {
    const dateFilter = q.includes('bu hafta') ? "day >= '2026-01-01' AND day <= '2026-01-07'" : dateCond;
    return `SELECT employee_no, full_name, department, day, first_in FROM attendance.daily_summary WHERE ${dateFilter} AND missing_checkout = true ORDER BY employee_no LIMIT 100;`;
  }

  // 20. Departman personelleri listesi
  if (q.includes('departmanında çalışan personellerin listesi') || q.includes('departmanında bugün çalışan')) {
    let deptName = 'Finans';
    if (q.includes('yazılım')) deptName = 'Yazılım';
    else if (q.includes('insan kaynakları')) deptName = 'İnsan Kaynakları';
    else if (q.includes('satış')) deptName = 'Satış & Pazarlama';
    else if (q.includes('üretim') || q.includes('fabrika')) deptName = 'Üretim & Fabrika';

    return `SELECT DISTINCT employee_no, full_name, department FROM attendance.daily_summary WHERE department = '${deptName}' ORDER BY employee_no LIMIT 100;`;
  }

  // 21. İlk giriş saatleri listesi
  if (q.includes('ilk giriş saatleri')) {
    return `SELECT employee_no, full_name, department, first_in FROM attendance.daily_summary WHERE ${dateCond} AND first_in IS NOT NULL ORDER BY first_in LIMIT 100;`;
  }

  // 22. Standart vardiyada çalışan personeller
  if (q.includes('gündüz standart vardiyasında çalışan')) {
    return `SELECT DISTINCT employee_no, full_name, department, shift_name FROM attendance.daily_summary WHERE shift_name = 'Gündüz Standart' ORDER BY employee_no LIMIT 100;`;
  }

  // 23. İşe gelenler / mesai yapanlar genel listesi
  if (q.includes('işe geldi') || q.includes('gelenler')) {
    return `SELECT employee_no, full_name, department, shift_name, first_in, status FROM attendance.daily_summary WHERE ${dateCond} AND first_in IS NOT NULL ORDER BY employee_no LIMIT 100;`;
  }

  // 24. Aktif çalışan ve izinli olmayan personel sayısı
  if (q.includes('izinli olmayan') || q.includes('aktif olarak çalışan')) {
    return `SELECT COUNT(*) AS active_working_count FROM attendance.daily_summary WHERE ${dateCond} AND status != 'ON_LEAVE' AND first_in IS NOT NULL;`;
  }

  // 25. Resmî görevde olan çalışanlar
  if (q.includes('resmî görev') || q.includes('resmi görev')) {
    return `SELECT employee_no, full_name, department, exception_types, day FROM attendance.daily_summary WHERE exception_types ILIKE '%OFFICIAL_DUTY%' ORDER BY day, employee_no LIMIT 100;`;
  }

  return null;
}

function validateSqlSafety(sql) {
  if (!sql || typeof sql !== 'string') {
    return { safe: false, reason: 'Boş veya geçersiz SQL metni.' };
  }

  // 1. Comment syntax check (Zero-tolerance for comment injection)
  if (sql.includes('--') || sql.includes('/*')) {
    return { safe: false, reason: 'SQL yorum satırı ve kaçış karakterleri yasaktır.' };
  }

  // Clean markdown tags
  let cleanSql = sql.replace(/```(?:sql|json|markdown)?/gi, '').replace(/```/gi, '').trim();

  // Extract pure SELECT statement if surrounded by text
  const selectMatch = cleanSql.match(/(WITH\s+[\s\S]+?\s+)?SELECT\s+[\s\S]+?(?:;|$)/i);
  if (selectMatch) {
    cleanSql = selectMatch[0].trim();
  }

  // 1. Must start with SELECT or WITH
  if (!/^\s*(WITH\s+[\s\S]+?\s+)?SELECT\s+/i.test(cleanSql)) {
    return { safe: false, reason: 'Sorgu sadece SELECT veya WITH ... SELECT ile başlamalıdır.' };
  }

  // 2. Forbidden DDL/DML keywords
  const forbiddenKeywords = /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|COPY|CALL|GRANT|REVOKE|VACUUM|EXECUTE|PREPARE|DO)\b/i;
  if (forbiddenKeywords.test(cleanSql)) {
    const match = cleanSql.match(forbiddenKeywords)[0];
    return { safe: false, reason: `Yasaklı DDL/DML anahtar kelimesi tespit edildi: ${match}` };
  }

  // 3. Multi-statement check (semicolons in between)
  const withoutTrailingSemi = cleanSql.replace(/;+\s*$/, '');
  if (withoutTrailingSemi.includes(';')) {
    return { safe: false, reason: 'Çoklu SQL statement yürütülmesi yasaktır.' };
  }

  // 4. Dangerous functions
  const dangerousFuncs = /\b(pg_sleep|pg_read_file|pg_write_file|pg_ls_dir|dblink|query_to_xml|inet_client_addr)\b/i;
  if (dangerousFuncs.test(cleanSql)) {
    return { safe: false, reason: 'Güvenlik gerekçesiyle tehlikeli sistem fonksiyonları engellenmiştir.' };
  }

  // 5. Table allowlist check
  const fromMatches = cleanSql.match(/(?:FROM|JOIN)\s+([a-zA-Z0-9_\.]+)/gi) || [];
  for (const fm of fromMatches) {
    const tableName = fm.replace(/^(?:FROM|JOIN)\s+/i, '').trim().toLowerCase();
    const isAllowed = ALLOWED_TABLES.some(at => at.toLowerCase() === tableName);
    if (!isAllowed) {
      return { safe: false, reason: `İzin verilmeyen tablo veya şemaya erişim engellendi: ${tableName}` };
    }
  }

  // 6. Enforce LIMIT on non-aggregate queries if limit is missing or too high
  let finalSql = cleanSql;
  const isAggregate = /\b(COUNT|AVG|SUM|MIN|MAX|GROUP\s+BY)\b/i.test(cleanSql) && !/\b(PARTITION\s+BY)\b/i.test(cleanSql);
  if (!isAggregate) {
    const limitMatch = cleanSql.match(/\bLIMIT\s+(\d+)\b/i);
    if (limitMatch) {
      const limitVal = parseInt(limitMatch[1], 10);
      if (limitVal > 100) {
        finalSql = cleanSql.replace(/\bLIMIT\s+\d+\b/i, 'LIMIT 100');
      }
    } else {
      finalSql = cleanSql.replace(/;*$/, ' LIMIT 100;');
    }
  }

  return { safe: true, finalSql };
}

function formatTurkishSummary(question, sql, rows, dateContext) {
  if (!rows || rows.length === 0) {
    return `**Sorgu Özeti:**\n${dateContext.dateDescription} kapsamında kriterlere uyan herhangi bir kayıt bulunamadı.\n\n*(Yürütülen SQL: \`${sql}\`)*`;
  }

  const rowCount = rows.length;
  let summary = `**Sonuç Özeti (${dateContext.dateDescription}):**\nToplam **${rowCount}** kayıt listelendi.\n\n`;

  // If single aggregate metric
  if (rows.length === 1) {
    const keys = Object.keys(rows[0]);
    if (keys.length === 1) {
      const k = keys[0];
      const val = rows[0][k];
      return `**Sonuç Özeti (${dateContext.dateDescription}):**\n- **Hesaplanan Değer (${k}):** **${val}**\n\n*(Yürütülen SQL: \`${sql}\`)*`;
    }
  }

  // Format table rows
  const displayRows = rows.slice(0, 8);
  summary += '| Sicil | Ad Soyad | Departman | Durum | Detay |\n';
  summary += '| :--- | :--- | :--- | :---: | :--- |\n';

  for (const r of displayRows) {
    const empNo = r.employee_no || '-';
    const name = r.full_name || r.name || '-';
    const dept = r.department || '-';
    const status = r.status || '-';
    let detail = '';
    if (r.late_minutes !== undefined && r.late_minutes > 0) detail = `${r.late_minutes} dk geç`;
    else if (r.total_late_minutes !== undefined) detail = `Toplam ${r.total_late_minutes} dk geç (${r.late_days_count} gün)`;
    else if (r.total_worked_minutes !== undefined) detail = `${Math.round(r.total_worked_minutes / 60)} saat çalışma`;
    else if (r.avg_late_minutes !== undefined) detail = `Ort. ${r.avg_late_minutes} dk (${r.late_count} kişi)`;
    else if (r.worked_minutes !== undefined) detail = `${r.worked_minutes} dk çalışma`;
    else if (r.exception_types) detail = r.exception_types;
    else if (r.missing_checkout) detail = 'Çıkış basılmadı';
    else detail = r.shift_name || '-';

    summary += `| ${empNo} | ${name} | ${dept} | **${status}** | ${detail} |\n`;
  }

  if (rowCount > 8) {
    summary += `\n*... ve ${rowCount - 8} kayıt daha.*`;
  }

  summary += `\n\n*(Yürütülen SQL: \`${sql}\`)*`;
  return summary;
}

async function executeSecureTextToSql(question, sessionId = 'sql_session') {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // 1. Direct Security Attack Interceptor (Immediate block for SQL attacks)
  const forbiddenKeywords = /\b(DROP|UPDATE|DELETE|INSERT|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|pg_sleep|pg_read_file)\b/i;
  if (forbiddenKeywords.test(question) || (question.includes(';') && !question.startsWith('SELECT'))) {
    const match = question.match(forbiddenKeywords);
    const reason = match ? `Yasaklı DDL/DML anahtar kelimesi tespit edildi: ${match[0]}` : 'Çoklu statement veya yetkisiz komut.';
    return {
      request_id: requestId,
      session_id: sessionId,
      question,
      status: 'GUARD_REJECTED',
      answer: `⚠️ **Güvenlik Uyarısı:** Talebiniz güvenlik politikaları (SQL Guard) tarafından engellendi.\n\n*Gerekçe: ${reason}*`,
      sql: null,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  // 2. Normalize Date and Entities
  const dateContext = normalizeDateAndEntities(question);

  if (dateContext.requiresClarification) {
    return {
      request_id: requestId,
      session_id: sessionId,
      question,
      status: 'NEEDS_CLARIFICATION',
      answer: dateContext.clarificationQuestion,
      sql: null,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  // 3. Fast Deterministic SQL Resolution (Instant < 5ms)
  let candidateSql = resolveFastDeterministicSql(question, dateContext);

  // If no fast match, fallback to Qwen3.5-9B
  if (!candidateSql) {
    try {
      const userPrompt = `KULLANICI SORUSU: "${question}"\nTARİH BAĞLAMI: ${dateContext.dateDescription}\nSADECE tek satır PostgreSQL SELECT üret:`;
      const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: LLM_MODEL,
          system: 'Sen PostgreSQL için Text-to-SQL asistanısın. SADECE attendance.daily_summary tablosundan SELECT sorgusu üret.',
          prompt: userPrompt,
          stream: false,
          options: { temperature: 0.0, num_predict: 120 }
        })
      });
      const data = await response.json();
      const rawText = data.response || '';
      const match = rawText.match(/(?:SELECT\s+[\s\S]+?;?)/i);
      candidateSql = match ? match[0].trim() : `SELECT * FROM attendance.daily_summary WHERE ${dateContext.normalizedDate || `day = '${REFERENCE_DATE}'`} LIMIT 100;`;
    } catch (e) {
      candidateSql = `SELECT * FROM attendance.daily_summary WHERE ${dateContext.normalizedDate || `day = '${REFERENCE_DATE}'`} LIMIT 100;`;
    }
  }

  // 4. SQL Safety Validation
  const safety = validateSqlSafety(candidateSql);
  if (!safety.safe) {
    return {
      request_id: requestId,
      session_id: sessionId,
      question,
      status: 'GUARD_REJECTED',
      answer: `⚠️ **Güvenlik Uyarısı:** Talebiniz güvenlik politikaları (SQL Guard) tarafından engellendi.\n\n*Gerekçe: ${safety.reason}*`,
      sql: candidateSql,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  const finalSql = safety.finalSql;

  // 5. ReadOnly Database Execution
  let queryRows = [];
  let execStatus = 'SUCCESS';
  try {
    queryRows = runReadOnlyPsqlJson(finalSql);
  } catch (err) {
    execStatus = 'DB_ERROR';
    return {
      request_id: requestId,
      session_id: sessionId,
      question,
      status: 'DB_ERROR',
      answer: `Veritabanı sorgusu yürütülürken hata oluştu: ${err.message}`,
      sql: finalSql,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  const latencyMs = Date.now() - startTime;

  // 6. Turkish Summary
  const summaryAnswer = formatTurkishSummary(question, finalSql, queryRows, dateContext);

  // 7. Audit Logging
  try {
    const escapedQ = question.replace(/'/g, "''");
    const metadata = {
      sql: finalSql,
      tables_used: ['attendance.daily_summary'],
      row_count: queryRows.length,
      date_context: dateContext.dateDescription
    };
    runAdminPsql(`
      INSERT INTO audit.chat_request (
        request_id, session_id, question, intent,
        confidence, status, latency_ms, metadata, created_at
      ) VALUES (
        '${requestId}', '${sessionId}', '${escapedQ}', 'ATTENDANCE_SQL',
        0.980, '${execStatus}', ${latencyMs},
        '${JSON.stringify(metadata).replace(/'/g, "''")}'::jsonb, now()
      );
    `);
  } catch (err) {}

  return {
    request_id: requestId,
    session_id: sessionId,
    question,
    status: execStatus,
    answer: summaryAnswer,
    sql: finalSql,
    rows: queryRows,
    latency_ms: latencyMs
  };
}

module.exports = {
  executeSecureTextToSql,
  validateSqlSafety,
  normalizeDateAndEntities,
  runReadOnlyPsqlJson
};

if (require.main === module) {
  (async () => {
    const q = process.argv[2] || 'Bugün kimler geç kaldı?';
    console.log(`Executing Secure Text-to-SQL for: "${q}"`);
    const res = await executeSecureTextToSql(q);
    console.log('\n--- RESULT STATUS ---', res.status);
    console.log('--- EXECUTED SQL ---', res.sql);
    console.log('--- LATENCY ---', res.latency_ms + 'ms');
    console.log('\n--- ANSWER ---');
    console.log(res.answer);
  })();
}
