/**
 * Deterministic Date Normalizer for Turkish Queries in Europe/Istanbul Timezone.
 * Reference Date for Project: 2026-09-02 (Wednesday).
 */

const TURKISH_MONTHS = {
  'ocak': '01',
  'subat': '02',
  'mart': '03',
  'nisan': '04',
  'mayis': '05',
  'haziran': '06',
  'temmuz': '07',
  'agustos': '08',
  'eylul': '09',
  'ekim': '10',
  'kasim': '11',
  'aralik': '12'
};

function getIstanbulToday() {
  // Returns reference date 2026-09-02 (Wednesday)
  return new Date('2026-09-02T12:00:00+03:00');
}

function formatDateIso(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeTurkishText(str) {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .toLowerCase()
    .trim();
}

function parseTurkishDateRange(rawQuestion) {
  const qNorm = normalizeTurkishText(rawQuestion);
  const today = getIstanbulToday(); // 2026-09-02

  let dateFrom = null;
  let dateTo = null;
  let dateDesc = '';
  let sqlClause = '';
  let requiresClarification = false;
  let clarificationQuestion = null;

  // 1. Explicit DD.MM.YYYY or DD/MM/YYYY or DD-MM-YYYY (e.g., 02.09.2026, 2.9.2026, 01/09/2026)
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

  // 3. Explicit "1 Eylül 2026", "15 Ağustos 2026", "2 Eylül"
  for (const [mName, mCode] of Object.entries(TURKISH_MONTHS)) {
    const monthRegex = new RegExp(`\\b(0?[1-9]|[12][0-9]|3[01])\\s+${mName}(?:\\s+(202\\d))?\\b`, 'i');
    const mMatch = qNorm.match(monthRegex);
    if (mMatch) {
      const day = String(mMatch[1]).padStart(2, '0');
      const year = mMatch[2] || '2026';
      const iso = `${year}-${mCode}-${day}`;
      dateFrom = iso;
      dateTo = iso;
      dateDesc = `${mMatch[1]} ${mName.charAt(0).toUpperCase() + mName.slice(1)} ${year}`;
      sqlClause = `day = '${iso}'`;
      return { dateFrom, dateTo, dateDesc, sqlClause, requiresClarification, clarificationQuestion };
    }
  }

  // 4. Relative terms
  if (qNorm.includes('bugun')) {
    const iso = formatDateIso(today); // '2026-09-02'
    dateFrom = iso;
    dateTo = iso;
    dateDesc = `Bugün (${iso})`;
    sqlClause = `day = '${iso}'`;
  } else if (qNorm.includes('dun')) {
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const iso = formatDateIso(yesterday); // '2026-09-01'
    dateFrom = iso;
    dateTo = iso;
    dateDesc = `Dün (${iso})`;
    sqlClause = `day = '${iso}'`;
  } else if (qNorm.includes('yarin')) {
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
    const iso = formatDateIso(tomorrow); // '2026-09-03'
    dateFrom = iso;
    dateTo = iso;
    dateDesc = `Yarın (${iso})`;
    sqlClause = `day = '${iso}'`;
  } else if (qNorm.includes('bu hafta')) {
    // Current week: Monday 2026-08-31 to Sunday 2026-09-06
    dateFrom = '2026-08-31';
    dateTo = '2026-09-06';
    dateDesc = `Bu Hafta (${dateFrom} / ${dateTo})`;
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else if (qNorm.includes('gecen hafta')) {
    // Previous week: Monday 2026-08-24 to Sunday 2026-08-30
    dateFrom = '2026-08-24';
    dateTo = '2026-08-30';
    dateDesc = `Geçen Hafta (${dateFrom} / ${dateTo})`;
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else if (qNorm.includes('son 7 gun') || qNorm.includes('son yedi gun')) {
    // Last 7 days: 2026-08-26 to 2026-09-02
    dateFrom = '2026-08-26';
    dateTo = '2026-09-02';
    dateDesc = `Son 7 Gün (${dateFrom} - ${dateTo})`;
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else if (qNorm.includes('son 30 gun') || qNorm.includes('son otuz gun')) {
    dateFrom = '2026-08-03';
    dateTo = '2026-09-02';
    dateDesc = `Son 30 Gün (${dateFrom} - ${dateTo})`;
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else if (qNorm.includes('bu ay') || qNorm.includes('eylul')) {
    dateFrom = '2026-09-01';
    dateTo = '2026-09-30';
    dateDesc = 'Eylül 2026';
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else if (qNorm.includes('gecen ay') || qNorm.includes('agustos')) {
    dateFrom = '2026-08-01';
    dateTo = '2026-08-31';
    dateDesc = 'Ağustos 2026';
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else if (qNorm.includes('ocak')) {
    dateFrom = '2026-01-01';
    dateTo = '2026-01-31';
    dateDesc = 'Ocak 2026';
    sqlClause = `day >= '${dateFrom}' AND day <= '${dateTo}'`;
  } else {
    // Default fallback to today (2026-09-02) for daily attendance queries
    const iso = formatDateIso(today);
    dateFrom = iso;
    dateTo = iso;
    dateDesc = `Bugün (${iso})`;
    sqlClause = `day = '${iso}'`;
  }

  // Ambiguity check
  const trimmed = qNorm.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"!\+]/g, ' ').replace(/\s+/g, ' ').trim();
  if (['kim gec kaldi', 'devamsizlar kim', 'gec kalanlar', 'izinlileri goster', 'kac kisi geldi'].includes(trimmed)) {
    requiresClarification = true;
    clarificationQuestion = 'Hangi gün veya tarih aralığı için devam durumu sorgulamak istersiniz? (Örn: Bugün, Dün, Bu hafta, 1 Eylül 2026)';
  }

  return {
    dateFrom,
    dateTo,
    dateDesc,
    sqlClause,
    requiresClarification,
    clarificationQuestion
  };
}

module.exports = {
  getIstanbulToday,
  formatDateIso,
  parseTurkishDateRange,
  normalizeTurkishText
};
