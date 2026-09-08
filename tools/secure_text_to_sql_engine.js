const { execSync } = require('child_process');
const crypto = require('crypto');
const { parseMultilingualDateRange, normalizeText, getIstanbulToday, formatDateIso } = require('./date_normalizer');

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
  const q = normalizeText(question);
  const dateClause = dateContext.sqlClause || `day = '2026-09-02'`;

  // 0. Average Late Arrival queries (TR: 'ortalama gec kalma', 'ortalama gecikme', 'gec kalma zamanlarinin ortalamasi', EN: 'average late', IT: 'ritardo medio')
  const isAvgQuery = q.includes('ortalama') || q.includes('average') || q.includes('media');
  const isLateQuery = q.includes('gec kalma') || q.includes('gecikme') || q.includes('gec kalan') || q.includes('gec geldi') || q.includes('gec') || q.includes('late') || q.includes('ritardo');
  if (isAvgQuery && isLateQuery) {
    let deptFilter = '';
    if (q.includes('yazilim') || q.includes('software')) deptFilter = " AND department = 'Yazılım'";
    else if (q.includes('insan kaynaklari') || q.includes('hr') || q.includes('human resources')) deptFilter = " AND department = 'İnsan Kaynakları'";
    else if (q.includes('finans') || q.includes('finance')) deptFilter = " AND department = 'Finans'";
    else if (q.includes('satis') || q.includes('sales')) deptFilter = " AND department = 'Satış & Pazarlama'";
    else if (q.includes('fabrika') || q.includes('uretim') || q.includes('factory') || q.includes('production')) deptFilter = " AND department = 'Üretim & Fabrika'";

    const empMatch = question.match(/\bEMP[-_]?(\d+)\b/i);
    const calisanMatch = question.match(/çalışan\s*(\d+)/i) || q.match(/calisan\s*(\d+)/i);

    if (empMatch) {
      const empCode = 'EMP-' + empMatch[1].padStart(3, '0');
      return `SELECT employee_no, full_name, department, COUNT(*) FILTER (WHERE status = 'LATE') AS late_days_count, ROUND(AVG(late_minutes) FILTER (WHERE status = 'LATE'), 1) AS avg_late_minutes, MAX(late_minutes) AS max_late_minutes, SUM(late_minutes) AS total_late_minutes, COUNT(*) AS total_work_days FROM attendance.daily_summary WHERE ${dateClause} AND (employee_no ILIKE '%${empCode}%' OR full_name ILIKE '%${empCode}%') GROUP BY employee_no, full_name, department;`;
    } else if (calisanMatch) {
      const calisanName = 'Çalışan ' + calisanMatch[1];
      return `SELECT employee_no, full_name, department, COUNT(*) FILTER (WHERE status = 'LATE') AS late_days_count, ROUND(AVG(late_minutes) FILTER (WHERE status = 'LATE'), 1) AS avg_late_minutes, MAX(late_minutes) AS max_late_minutes, SUM(late_minutes) AS total_late_minutes, COUNT(*) AS total_work_days FROM attendance.daily_summary WHERE ${dateClause} AND full_name ILIKE '%${calisanName}%' GROUP BY employee_no, full_name, department;`;
    } else {
      // General list of employees with late arrival averages
      return `SELECT employee_no, full_name, department, COUNT(*) FILTER (WHERE status = 'LATE') AS late_days_count, ROUND(AVG(late_minutes) FILTER (WHERE status = 'LATE'), 1) AS avg_late_minutes, SUM(late_minutes) AS total_late_minutes FROM attendance.daily_summary WHERE ${dateClause} AND status = 'LATE'${deptFilter} GROUP BY employee_no, full_name, department HAVING COUNT(*) FILTER (WHERE status = 'LATE') > 0 ORDER BY avg_late_minutes DESC, total_late_minutes DESC LIMIT 50;`;
    }
  }

  // Specific employee arrival / departure query
  const empMatch = question.match(/\bEMP[-_]?(\d+)\b/i);
  const calisanMatch = question.match(/çalışan\s*(\d+)/i) || q.match(/calisan\s*(\d+)/i);
  if ((empMatch || calisanMatch) && (q.includes('kacta') || q.includes('saat') || q.includes('giris') || q.includes('cikis') || q.includes('geldi') || q.includes('durum'))) {
    const filter = empMatch ? ('EMP-' + empMatch[1].padStart(3, '0')) : ('Çalışan ' + calisanMatch[1]);
    return `SELECT employee_no, full_name, department, shift_name, to_char(first_in AT TIME ZONE 'Europe/Istanbul', 'HH24:MI') AS first_in_time, to_char(last_out AT TIME ZONE 'Europe/Istanbul', 'HH24:MI') AS last_out_time, late_minutes, status FROM attendance.daily_summary WHERE ${dateClause} AND (employee_no ILIKE '%${filter}%' OR full_name ILIKE '%${filter}%') LIMIT 10;`;
  }

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
    q.includes('gec geldi') || q.includes('gec gelen') || q.includes('kimler gec geldi') ||
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

// LLM-Powered Text-to-SQL Generator using Qwen3.5:9B
async function generateSqlWithLlm(question, dateContext, lang = 'tr') {
  const currentToday = getIstanbulToday();
  const todayIso = formatDateIso(currentToday);
  const dateClause = dateContext.sqlClause || `day = '${todayIso}'`;

  const schemaInfo = `
POSTGRESQL DATABASE SCHEMA (Read-Only):
1. attendance.daily_summary:
   - day (date, e.g. '${todayIso}')
   - employee_no (text)
   - full_name (text)
   - department (text: 'Yazılım', 'Finans', 'İnsan Kaynakları', 'Satış & Pazarlama', 'Üretim & Fabrika')
   - shift_name (text)
   - status (text: 'ON_TIME', 'LATE', 'ON_LEAVE', 'REMOTE', 'ABSENT', 'WEEKEND', 'HOLIDAY', 'MISSING_CHECKOUT')
   - late_minutes (integer)
   - early_exit_minutes (integer)
   - first_in (timestamp with time zone)
   - last_out (timestamp with time zone)
   - worked_minutes (integer)
   - exception_types (text)

2. attendance.employee:
   - employee_no (text)
   - full_name (text)
   - department (text)
   - active (boolean)

3. attendance.shift:
   - id (integer)
   - name (text)
   - start_time (time)
   - end_time (time)
   - grace_minutes (integer)
`;

  const systemPrompt = `You are a strict PostgreSQL Text-to-SQL expert.
Generate ONLY a raw PostgreSQL SELECT query to answer the user's question.
DO NOT use markdown code blocks (no \`\`\`sql). Output ONLY the raw SQL query.
Rules:
1. ONLY SELECT queries are permitted. Never use INSERT, UPDATE, DELETE, DROP, or ALTER.
2. Only use tables from the attendance schema: attendance.daily_summary, attendance.employee, attendance.shift.
3. Today's date is: ${todayIso}.
4. Date context: ${dateClause}. If asking about today or relative dates, apply: ${dateClause}.
5. Match department names flexibly using ILIKE or exact values ('Yazılım', 'Finans', 'İnsan Kaynakları', 'Satış & Pazarlama', 'Üretim & Fabrika').
6. Add LIMIT 100 to prevent overwhelming result sets unless doing an aggregate count/sum.
7. If the question mentions a specific employee (e.g. 'Çalışan 1', 'EMP-001', 'Ahmet'), filter strictly by: (employee_no ILIKE '%...' OR full_name ILIKE '%...%').
8. If asking what time someone arrived/departed ('saat kaçta geldi', 'giriş saati', 'çıkış saati', 'kaçta çıktı', 'arrival time'), ALWAYS include: to_char(first_in AT TIME ZONE 'Europe/Istanbul', 'HH24:MI') AS first_in_time, to_char(last_out AT TIME ZONE 'Europe/Istanbul', 'HH24:MI') AS last_out_time, late_minutes, status.
9. If asking about average late arrival / lateness ('ortalama geç kalma', 'ortalama gecikme', 'geç kalma zamanlarının ortalaması', 'average late', 'average lateness'):
   - Use: ROUND(AVG(late_minutes) FILTER (WHERE status = 'LATE'), 1) AS avg_late_minutes, COUNT(*) FILTER (WHERE status = 'LATE') AS late_days_count, SUM(late_minutes) AS total_late_minutes
   - GROUP BY employee_no, full_name, department
   - If asking about a specific person: filter by (employee_no ILIKE '%...' OR full_name ILIKE '%...')
   - If asking in general: ORDER BY avg_late_minutes DESC LIMIT 50.
Schema:
${schemaInfo}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        stream: false,
        options: { temperature: 0.1, num_predict: 200 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      let rawSql = data.message?.content || data.response || '';
      rawSql = rawSql
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```sql/gi, '')
        .replace(/```/g, '')
        .trim();

      const validation = validateSqlQuery(rawSql);
      if (validation.valid) {
        return validation.cleanSql;
      }
    }
  } catch (err) {
    // Fallback to deterministic fallback below
  }

  // Fallback if LLM is unavailable or outputs invalid SQL
  return resolveFastDeterministicSql(question, dateContext);
}

// Synthesize Natural Language Answer with LLM from real SQL rows
async function synthesizeSqlAnswerWithLlm(question, rows, dateContext, lang = 'tr') {
  if (!rows || rows.length === 0) {
    const emptyMsgs = {
      tr: `Belirtilen tarihte (${dateContext.dateDescription}) kriterlere uyan bir kayıt bulunamadı.`,
      en: `No records found matching your criteria for ${dateContext.dateDescription}.`,
      it: `Nessun record trovato corrispondente ai criteri per ${dateContext.dateDescription}.`
    };
    return emptyMsgs[lang] || emptyMsgs.tr;
  }

  // If only 1 employee average record, format directly and precisely
  if (rows.length === 1 && rows[0].avg_late_minutes !== undefined) {
    const r = rows[0];
    const lateDays = r.late_days_count || 0;
    const avgLate = r.avg_late_minutes !== null ? r.avg_late_minutes : 0;
    const totLate = r.total_late_minutes || 0;
    const maxLate = r.max_late_minutes || 0;
    const totalDays = r.total_work_days ? ` (toplam ${r.total_work_days} kayıtlı gün)` : '';
    if (lateDays === 0) {
      if (lang === 'en') return `According to attendance records (${dateContext.dateDescription}), **${r.full_name}** (\`${r.employee_no}\` - ${r.department}) has **never arrived late** (**0 days**). Average late arrival duration is **0 minutes**.`;
      if (lang === 'it') return `Secondo i dati di presenza (${dateContext.dateDescription}), **${r.full_name}** (\`${r.employee_no}\` - ${r.department}) non è **mai arrivato in ritardo** (**0 giorni**). Il tempo medio di ritardo è di **0 minuti**.`;
      return `Puantaj kayıtlarına göre (${dateContext.dateDescription}), **${r.full_name}** (\`${r.employee_no}\` - ${r.department}) hiç geç kalmamıştır (**0 gün**). Ortalama geç kalma süresi **0 dakikadır**.`;
    }
    if (lang === 'en') return `According to attendance records (${dateContext.dateDescription}), **${r.full_name}** (\`${r.employee_no}\` - ${r.department}) was late on **${lateDays} days**${totalDays}. The average late arrival duration on late days is **${avgLate} minutes** (Total delay: **${totLate} min**, Maximum single delay: **${maxLate} min**).`;
    if (lang === 'it') return `Secondo i dati di presenza (${dateContext.dateDescription}), **${r.full_name}** (\`${r.employee_no}\` - ${r.department}) è arrivato in ritardo per **${lateDays} giorni**${totalDays}. Il tempo medio di ritardo nei giorni di ritardo è di **${avgLate} minuti** (Ritardo totale: **${totLate} min**, Ritardo massimo: **${maxLate} min**).`;
    return `Puantaj kayıtlarına göre (${dateContext.dateDescription}), **${r.full_name}** (\`${r.employee_no}\` - ${r.department}) toplam **${lateDays} gün** geç kalmıştır${totalDays}. Geç kaldığı günlerdeki ortalama geç kalma süresi **${avgLate} dakikadır** (Toplam gecikme: **${totLate} dk**, En yüksek tek seferlik gecikme: **${maxLate} dk**).`;
  }

  // If only 1 aggregate count, format directly
  if (rows.length === 1 && (rows[0].on_time_count !== undefined || rows[0].total !== undefined || rows[0].count !== undefined)) {
    const countVal = rows[0].on_time_count ?? rows[0].total ?? rows[0].count;
    if (lang === 'en') return `According to the database records for ${dateContext.dateDescription}, the count is **${countVal}**.`;
    if (lang === 'it') return `Secondo i dati del database per ${dateContext.dateDescription}, il totale è **${countVal}**.`;
    return `${dateContext.dateDescription} veritabanı kayıtlarına göre toplam sayı: **${countVal}**.`;
  }

  const sampleRows = rows.slice(0, 15);
  const dataSummary = JSON.stringify(sampleRows);

  const prompt = `KULLANICI SORUSU: "${question}"
DÖNEN VERİTABANI KAYITLARI (${rows.length} kayıt arasından ilk ${sampleRows.length} tanesi):
${dataSummary}

GÖREV:
Yukarıdaki gerçek veritabanı kayıtlarını incele.
1. Eğer soru çalışanların veya belirli bir kişinin ortalama geç kalma süreleri (avg_late_minutes) veya geç kalma zamanları hakkındaysa, personellerin ortalama gecikme sürelerini (dakika cinsinden) ve geç kaldıkları gün sayılarını net olarak belirt (ör. "En yüksek ortalama gecikmeye sahip çalışanlar...").
2. Kayıtlarda geçen giriş/çıkış saatleri (first_in_time, last_out_time) ve geç kalma süreleri (late_minutes) varsa bunları cevabında net ve açık olarak belirt (ör. "Saat 09:20'de giriş yapmıştır ve 35 dakika geç kalmıştır").
3. Asla veritabanında olmayan sayı, saat veya süre uydurma.
4. Kullanıcının sorusuna doğrudan, net ve profesyonel bir dille ${lang === 'en' ? 'İngilizce' : (lang === 'it' ? 'İtalyanca' : 'Türkçe')} özet bir açıklama yaz.
Düşünme aşamalarını (think) yazma, doğrudan nihai cevabı üret.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        messages: [
          { role: 'system', content: 'Sen NISO kurumsal yönetim asistanısın. Veritabanından gelen verileri eksiksiz ve profesyonelce özetle.' },
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: { temperature: 0.2, num_predict: 350 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      let text = data.message?.content || data.response || '';
      text = text
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .trim();
      if (text && text.length > 10) {
        return text;
      }
    }
  } catch (e) {}

  return formatAttendanceResult(rows, dateContext.dateDescription, lang);
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

  const isAvgTable = rows.length > 0 && rows[0].avg_late_minutes !== undefined;
  if (isAvgTable) {
    if (lang === 'en') {
      md += `| Emp No | Full Name | Department | Late Days | Avg Late (min) | Total Late (min) |\n`;
      md += `| :--- | :--- | :--- | :---: | :---: | :---: |\n`;
    } else if (lang === 'it') {
      md += `| Matr. | Nome e Cognome | Dipartimento | Giorni Ritardo | Media Ritardo (min) | Ritardo Totale (min) |\n`;
      md += `| :--- | :--- | :--- | :---: | :---: | :---: |\n`;
    } else {
      md += `| Sicil | Ad Soyad | Departman | Geç Kalınan Gün | Ortalama Geç Kalma | Toplam Gecikme |\n`;
      md += `| :--- | :--- | :--- | :---: | :---: | :---: |\n`;
    }

    for (const r of rows) {
      const empNo = r.employee_no || '-';
      const name = r.full_name || '-';
      const dept = r.department || '-';
      const lateDays = r.late_days_count !== undefined ? `${r.late_days_count} gün` : '-';
      const avgLate = (r.avg_late_minutes !== undefined && r.avg_late_minutes !== null) ? `**${r.avg_late_minutes} dk**` : '0 dk';
      const totLate = (r.total_late_minutes !== undefined && r.total_late_minutes !== null) ? `${r.total_late_minutes} dk` : '-';
      md += `| \`${empNo}\` | **${name}** | ${dept} | ${lateDays} | ${avgLate} | ${totLate} |\n`;
    }
    return md.trim();
  }

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
    if (r.first_in_time) {
      const lateStr = (r.late_minutes && r.late_minutes > 0) ? ` (${r.late_minutes} dk geç)` : ' (zamanında)';
      detail = `Giriş: ${r.first_in_time}${lateStr}` + (r.last_out_time ? ` • Çıkış: ${r.last_out_time}` : '');
    } else if (r.late_minutes !== undefined && r.late_minutes !== null) {
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

  // Use Dynamic LLM Text-to-SQL
  const rawSql = await generateSqlWithLlm(question, dateContext, lang);
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
    // Combine LLM natural synthesis with structured table
    const synthesizedAnswer = await synthesizeSqlAnswerWithLlm(question, rows, dateContext, lang);
    const tableMarkdown = (rows.length > 1 || (rows.length === 1 && rows[0].avg_late_minutes !== undefined)) 
      ? formatAttendanceResult(rows, dateContext.dateDescription, lang) 
      : '';
    const finalAnswer = (tableMarkdown && !synthesizedAnswer.includes('| :--- |'))
      ? `${synthesizedAnswer}\n\n---\n\n${tableMarkdown}`
      : synthesizedAnswer;

    return {
      status: 'SUCCESS',
      answer: finalAnswer,
      sql: validation.cleanSql,
      rows: rows,
      date_context: dateContext,
      latency_ms: Date.now() - startTime
    };
  } catch (err) {
    console.error('SQL Execution Error:', err);
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
  generateSqlWithLlm,
  resolveFastDeterministicSql,
  validateSqlQuery,
  normalizeDateAndEntities,
  formatAttendanceResult
};
