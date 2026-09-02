/**
 * Multilingual Deterministic Date Normalizer (TR, EN, IT)
 * Reference Date for System: 2026-09-02 (Wednesday, Europe/Istanbul).
 */

const MONTHS = {
  // Turkish
  'ocak': '01', 'subat': '02', 'mart': '03', 'nisan': '04', 'mayis': '05', 'haziran': '06',
  'temmuz': '07', 'agustos': '08', 'eylul': '09', 'ekim': '10', 'kasim': '11', 'aralik': '12',
  // English
  'january': '01', 'february': '02', 'march': '03', 'april': '04', 'may': '05', 'june': '06',
  'july': '07', 'august': '08', 'september': '09', 'october': '10', 'november': '11', 'december': '12',
  'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'jun': '06', 'jul': '07', 'aug': '08', 'sep': '09', 'sept': '09', 'oct': '10', 'nov': '11', 'dec': '12',
  // Italian
  'gennaio': '01', 'febbraio': '02', 'marzo': '03', 'aprile': '04', 'maggio': '05', 'giugno': '06',
  'luglio': '07', 'agosto': '08', 'settembre': '09', 'ottobre': '10', 'novembre': '11', 'dicembre': '12'
};

function getIstanbulToday() {
  return new Date('2026-09-02T12:00:00+03:00');
}

function formatDateIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeText(str) {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i').replace(/I/g, 'i').replace(/ı/g, 'i')
    .replace(/ç/g, 'c').replace(/Ç/g, 'c').replace(/ğ/g, 'g').replace(/Ğ/g, 'g')
    .replace(/ö/g, 'o').replace(/Ö/g, 'o').replace(/ş/g, 's').replace(/Ş/g, 's')
    .replace(/ü/g, 'u').replace(/Ü/g, 'u').replace(/é/g, 'e').replace(/è/g, 'e')
    .replace(/à/g, 'a').replace(/ò/g, 'o').replace(/ù/g, 'u')
    .replace(/[’‘`]/g, "'")
    .replace(/[“”]/g, '"')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_'~()?'"\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseTurkishDateRange(rawQuestion, lang = 'tr') {
  return parseMultilingualDateRange(rawQuestion, lang);
}

function parseMultilingualDateRange(rawQuestion, lang = 'tr') {
  const qNorm = normalizeText(rawQuestion);
  const today = getIstanbulToday(); // 2026-09-02

  let dateFrom = null;
  let dateTo = null;
  let dateDesc = '';
  let sqlClause = '';
  let requiresClarification = false;
  let clarificationQuestion = null;

  // 1. Explicit DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyyMatch = rawQuestion.match(/\b(0?[1-9]|[12][0-9]|3[01])[./-](0?[1-9]|1[0-2])[./-](202\d)\b/);
  if (ddmmyyyyMatch) {
    const day = String(ddmmyyyyMatch[1]).padStart(2, '0');
    const month = String(ddmmyyyyMatch[2]).padStart(2, '0');
    const year = ddmmyyyyMatch[3];
    const iso = `${year}-${month}-${day}`;
    dateFrom = iso;
    dateTo = iso;
    dateDesc = `${day}.${month}.${year}`;
    sqlClause = `day = '${iso}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 2. Explicit YYYY-MM-DD
  const isoMatch = rawQuestion.match(/\b(202\d)-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\b/);
  if (isoMatch) {
    const iso = isoMatch[0];
    dateFrom = iso;
    dateTo = iso;
    dateDesc = iso;
    sqlClause = `day = '${iso}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 3. Named month matching (e.g. "1 Eylül 2026", "September 2", "2 settembre")
  for (const [mName, mCode] of Object.entries(MONTHS)) {
    const regex1 = new RegExp(`\\b(0?[1-9]|[12][0-9]|3[01])\\s+${mName}(?:\\s+(202\\d))?\\b`, 'i');
    const regex2 = new RegExp(`\\b${mName}\\s+(0?[1-9]|[12][0-9]|3[01])(?:st|nd|rd|th)?(?:\\s*,?\\s+(202\\d))?\\b`, 'i');

    const mMatch1 = qNorm.match(regex1);
    const mMatch2 = qNorm.match(regex2);
    const mMatch = mMatch1 || mMatch2;

    if (mMatch) {
      const day = String(mMatch1 ? mMatch1[1] : mMatch2[1]).padStart(2, '0');
      const year = (mMatch1 ? mMatch1[2] : mMatch2[2]) || '2026';
      const iso = `${year}-${mCode}-${day}`;
      dateFrom = iso;
      dateTo = iso;
      dateDesc = `${day} ${mName} ${year}`;
      sqlClause = `day = '${iso}'`;
      return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
    }
  }

  // 4. Relative terms: Today / Bugün / Oggi
  if (qNorm.includes('bugun') || qNorm.includes('today') || qNorm.includes('oggi')) {
    const iso = formatDateIso(today);
    dateFrom = iso;
    dateTo = iso;
    dateDesc = lang === 'en' ? `Today (${iso})` : (lang === 'it' ? `Oggi (${iso})` : `Bugün (${iso})`);
    sqlClause = `day = '${iso}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 5. Relative terms: Yesterday / Dün / Ieri
  if (qNorm.includes('dun') || qNorm.includes('yesterday') || qNorm.includes('ieri')) {
    const yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    const iso = formatDateIso(yest);
    dateFrom = iso;
    dateTo = iso;
    dateDesc = lang === 'en' ? `Yesterday (${iso})` : (lang === 'it' ? `Ieri (${iso})` : `Dün (${iso})`);
    sqlClause = `day = '${iso}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 6. Relative terms: This Week / Bu Hafta / Questa Settimana
  if (qNorm.includes('bu hafta') || qNorm.includes('this week') || qNorm.includes('questa settimana')) {
    dateFrom = '2026-08-31';
    dateTo = '2026-09-06';
    dateDesc = lang === 'en' ? 'This Week (31.08.2026 - 06.09.2026)' : (lang === 'it' ? 'Questa Settimana (31.08.2026 - 06.09.2026)' : 'Bu Hafta (31.08.2026 - 06.09.2026)');
    sqlClause = `day BETWEEN '${dateFrom}' AND '${dateTo}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 7. Relative terms: Last Week / Geçen Hafta / Settimana Scorsa
  if (qNorm.includes('gecen hafta') || qNorm.includes('last week') || qNorm.includes('settimana scorsa')) {
    dateFrom = '2026-08-24';
    dateTo = '2026-08-30';
    dateDesc = lang === 'en' ? 'Last Week (24.08.2026 - 30.08.2026)' : (lang === 'it' ? 'Settimana Scorsa (24.08.2026 - 30.08.2026)' : 'Geçen Hafta (24.08.2026 - 30.08.2026)');
    sqlClause = `day BETWEEN '${dateFrom}' AND '${dateTo}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 8. Relative terms: Last 7 Days / Son 7 Gün / Ultimi 7 Giorni
  if (qNorm.includes('son 7 gun') || qNorm.includes('son yedi gun') || qNorm.includes('last 7 days') || qNorm.includes('ultimi 7 giorni')) {
    dateFrom = '2026-08-27';
    dateTo = '2026-09-02';
    dateDesc = lang === 'en' ? 'Last 7 Days (27.08.2026 - 02.09.2026)' : (lang === 'it' ? 'Ultimi 7 Giorni (27.08.2026 - 02.09.2026)' : 'Son 7 Gün (27.08.2026 - 02.09.2026)');
    sqlClause = `day BETWEEN '${dateFrom}' AND '${dateTo}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 9. Relative terms: This Month / Bu Ay / Questo Mese
  if (qNorm.includes('bu ay') || qNorm.includes('this month') || qNorm.includes('questo mese') || qNorm.includes('eylul ayi') || qNorm.includes('september')) {
    dateFrom = '2026-09-01';
    dateTo = '2026-09-30';
    dateDesc = lang === 'en' ? 'September 2026 (01.09.2026 - 30.09.2026)' : (lang === 'it' ? 'Settembre 2026 (01.09.2026 - 30.09.2026)' : 'Eylül 2026 (01.09.2026 - 30.09.2026)');
    sqlClause = `day BETWEEN '${dateFrom}' AND '${dateTo}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // 10. Relative terms: Last Month / Geçen Ay / Mese Scorso
  if (qNorm.includes('gecen ay') || qNorm.includes('last month') || qNorm.includes('mese scorso') || qNorm.includes('agustos ayi') || qNorm.includes('august')) {
    dateFrom = '2026-08-01';
    dateTo = '2026-08-31';
    dateDesc = lang === 'en' ? 'August 2026 (01.08.2026 - 31.08.2026)' : (lang === 'it' ? 'Agosto 2026 (01.08.2026 - 31.08.2026)' : 'Ağustos 2026 (01.08.2026 - 31.08.2026)');
    sqlClause = `day BETWEEN '${dateFrom}' AND '${dateTo}'`;
    return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
  }

  // Default: Today
  const iso = formatDateIso(today);
  dateFrom = iso;
  dateTo = iso;
  dateDesc = lang === 'en' ? `Today (${iso})` : (lang === 'it' ? `Oggi (${iso})` : `Bugün (${iso})`);
  sqlClause = `day = '${iso}'`;
  return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
}

module.exports = {
  parseTurkishDateRange,
  parseMultilingualDateRange,
  getIstanbulToday,
  formatDateIso,
  normalizeText
};
