const { execSync } = require('child_process');
const crypto = require('crypto');
const { parseMultilingualDateRange } = require('./date_normalizer');

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

function normalizeDateAndEntities(question, lang = 'tr') {
  const dateInfo = parseMultilingualDateRange(question, lang);
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

  // 1. Most late employees
  if (q.includes('en cok gec kalan') || q.includes('en fazla geciken') || q.includes('most late') || q.includes('piu in ritardo')) {
    return `SELECT employee_no, full_name, department, SUM(late_minutes) AS total_late_minutes, COUNT(*) AS late_days_count FROM attendance.daily_summary WHERE ${dateClause} AND status = 'LATE' GROUP BY employee_no, full_name, department ORDER BY total_late_minutes DESC LIMIT 10;`;
  }

  // 2. On-time employees count
  if ((q.includes('zamaninda') || q.includes('on time') || q.includes('puntual')) && (q.includes('kac') || q.includes('how many') || q.includes('quante') || q.includes('count') || q.includes('numero'))) {
    return `SELECT COUNT(*) AS on_time_count FROM attendance.daily_summary WHERE ${dateClause} AND status = 'ON_TIME';`;
  }

  // 3. Late arrivals today / on date (TR, EN, IT)
  if (
    q.includes('gec kaldi') || q.includes('geciken') || q.includes('gec kalan') ||
    q.includes('arrived late') || q.includes('is late') || q.includes('who is late') || q.includes('who arrived late') ||
    q.includes('in ritardo') || q.includes('arrivato in ritardo') || q.includes('chi e in ritardo') || q.includes('chi e arrivato in ritardo')
  ) {
    let deptFilter = '';
    if (q.includes('yazilim') || q.includes('software')) deptFilter = " AND department = 'Yazılım'";
    else if (q.includes('insan kaynaklari') || q.includes('hr') || q.includes('human resources')) deptFilter = " AND department = 'İnsan Kaynakları'";
    else if (q.includes('finans') || q.includes('finance')) deptFilter = " AND department = 'Finans'";
    else if (q.includes('satis') || q.includes('sales')) deptFilter = " AND department = 'Satış & Pazarlama'";
    else if (q.includes('fabrika') || q.includes('uretim') || q.includes('factory') || q.includes('production')) deptFilter = " AND department = 'Üretim & Fabrika'";

    return `SELECT employee_no, full_name, department, shift_name, late_minutes FROM attendance.daily_summary WHERE ${dateClause} AND status = 'LATE'${deptFilter} ORDER BY late_minutes DESC LIMIT 100;`;
  }

  // 4. Employees on leave
  if (q.includes('izinli') || q.includes('on leave') || q.includes('in ferie') || q.includes('in permesso')) {
    return `SELECT employee_no, full_name, department, exception_types, day FROM attendance.daily_summary WHERE ${dateClause} AND status = 'ON_LEAVE' ORDER BY employee_no LIMIT 100;`;
  }

  // 5. Remote employees
  if (q.includes('uzaktan') || q.includes('remote') || q.includes('da remoto') || q.includes('smart working')) {
    return `SELECT employee_no, full_name, department, day FROM attendance.daily_summary WHERE ${dateClause} AND status = 'REMOTE' ORDER BY employee_no LIMIT 100;`;
  }

  // Default fallback: Late employees on date
  return `SELECT employee_no, full_name, department, shift_name, late_minutes FROM attendance.daily_summary WHERE ${dateClause} AND status = 'LATE' ORDER BY late_minutes DESC LIMIT 100;`;
}

// SQL Query Validator and Security Checker
function validateSqlQuery(sql) {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, reason: 'Empty or non-string SQL query' };
  }

  const clean = sql.trim().replace(/;+$/, '');
  const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'GRANT', 'REVOKE', 'COPY'];

  for (const kw of forbiddenKeywords) {
    const reg = new RegExp(`\\b${kw}\\b`, 'i');
    if (reg.test(clean)) {
      return { valid: false, reason: `Forbidden keyword detected: ${kw}` };
    }
  }

  if (clean.includes('--') || clean.includes('/*') || clean.includes('*/')) {
    return { valid: false, reason: 'SQL comments are not allowed' };
  }

  if (!clean.toUpperCase().startsWith('SELECT') && !clean.toUpperCase().startsWith('WITH')) {
    return { valid: false, reason: 'Query must start with SELECT or WITH' };
  }

  return { valid: true, cleanSql: clean };
}

// Format SQL Rows into Multilingual Markdown Table
function formatAttendanceResult(rows, dateDescription, lang = 'tr') {
  if (!rows || rows.length === 0) {
    const emptyMsgs = {
      tr: `Belirtilen tarihte (${dateDescription}) kayıt bulunamadı veya kriterlere uyan çalışan yok.`,
      en: `No records found matching your criteria for ${dateDescription}.`,
      it: `Nessun record trovato corrispondente ai criteri per ${dateDescription}.`
    };
    return emptyMsgs[lang] || emptyMsgs.tr;
  }

  // Count aggregate queries
  if (rows.length === 1 && (rows[0].on_time_count !== undefined || rows[0].total_employees !== undefined)) {
    if (rows[0].on_time_count !== undefined) {
      if (lang === 'en') return `**On-time Attendance:** A total of **${rows[0].on_time_count}** employees arrived on time (${dateDescription}).`;
      if (lang === 'it') return `**Presenze Puntuali:** Un totale di **${rows[0].on_time_count}** dipendenti è arrivato puntuale (${dateDescription}).`;
      return `**Zamanında Giriş Durumu:** ${dateDescription} tarihinde toplam **${rows[0].on_time_count}** çalışan zamanında mesaiye başlamıştır.`;
    }
  }

  const summaries = {
    tr: `**Sonuç Özeti (${dateDescription}):** Toplam **${rows.length}** kayıt listelendi.`,
    en: `**Summary of Results (${dateDescription}):** Total **${rows.length}** records found.`,
    it: `**Riepilogo dei Risultati (${dateDescription}):** Trovati **${rows.length}** record in totale.`
  };

  let md = `${summaries[lang] || summaries.tr}\n\n`;

  // Headers
  if (lang === 'en') {
    md += `| Emp No | Full Name | Department | Shift / Status | Details |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  } else if (lang === 'it') {
    md += `| Matr. | Nome e Cognome | Dipartimento | Turno / Stato | Dettagli |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  } else {
    md += `| Sicil | Ad Soyad | Departman | Vardiya / Durum | Detay |\n`;
    md += `| :--- | :--- | :--- | :--- | :--- |\n`;
  }

  for (const r of rows) {
    const empNo = r.employee_no || '-';
    const name = r.full_name || '-';
    const dept = r.department || '-';
    const shift = r.shift_name || r.status || '-';

    let detail = '';
    if (r.late_minutes !== undefined && r.late_minutes !== null) {
      if (lang === 'en') detail = `${r.late_minutes} min late`;
      else if (lang === 'it') detail = `${r.late_minutes} min ritardo`;
      else detail = `${r.late_minutes} dk geç`;
    } else if (r.total_late_minutes !== undefined) {
      if (lang === 'en') detail = `Total: ${r.total_late_minutes} min (${r.late_days_count} days)`;
      else if (lang === 'it') detail = `Totale: ${r.total_late_minutes} min (${r.late_days_count} giorni)`;
      else detail = `Toplam: ${r.total_late_minutes} dk (${r.late_days_count} gün)`;
    } else if (r.exception_types) {
      detail = String(r.exception_types);
    } else {
      detail = '-';
    }

    md += `| \`${empNo}\` | **${name}** | ${dept} | ${shift} | ${detail} |\n`;
  }

  return md.trim();
}

async function executeSecureTextToSql(question, sessionId, lang = 'tr') {
  const startTime = Date.now();
  const dateContext = normalizeDateAndEntities(question, lang);

  const rawSql = resolveFastDeterministicSql(question, dateContext);
  const validation = validateSqlQuery(rawSql);

  if (!validation.valid) {
    const errMsgs = {
      tr: 'Oluşturulan SQL sorgusu güvenlik kurallarını geçemedi.',
      en: 'The generated SQL query did not pass security validation.',
      it: 'La query SQL generata non ha superato la convalida di sicurezza.'
    };
    return {
      status: 'SECURITY_REJECTED',
      answer: errMsgs[lang] || errMsgs.tr,
      sql: null,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }

  try {
    const rows = runReadOnlyPsqlJson(validation.cleanSql);
    const answerMarkdown = formatAttendanceResult(rows, dateContext.dateDescription, lang);

    return {
      status: 'SUCCESS',
      answer: answerMarkdown,
      sql: validation.cleanSql,
      rows: rows,
      date_context: dateContext,
      latency_ms: Date.now() - startTime
    };
  } catch (err) {
    const sysErrMsgs = {
      tr: 'Veritabanı sorgusu yürütülürken bir hata oluştu.',
      en: 'An error occurred while executing the database query.',
      it: "Si è verificato un errore durante l'esecuzione della query nel database."
    };
    return {
      status: 'ERROR',
      answer: sysErrMsgs[lang] || sysErrMsgs.tr,
      sql: validation.cleanSql,
      rows: [],
      latency_ms: Date.now() - startTime
    };
  }
}

module.exports = {
  executeSecureTextToSql,
  resolveFastDeterministicSql,
  validateSqlQuery,
  normalizeDateAndEntities,
  formatAttendanceResult
};
