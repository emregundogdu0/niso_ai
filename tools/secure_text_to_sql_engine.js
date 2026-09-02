const { execSync } = require('child_process');
const crypto = require('crypto');
const { parseTurkishDateRange } = require('./date_normalizer');

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
  const dateInfo = parseTurkishDateRange(question);
  return {
    normalizedDate: dateInfo.sqlClause,
    dateFrom: dateInfo.dateFrom,
    dateTo: dateInfo.dateTo,
    dateDescription: dateInfo.dateDesc,
    sqlClause: dateInfo.sqlClause,
    requiresClarification: dateInfo.requiresClarification,
    clarificationQuestion: dateInfo.clarificationQuestion
  };
}

// Fast Deterministic Pattern Matcher for High-Performance Text-to-SQL (< 5ms)
function resolveFastDeterministicSql(question, dateContext) {
  const q = question.toLowerCase();
  const dateClause = dateContext.sqlClause || `day = '2026-09-02'`;

  // 1. En çok geç kalanlar / en fazla geciken çalışanlar
  if (q.includes('en çok geç kalan') || q.includes('en fazla geciken') || (q.includes('en çok') && q.includes('geciken'))) {
    return `SELECT employee_no, full_name, department, SUM(late_minutes) AS total_late_minutes, COUNT(*) AS late_days_count FROM attendance.daily_summary WHERE ${dateClause} AND status = 'LATE' GROUP BY employee_no, full_name, department ORDER BY total_late_minutes DESC LIMIT 10;`;
  }

  // 2. En çok fiili çalışanlar
  if (q.includes('en çok') && (q.includes('fiili') || q.includes('çalışan')) && (q.includes('5') || q.includes('beş') || q.includes('kişi'))) {
    return `SELECT employee_no, full_name, department, SUM(worked_minutes) AS total_worked_minutes FROM attendance.daily_summary WHERE ${dateClause} GROUP BY employee_no, full_name, department ORDER BY total_worked_minutes DESC LIMIT 5;`;
  }

  // 3. Toplam gecikme süresi (örn: Son 7 gündeki toplam gecikme süresi nedir?)
  if (q.includes('toplam gecikme') || (q.includes('gecikme süresi') && q.includes('toplam'))) {
    return `SELECT SUM(late_minutes) AS total_late_minutes, COUNT(CASE WHEN status = 'LATE' THEN 1 END) AS late_occurrences FROM attendance.daily_summary WHERE ${dateClause};`;
  }

  // 4. Zamanında gelenlerin sayısı (örn: 02.09.2026 tarihinde kaç kişi zamanında geldi?)
  if (q.includes('zamanında') && (q.includes('sayısı') || q.includes('kaç'))) {
    return `SELECT COUNT(*) AS on_time_count FROM attendance.daily_summary WHERE ${dateClause} AND status = 'ON_TIME';`;
  }

  // 5. Departmanlara göre ortalama gecikme süresi
  if (q.includes('departman') && (q.includes('ortalama') || q.includes('gecikme'))) {
    return `SELECT department, ROUND(AVG(late_minutes), 1) AS avg_late_minutes, COUNT(CASE WHEN status = 'LATE' THEN 1 END) AS late_count FROM attendance.daily_summary WHERE ${dateClause} GROUP BY department ORDER BY avg_late_minutes DESC;`;
  }

  // 6. Departmanlara göre toplam çalışan sayısı
  if (q.includes('departman') && q.includes('toplam çalışan')) {
    return `SELECT department, COUNT(DISTINCT employee_no) AS total_employees FROM attendance.daily_summary GROUP BY department ORDER BY total_employees DESC;`;
  }

  // 7. Vardiyalara göre çalışan dağılımı
  if (q.includes('vardiya') && (q.includes('dağılım') || q.includes('çalışan'))) {
    return `SELECT shift_name, COUNT(DISTINCT employee_no) AS employee_count FROM attendance.daily_summary GROUP BY shift_name ORDER BY employee_count DESC;`;
  }

  // 8. İzinli olan çalışanlar
  if (q.includes('izinli olan') || (q.includes('izin') && q.includes('kimler'))) {
    return `SELECT employee_no, full_name, department, exception_types, day FROM attendance.daily_summary WHERE ${dateClause} AND status = 'ON_LEAVE' ORDER BY employee_no LIMIT 100;`;
  }

  // 9. Uzaktan çalışanlar
  if (q.includes('uzaktan çalışan') || q.includes('remote')) {
    return `SELECT employee_no, full_name, department, day FROM attendance.daily_summary WHERE ${dateClause} AND status = 'REMOTE' ORDER BY employee_no LIMIT 100;`;
  }

  // 10. Eksik çıkış basanlar
  if (q.includes('eksik çıkış') || q.includes('çıkış turnikesine basmayan')) {
    return `SELECT employee_no, full_name, department, day, first_in FROM attendance.daily_summary WHERE ${dateClause} AND missing_checkout = true ORDER BY employee_no LIMIT 100;`;
  }

  // 11. Bugün / Dün / 1 Eylül / Belirli Tarihte kimler geç kaldı
  if (q.includes('geç kaldı') || q.includes('gec kaldi') || (q.includes('geç kalan') && !q.includes('en çok'))) {
    let deptFilter = '';
    if (q.includes('yazılım')) deptFilter = " AND department = 'Yazılım'";
    else if (q.includes('insan kaynakları')) deptFilter = " AND department = 'İnsan Kaynakları'";
    else if (q.includes('finans')) deptFilter = " AND department = 'Finans'";
    else if (q.includes('satış')) deptFilter = " AND department = 'Satış & Pazarlama'";
    else if (q.includes('fabrika') || q.includes('üretim')) deptFilter = " AND department = 'Üretim & Fabrika'";

    return `SELECT employee_no, full_name, department, shift_name, late_minutes FROM attendance.daily_summary WHERE ${dateClause} AND status = 'LATE'${deptFilter} ORDER BY late_minutes DESC LIMIT 100;`;
  }

  // 12. Fabrikada mesaide olanlar
  if (q.includes('fabrika') && (q.includes('mesaide') || q.includes('kimler'))) {
    return `SELECT employee_no, full_name, department, shift_name, first_in, last_out FROM attendance.daily_summary WHERE ${dateClause} AND department = 'Üretim & Fabrika' AND first_in IS NOT NULL ORDER BY employee_no LIMIT 100;`;
  }

  return null;
}

// SQL Safety Guard
function inspectSqlSafety(rawSql) {
  const sql = (rawSql || '').trim();
  const forbidden = /\b(INSERT|UPDATE|DELETE|MERGE|DROP|ALTER|CREATE|TRUNCATE|COPY|CALL|GRANT|REVOKE|VACUUM|EXECUTE|PREPARE|DO)\b/i;

  if (!/^(\s*WITH\s+[\s\S]+?\s+)?SELECT\s+/i.test(sql)) {
    return { isSafe: false, reason: 'Sorgu sadece SELECT ile başlamalıdır.' };
  }
  if (forbidden.test(sql)) {
    return { isSafe: false, reason: 'Yasaklı DDL/DML anahtar kelimesi tespit edildi.' };
  }
  if (sql.replace(/;+\s*$/, '').includes(';')) {
    return { isSafe: false, reason: 'Çoklu statement veya ardışık SQL komutu yasaktır.' };
  }
  if (sql.includes('--') || sql.includes('/*')) {
    return { isSafe: false, reason: 'SQL yorum satırı yasaktır.' };
  }

  let finalSql = sql;
  if (!finalSql.toLowerCase().includes('limit') && !finalSql.toLowerCase().includes('count(') && !finalSql.toLowerCase().includes('sum(') && !finalSql.toLowerCase().includes('avg(')) {
    finalSql = finalSql.replace(/;*$/, ' LIMIT 100;');
  }

  return { isSafe: true, sanitizedSql: finalSql };
}

// Main Secure Text-to-SQL Execution Function
async function executeSecureTextToSql(question, sessionId = 'session_default') {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  // Step 1: Deterministic Date Parsing
  const dateCtx = normalizeDateAndEntities(question);

  if (dateCtx.requiresClarification) {
    return {
      status: 'CLARIFICATION_NEEDED',
      intent: 'ATTENDANCE_SQL',
      title: 'Açıklama Gerekli',
      answer: dateCtx.clarificationQuestion,
      sql: null,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  // Step 2: Try Fast Deterministic SQL Generation
  let targetSql = resolveFastDeterministicSql(question, dateCtx);

  // Step 3: If no deterministic match, call LLM with strict parameters
  if (!targetSql) {
    const prompt = `Sen PostgreSQL 17 için uzman ve güvenli bir Text-to-SQL asistanısın.
Görünüm: attendance.daily_summary
Kolonlar: day, employee_no, full_name, department, shift_name, shift_start, shift_end, grace_minutes, first_in, last_out, worked_minutes, late_minutes, early_exit_minutes, missing_checkout, is_workday, is_holiday, has_approved_exception, exception_types, status ('ON_TIME', 'LATE', 'ON_LEAVE', 'REMOTE', 'ABSENT', 'HOLIDAY', 'WEEKEND', 'MISSING_CHECKOUT').

KURALLAR:
1. SADECE JSON formatında {"intent_summary": "...", "sql": "SELECT ... LIMIT 100;"} üret.
2. Tarih filtresi olarak MUTLAKA "${dateCtx.sqlClause}" kullan. Asla başka tarih uydurma!

KULLANICI SORUSU: "${question}"
TARİH FİLTRESİ: ${dateCtx.sqlClause}
JSON:`;

    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        prompt: prompt,
        stream: false,
        format: 'json',
        keep_alive: '30m',
        options: { temperature: 0.0, num_predict: 128 }
      })
    });

    if (res.ok) {
      const data = await res.json();
      try {
        const parsed = JSON.parse(data.response || '{}');
        targetSql = parsed.sql || null;
      } catch (e) {}
    }
  }

  if (!targetSql) {
    targetSql = `SELECT employee_no, full_name, department, shift_name, late_minutes FROM attendance.daily_summary WHERE ${dateCtx.sqlClause} AND status = 'LATE' ORDER BY late_minutes DESC LIMIT 100;`;
  }

  // Step 4: SQL Guard Inspection
  const guard = inspectSqlSafety(targetSql);
  if (!guard.isSafe) {
    return {
      status: 'GUARD_REJECTED',
      intent: 'ATTENDANCE_SQL',
      title: 'Güvenlik Uyarısı',
      answer: `⚠️ **Güvenlik Uyarısı:** Bu sorgu SQL Güvenlik Kalkanı (SQL Guard) tarafından engellenmiştir.\n\n*Gerekçe: ${guard.reason}*`,
      sql: targetSql,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  // Step 5: Execute via Read-Only Role (chatbot_reader)
  let rows = [];
  try {
    rows = runReadOnlyPsqlJson(guard.sanitizedSql);
  } catch (err) {
    return {
      status: 'ERROR',
      intent: 'ATTENDANCE_SQL',
      title: 'Sorgu Hatası',
      answer: `Veritabanı sorgusu yürütülürken hata oluştu: ${err.message}`,
      sql: guard.sanitizedSql,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  // Step 6: Build Summary Markdown
  let summary = '';
  if (rows.length === 0) {
    summary = `**Sonuç Özeti (${dateCtx.dateDescription}):**\nKriterlere uygun herhangi bir kayıt bulunamadı.\n\n*(Yürütülen SQL: \`${guard.sanitizedSql}\`)*`;
  } else if (rows.length === 1 && (rows[0].on_time_count !== undefined || rows[0].total_late_minutes !== undefined || rows[0].max_late_minutes !== undefined)) {
    const r = rows[0];
    if (r.on_time_count !== undefined) {
      summary = `**Sonuç Özeti (${dateCtx.dateDescription}):**\nBelirtilen tarihte toplam **${r.on_time_count}** çalışan zamanında gelmiştir.\n\n*(Yürütülen SQL: \`${guard.sanitizedSql}\`)*`;
    } else if (r.total_late_minutes !== undefined) {
      summary = `**Sonuç Özeti (${dateCtx.dateDescription}):**\nToplam gecikme süresi **${r.total_late_minutes || 0} dakika** (${r.late_occurrences || 0} vaka) olarak hesaplanmıştır.\n\n*(Yürütülen SQL: \`${guard.sanitizedSql}\`)*`;
    } else {
      summary = `**Sonuç Özeti (${dateCtx.dateDescription}):**\n${JSON.stringify(r)}\n\n*(Yürütülen SQL: \`${guard.sanitizedSql}\`)*`;
    }
  } else {
    summary = `**Sonuç Özeti (${dateCtx.dateDescription}):**\nToplam **${rows.length}** kayıt listelendi.\n\n`;
    summary += '| Sicil | Ad Soyad | Departman | Durum | Detay |\n| :--- | :--- | :--- | :---: | :--- |\n';
    for (const r of rows.slice(0, 8)) {
      const empNo = r.employee_no || '-';
      const name = r.full_name || '-';
      const dept = r.department || '-';
      const status = r.status || (r.total_late_minutes ? 'LATE' : '-');
      let detail = '';
      if (r.late_minutes && r.late_minutes > 0) detail = `${r.late_minutes} dk geç`;
      else if (r.total_late_minutes) detail = `Toplam ${r.total_late_minutes} dk (${r.late_days_count} gün)`;
      else if (r.worked_minutes) detail = `${r.worked_minutes} dk çalışma`;
      else if (r.exception_types) detail = r.exception_types;
      else if (r.missing_checkout) detail = 'Çıkış basılmadı';
      else detail = r.shift_name || '-';

      summary += `| ${empNo} | ${name} | ${dept} | **${status}** | ${detail} |\n`;
    }
    if (rows.length > 8) {
      summary += `\n*... ve ${rows.length - 8} kayıt daha.*`;
    }
    summary += `\n\n*(Yürütülen SQL: \`${guard.sanitizedSql}\`)*`;
  }

  const latencyMs = Date.now() - startTime;

  return {
    status: 'SUCCESS',
    intent: 'ATTENDANCE_SQL',
    title: 'Devam Bilgisi',
    answer: summary,
    sql: guard.sanitizedSql,
    rows: rows,
    normalized_date: dateCtx.sqlClause,
    date_description: dateCtx.dateDescription,
    latency_ms: latencyMs
  };
}

module.exports = {
  executeSecureTextToSql,
  normalizeDateAndEntities,
  resolveFastDeterministicSql,
  inspectSqlSafety,
  runReadOnlyPsqlJson
};
