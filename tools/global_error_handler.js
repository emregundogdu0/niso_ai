const { execSync } = require('child_process');
const crypto = require('crypto');

function runAdminPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

// Redact any possible secrets from error strings
function redactSecrets(errorStr) {
  if (!errorStr) return '';
  let str = String(errorStr);
  str = str.replace(/(?:password|secret|key|token|authorization|bearer)\s*[:=]\s*['"]?[^\s,'"]+['"]?/gi, '[REDACTED_SECRET]');
  str = str.replace(/Bearer\s+[A-Za-z0-9\-\._~\+\/]+=*/gi, 'Bearer [REDACTED_TOKEN]');
  return str;
}

// Map error type to user-friendly message and category
function categorizeError(rawError, context) {
  const errStr = (rawError?.message || rawError?.description || String(rawError || '')).toLowerCase();
  const ctx = context || {};

  if (errStr.includes('econnrefused 11434') || errStr.includes('ollama_unavailable') || errStr.includes('ollama')) {
    return {
      code: 'OLLAMA_UNAVAILABLE',
      severity: 'HIGH',
      userMessage: `Yerel yapay zekâ modeli şu anda kullanılamıyor. Lütfen Ollama servisinin çalıştığını kontrol edin. Referans: {audit_id}`,
      retryable: true
    };
  }

  if (errStr.includes('econnrefused 5432') || errStr.includes('postgres') || errStr.includes('connection refused')) {
    return {
      code: 'POSTGRES_CONNECTION_ERROR',
      severity: 'HIGH',
      userMessage: `Veri kaynağına şu anda ulaşılamıyor. Lütfen veritabanı servisini kontrol edin. Referans: {audit_id}`,
      retryable: true
    };
  }

  if (errStr.includes('statement timeout') || errStr.includes('lock_timeout') || errStr.includes('timeout')) {
    return {
      code: 'POSTGRES_TIMEOUT',
      severity: 'MEDIUM',
      userMessage: `İşlem zaman aşımına uğradı. Lütfen sorunuzu daraltarak yeniden deneyin. Referans: {audit_id}`,
      retryable: true
    };
  }

  if (errStr.includes('sql_guard') || errStr.includes('yasaklı') || errStr.includes('guard')) {
    return {
      code: 'SQL_GUARD_REJECTION',
      severity: 'HIGH',
      userMessage: `Bu sorgu sistem güvenlik kuralları nedeniyle çalıştırılmadı. Referans: {audit_id}`,
      retryable: false
    };
  }

  if (errStr.includes('prompt_injection') || errStr.includes('injection')) {
    return {
      code: 'PROMPT_INJECTION_DETECTED',
      severity: 'CRITICAL',
      userMessage: `Güvenlik Kalkanı: Girdiniz güvenlik politikaları nedeniyle işleme alınmadı. Referans: {audit_id}`,
      retryable: false
    };
  }

  if (errStr.includes('rate_limit') || errStr.includes('dakikada')) {
    return {
      code: 'RATE_LIMIT_EXCEEDED',
      severity: 'LOW',
      userMessage: `İstek kullanım sınırını aştı. Lütfen kısa bir süre bekleyip tekrar deneyin. Referans: {audit_id}`,
      retryable: true
    };
  }

  if (errStr.includes('outlook') && (errStr.includes('not configured') || errStr.includes('pasif') || errStr.includes('placeholder'))) {
    return {
      code: 'OUTLOOK_NOT_CONFIGURED',
      severity: 'LOW',
      userMessage: `Outlook e-posta kaynağı henüz etkinleştirilmemiştir. Gmail kaynakları kullanılmaya devam ediyor. Referans: {audit_id}`,
      retryable: false
    };
  }

  if (errStr.includes('no_evidence') || errStr.includes('yetersiz kanıt')) {
    return {
      code: 'NO_EVIDENCE',
      severity: 'LOW',
      userMessage: `Bu soruyu destekleyecek yeterli ve doğrulanmış şirket içi kaynak bulunamadı. Referans: {audit_id}`,
      retryable: false
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    severity: 'MEDIUM',
    userMessage: `İşlem sırasında beklenmeyen bir durum oluştu. Lütfen tekrar deneyin. Referans: {audit_id}`,
    retryable: true
  };
}

async function handleGlobalError(errorPayload) {
  const auditId = crypto.randomUUID();
  const requestId = errorPayload.request_id || crypto.randomUUID();
  const sessionId = errorPayload.session_id || 'unknown_session';
  const workflowName = errorPayload.workflow_name || 'UNKNOWN_WORKFLOW';
  const rawError = errorPayload.error || {};

  const cleanErrorText = redactSecrets(rawError.message || rawError.description || String(rawError));
  const cat = categorizeError(cleanErrorText, errorPayload);
  const formattedUserMessage = cat.userMessage.replace('{audit_id}', auditId);

  // 1. Audit chat_request with ERROR status
  try {
    const chatAuditSql = `
      INSERT INTO audit.chat_request (
        request_id, session_id, question, redacted_question, intent,
        status, error_code, latency_ms, metadata, created_at
      ) VALUES (
        '${requestId}', '${sessionId}', '[ERROR_IN_EXECUTION]', '[ERROR_IN_EXECUTION]', 'ERROR',
        'ERROR', '${cat.code}', ${errorPayload.latency_ms || 0},
        '${JSON.stringify({ workflow: workflowName, error: cleanErrorText }).replace(/'/g, "''")}'::jsonb, now()
      );
    `;
    runAdminPsql(chatAuditSql);
  } catch (e) {}

  // 2. Audit security_event if severity is HIGH or CRITICAL
  if (['HIGH', 'CRITICAL'].includes(cat.severity)) {
    try {
      const secEventSql = `
        INSERT INTO audit.security_event (
          event_id, request_id, event_type, severity,
          route, description, action_taken, created_at
        ) VALUES (
          '${auditId}', '${requestId}', '${cat.code}', '${cat.severity}',
          '${workflowName}', '${cleanErrorText.replace(/'/g, "''")}', 'ERROR_RESPONSE_RETURNED', now()
        );
      `;
      runAdminPsql(secEventSql);
    } catch (e) {}
  }

  return {
    audit_id: auditId,
    request_id: requestId,
    session_id: sessionId,
    status: 'ERROR',
    error_code: cat.code,
    severity: cat.severity,
    retryable: cat.retryable,
    user_message: formattedUserMessage,
    redacted_error: cleanErrorText
  };
}

module.exports = {
  handleGlobalError,
  categorizeError,
  redactSecrets
};
