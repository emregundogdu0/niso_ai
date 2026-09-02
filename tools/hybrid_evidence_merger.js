const { executeSecureTextToSql } = require('./secure_text_to_sql_engine');
const { answerProjectMailQuery } = require('./project_mail_rag_engine');
const crypto = require('crypto');

async function processHybridQuery(params) {
  const startTime = Date.now();
  const requestId = params.request_id || crypto.randomUUID();
  const sessionId = params.session_id || 'session_' + Date.now();
  const question = params.question || '';
  const lang = params.response_language || 'tr';

  const qLower = question.toLowerCase();
  const needsAttendance = qLower.includes('gecik') || qLower.includes('geç kal') || qLower.includes('giriş') || qLower.includes('devam') || qLower.includes('mesai') || qLower.includes('late') || qLower.includes('attendance') || qLower.includes('ritardo') || qLower.includes('presenze');
  const needsProjectMail = qLower.includes('proje') || qLower.includes('temsa') || qLower.includes('vortex') || qLower.includes('eldor') || qLower.includes('risk') || qLower.includes('aksiyon') || qLower.includes('project') || qLower.includes('progetto');
  const needsHrPolicy = qLower.includes('politika') || qLower.includes('kural') || qLower.includes('saat') || qLower.includes('izin') || qLower.includes('hours') || qLower.includes('orari');

  let hrEvidence = null;
  let attendanceEvidence = null;
  let projectMailEvidence = null;

  if (needsHrPolicy) {
    hrEvidence = {
      policy_code: 'HR-001',
      policy_title: lang === 'en' ? 'Working Hours Policy' : (lang === 'it' ? 'Politica sugli Orari di Lavoro' : 'Çalışma Saatleri ve Fazla Mesai Politikası'),
      summary: lang === 'en' ? 'Weekly working hours: 45h (09:00 - 18:00).' : (lang === 'it' ? 'Orario settimanale: 45 ore (09:00 - 18:00).' : 'Haftalık standart çalışma süresi 45 saattir (09:00 - 18:00).')
    };
  }

  if (needsAttendance || true) {
    try {
      const sqlResult = await executeSecureTextToSql(question, sessionId, lang);
      attendanceEvidence = {
        sql: sqlResult.sql,
        summary: sqlResult.answer,
        rows: sqlResult.rows
      };
    } catch (e) {}
  }

  if (needsProjectMail || true) {
    try {
      projectMailEvidence = await answerProjectMailQuery({
        question: question,
        session_id: sessionId,
        response_language: lang
      });
    } catch (e) {}
  }

  let mergedAnswer = '';
  if (lang === 'en') {
    mergedAnswer = `### Hybrid Multi-Source Correlation Analysis\n\n`;
    if (projectMailEvidence && projectMailEvidence.answer) {
      mergedAnswer += `#### 1. Project Communications & Status\n${projectMailEvidence.answer}\n\n`;
    }
    if (attendanceEvidence && attendanceEvidence.summary) {
      mergedAnswer += `#### 2. Attendance & Presence Data (SQL)\n${attendanceEvidence.summary}\n\n`;
    }
  } else if (lang === 'it') {
    mergedAnswer += `### Analisi di Correlazione Ibrida Multi-Fonte\n\n`;
    if (projectMailEvidence && projectMailEvidence.answer) {
      mergedAnswer += `#### 1. Comunicazioni e Stato del Progetto\n${projectMailEvidence.answer}\n\n`;
    }
    if (attendanceEvidence && attendanceEvidence.summary) {
      mergedAnswer += `#### 2. Dati Presenze e Timbrature (SQL)\n${attendanceEvidence.summary}\n\n`;
    }
  } else {
    mergedAnswer = `### Hibrit Çok Kaynaklı Korelasyon Analizi\n\n`;
    if (projectMailEvidence && projectMailEvidence.answer) {
      mergedAnswer += `#### 1. Proje E-Posta ve Durum Bilgisi\n${projectMailEvidence.answer}\n\n`;
    }
    if (attendanceEvidence && attendanceEvidence.summary) {
      mergedAnswer += `#### 2. Devam ve Puantaj Bilgisi (SQL)\n${attendanceEvidence.summary}\n\n`;
    }
  }

  const allSources = [];
  if (projectMailEvidence && projectMailEvidence.sources) {
    allSources.push(...projectMailEvidence.sources);
  }
  allSources.push({
    source_id: 'attendance.daily_summary',
    provider: 'POSTGRESQL',
    message_id: 'attendance_daily_summary',
    thread_id: null,
    title: lang === 'en' ? 'Attendance Daily Summary' : (lang === 'it' ? 'Riepilogo Giornaliero Presenze' : 'Puantaj ve Turnike Günlük Özeti'),
    sender: lang === 'en' ? 'Attendance DB' : (lang === 'it' ? 'DB Presenze' : 'Puantaj Veritabanı'),
    received_at: null,
    project_code: null,
    data_mode: 'LIVE_TEST',
    is_synthetic: false
  });

  return {
    request_id: requestId,
    session_id: sessionId,
    answer: mergedAnswer.trim(),
    status: 'SUCCESS',
    sources: allSources,
    latency_ms: Date.now() - startTime
  };
}

module.exports = {
  processHybridQuery
};
