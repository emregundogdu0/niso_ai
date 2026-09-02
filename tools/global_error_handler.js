const { execSync } = require('child_process');
const crypto = require('crypto');

function runAdminPsql(sqlQuery) {
  try {
    return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
      input: Buffer.from(sqlQuery, 'utf8'),
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024
    });
  } catch (e) {
    return '';
  }
}

// Redact any possible secrets from error strings
function redactSecrets(errorStr) {
  if (!errorStr) return '';
  let str = String(errorStr);
  str = str.replace(/(?:password|secret|key|token|authorization|bearer)\s*[:=]\s*['"]?[^\s,'"]+['"]?/gi, '[REDACTED_SECRET]');
  str = str.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
  return str;
}

// Map error type to user-friendly message in target language
function categorizeError(rawError, context, lang = 'tr') {
  const errStr = (rawError?.message || rawError?.description || String(rawError || '')).toLowerCase();

  if (errStr.includes('econnrefused 11434') || errStr.includes('ollama_unavailable') || errStr.includes('ollama')) {
    const msgs = {
      tr: 'Yerel yapay zekâ modeli şu anda kullanılamıyor. Lütfen Ollama servisinin çalıştığını kontrol edin. Referans: {audit_id}',
      en: 'Local AI model service is currently unavailable. Please check if Ollama is running. Reference: {audit_id}',
      it: 'Il servizio del modello AI locale non è attualmente disponibile. Verifica che Ollama sia in esecuzione. Riferimento: {audit_id}'
    };
    return {
      code: 'OLLAMA_UNAVAILABLE',
      severity: 'HIGH',
      userMessage: msgs[lang] || msgs.tr,
      retryable: true
    };
  }

  if (errStr.includes('econnrefused 5432') || errStr.includes('postgres') || errStr.includes('connection refused')) {
    const msgs = {
      tr: 'Veri kaynağına şu anda ulaşılamıyor. Lütfen veritabanı servisini kontrol edin. Referans: {audit_id}',
      en: 'Database service is currently unreachable. Please check the database server. Reference: {audit_id}',
      it: 'Il servizio database non è attualmente raggiungibile. Verifica il server del database. Riferimento: {audit_id}'
    };
    return {
      code: 'POSTGRES_CONNECTION_ERROR',
      severity: 'HIGH',
      userMessage: msgs[lang] || msgs.tr,
      retryable: true
    };
  }

  if (errStr.includes('statement timeout') || errStr.includes('timeout')) {
    const msgs = {
      tr: 'İşlem zaman aşımına uğradı. Lütfen sorunuzu daraltarak yeniden deneyin. Referans: {audit_id}',
      en: 'The operation timed out. Please try again with a narrower query. Reference: {audit_id}',
      it: "L'operazione è scaduta. Riprova con una richiesta più mirata. Riferimento: {audit_id}"
    };
    return {
      code: 'POSTGRES_TIMEOUT',
      severity: 'MEDIUM',
      userMessage: msgs[lang] || msgs.tr,
      retryable: true
    };
  }

  if (errStr.includes('sql_guard') || errStr.includes('guard')) {
    const msgs = {
      tr: 'Bu sorgu sistem güvenlik kuralları nedeniyle çalıştırılmadı. Referans: {audit_id}',
      en: 'This query was not executed due to system security rules. Reference: {audit_id}',
      it: 'Questa query non è stata eseguita a causa delle regole di sicurezza del sistema. Riferimento: {audit_id}'
    };
    return {
      code: 'SQL_GUARD_REJECTION',
      severity: 'HIGH',
      userMessage: msgs[lang] || msgs.tr,
      retryable: false
    };
  }

  if (errStr.includes('rate_limit')) {
    const msgs = {
      tr: 'İstek kullanım sınırını aştı. Lütfen kısa bir süre bekleyip tekrar deneyin. Referans: {audit_id}',
      en: 'Rate limit exceeded. Please wait a moment before trying again. Reference: {audit_id}',
      it: 'Limite di richieste superato. Attendi un momento prima di riprovare. Riferimento: {audit_id}'
    };
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      severity: 'LOW',
      userMessage: msgs[lang] || msgs.tr,
      retryable: true
    };
  }

  const genericMsgs = {
    tr: 'İşleminiz gerçekleştirilirken beklenmeyen bir hata oluştu. Referans: {audit_id}',
    en: 'An unexpected error occurred while processing your request. Reference: {audit_id}',
    it: "Si è verificato un errore imprevisto durante l'elaborazione della richiesta. Riferimento: {audit_id}"
  };

  return {
    code: 'SYSTEM_ERROR',
    severity: 'MEDIUM',
    userMessage: genericMsgs[lang] || genericMsgs.tr,
    retryable: true
  };
}

async function handleGlobalError(context) {
  const auditId = crypto.randomUUID();
  const rawError = context.error || {};
  const workflowName = context.workflow_name || 'UNKNOWN_WORKFLOW';
  const nodeName = context.node_name || 'UNKNOWN_NODE';
  const requestId = context.request_id || 'unknown';
  const sessionId = context.session_id || 'unknown';
  const lang = context.language || 'tr';

  const categorized = categorizeError(rawError, context, lang);
  const userMessage = categorized.userMessage.replace('{audit_id}', auditId.substring(0, 8));

  try {
    const errorDetails = JSON.stringify({
      message: redactSecrets(rawError.message || String(rawError)),
      stack: redactSecrets(rawError.stack || ''),
      code: rawError.code || categorized.code,
      workflow: workflowName,
      node: nodeName
    });

    const insertSql = `
      INSERT INTO audit.error_log (
        id, request_id, session_id, workflow_name, node_name,
        error_code, severity, user_message, error_details, retryable, created_at
      ) VALUES (
        '${auditId}', '${requestId.replace(/'/g, "''")}', '${sessionId.replace(/'/g, "''")}',
        '${workflowName.replace(/'/g, "''")}', '${nodeName.replace(/'/g, "''")}',
        '${categorized.code}', '${categorized.severity}',
        '${userMessage.replace(/'/g, "''")}', '${errorDetails.replace(/'/g, "''")}',
        ${categorized.retryable}, now()
      );
    `;
    runAdminPsql(insertSql);
  } catch (dbErr) {}

  return {
    audit_id: auditId,
    error_code: categorized.code,
    user_message: userMessage,
    retryable: categorized.retryable
  };
}

module.exports = {
  handleGlobalError,
  categorizeError,
  redactSecrets
};
