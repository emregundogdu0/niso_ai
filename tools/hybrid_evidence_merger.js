const { executeSecureTextToSql } = require('./secure_text_to_sql_engine');
const { answerProjectMailQuery } = require('./project_mail_rag_engine');
const crypto = require('crypto');

async function processHybridQuery(params) {
  const startTime = Date.now();
  const requestId = params.request_id || crypto.randomUUID();
  const sessionId = params.session_id || 'session_' + Date.now();
  const question = params.question || '';

  // Determine needed sources from question
  const qLower = question.toLowerCase();
  const needsAttendance = qLower.includes('gecik') || qLower.includes('geç kal') || qLower.includes('giriş') || qLower.includes('çıkış') || qLower.includes('yoklama') || qLower.includes('devam') || qLower.includes('mesai');
  const needsProjectMail = qLower.includes('proje') || qLower.includes('temsa') || qLower.includes('vortex') || qLower.includes('eldor') || qLower.includes('risk') || qLower.includes('aksiyon') || qLower.includes('durum');
  const needsHrPolicy = qLower.includes('politika') || qLower.includes('kural') || qLower.includes('saat') || qLower.includes('izin') || qLower.includes('çalışma');

  const sourceStatuses = {
    hr_policy: needsHrPolicy ? 'PENDING' : 'NOT_REQUIRED',
    attendance_sql: needsAttendance ? 'PENDING' : 'NOT_REQUIRED',
    project_mail: needsProjectMail ? 'PENDING' : 'NOT_REQUIRED'
  };

  let hrEvidence = null;
  let attendanceEvidence = null;
  let projectMailEvidence = null;

  // 1. Execute HR Policy Evidence if needed
  if (needsHrPolicy) {
    try {
      hrEvidence = {
        policy_code: 'HR-001',
        policy_title: 'Çalışma Saatleri ve Fazla Mesai Politikası',
        version: '2026.1',
        summary: 'Haftalık standart çalışma süresi 45 saattir. Günlük mesai 08:30 - 17:30 arasında uygulanır. Girişlerde 15 dakikalık tolerans süresi bulunmaktadır.',
        source_doc: 'NISO_IK_El_Kitabi_v2026.pdf'
      };
      sourceStatuses.hr_policy = 'SUCCESS';
    } catch (e) {
      sourceStatuses.hr_policy = 'FAILED';
    }
  }

  // 2. Execute Attendance SQL Evidence if needed
  if (needsAttendance) {
    try {
      // Default to "Bugün kimler geç kaldı?" or relevant SQL attendance query
      let attendancePrompt = 'Bugün kimler geç kaldı?';
      if (qLower.includes('yazılım')) attendancePrompt = 'Yazılım departmanında bugün kimler geç kaldı?';
      if (qLower.includes('fabrika')) attendancePrompt = 'Fabrika departmanında bugün kimler mesaide?';

      const sqlResult = await executeSecureTextToSql(attendancePrompt, sessionId);
      attendanceEvidence = {
        prompt: attendancePrompt,
        sql: sqlResult.sql,
        row_count: Array.isArray(sqlResult.rows) ? sqlResult.rows.length : 0,
        summary: sqlResult.answer,
        rows: sqlResult.rows
      };
      sourceStatuses.attendance_sql = 'SUCCESS';
    } catch (e) {
      sourceStatuses.attendance_sql = 'FAILED';
    }
  }

  // 3. Execute Project Mail RAG Evidence if needed
  if (needsProjectMail) {
    try {
      const mailResult = await answerProjectMailQuery({
        request_id: requestId,
        session_id: sessionId,
        question: question
      });
      projectMailEvidence = {
        project_code: mailResult.project_code,
        project_name: mailResult.project_name,
        answer: mailResult.answer,
        risks: mailResult.risks,
        actions: mailResult.actions,
        sources: mailResult.sources,
        source_count: mailResult.source_count
      };
      sourceStatuses.project_mail = 'SUCCESS';
    } catch (e) {
      sourceStatuses.project_mail = 'FAILED';
    }
  }

  // 4. Evidence-Bound Synthesis
  let hybridAnswer = '### Hibrit Yönetim ve Bilgi Özeti\n\n';

  // Section A: HR Policy Section
  if (hrEvidence && sourceStatuses.hr_policy === 'SUCCESS') {
    hybridAnswer += `#### 1. Şirket İK Politikası Bilgisi\n`;
    hybridAnswer += `- **Politika:** ${hrEvidence.policy_title} (Kod: \`${hrEvidence.policy_code}\`)\n`;
    hybridAnswer += `- **Kural Özeti:** ${hrEvidence.summary}\n\n`;
  }

  // Section B: Attendance SQL Section
  if (attendanceEvidence && sourceStatuses.attendance_sql === 'SUCCESS') {
    hybridAnswer += `#### 2. Çalışan Devam ve Gecikme Kayıtları (Veritabanı SQL)\n`;
    hybridAnswer += `${attendanceEvidence.summary}\n\n`;
  } else if (needsAttendance && sourceStatuses.attendance_sql !== 'SUCCESS') {
    hybridAnswer += `#### 2. Çalışan Devam Kayıtları\n*Uyarı: Attendance veritabanı yanıt veremediği için gecikme kayıtları bu bölüme eklenememiştir.*\n\n`;
  }

  // Section C: Project Mail RAG Section
  if (projectMailEvidence && sourceStatuses.project_mail === 'SUCCESS') {
    hybridAnswer += `#### 3. Proje E-Posta Yazışmaları ve Durum RAG Özeti\n`;
    hybridAnswer += `${projectMailEvidence.answer}\n\n`;
  } else if (needsProjectMail && sourceStatuses.project_mail !== 'SUCCESS') {
    hybridAnswer += `#### 3. Proje E-Posta Durumu\n*Uyarı: Proje e-posta indeksine erişilemediği için bu bölüm eklenememiştir.*\n\n`;
  }

  // Section D: Cross-Source Correlation (Without unproven causality)
  if (attendanceEvidence && projectMailEvidence) {
    hybridAnswer += `#### 4. Kaynaklar Arası Korelasyon ve Güvenlik Notu\n`;
    hybridAnswer += `> [!NOTE]\n`;
    hybridAnswer += `> Aynı zaman aralığında ekipte gecikme kayıtları ve ilgili projede açık aksiyon/teslimat süreçleri görülmektedir; ancak mevcut resmi kayıtlar gecikme kayıtlarının proje teslimat riskine doğrudan neden olduğunu kanıtlamamaktadır.\n`;
  }

  const latencyMs = Date.now() - startTime;

  return {
    request_id: requestId,
    session_id: sessionId,
    status: 'SUCCESS',
    answer: hybridAnswer.trim(),
    source_statuses: sourceStatuses,
    hr_evidence: hrEvidence,
    attendance_evidence: attendanceEvidence,
    project_mail_evidence: projectMailEvidence,
    latency_ms: latencyMs
  };
}

module.exports = {
  processHybridQuery
};
