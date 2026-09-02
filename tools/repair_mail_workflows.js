const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function loadWorkflow(filename) {
  const file = path.join(root, filename);
  return { file, workflow: JSON.parse(fs.readFileSync(file, 'utf8')) };
}

function nodeByName(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  if (!node) throw new Error(`Workflow node not found: ${name}`);
  return node;
}

function saveWorkflow(file, workflow) {
  fs.writeFileSync(file, `${JSON.stringify(workflow, null, 2)}\n`, 'utf8');
}

const gmailTransform = String.raw`const item = $input.first().json;

const headers = item.payload?.headers || item.headers || [];

function getHeader(name) {
  if (Array.isArray(headers)) {
    const header = headers.find((entry) => String(entry.name || '').toLowerCase() === name.toLowerCase());
    return header?.value || null;
  }

  const key = Object.keys(headers).find((entry) => entry.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

function addressText(value) {
  if (!value) return '';
  if (Array.isArray(value)) return value.map(addressText).filter(Boolean).join(', ');
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    const address = String(value.address || value.email || '').trim();
    const name = String(value.name || '').trim();
    return name && address ? name + ' <' + address + '>' : address || name;
  }
  return String(value).trim();
}

function addressList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(addressText).filter(Boolean);
  const text = addressText(value);
  return text ? text.split(',').map((entry) => entry.trim()).filter(Boolean) : [];
}

const fromValue = item.from || getHeader('From');
const fromHeader = addressText(fromValue);
const fromName = typeof fromValue === 'object' && !Array.isArray(fromValue)
  ? String(fromValue.name || '').trim()
  : fromHeader.split('<')[0].trim().replace(/"/g, '');
const toAddresses = addressList(item.to || getHeader('To'));
const ccAddresses = addressList(item.cc || getHeader('Cc'));
const subject = item.subject || getHeader('Subject') || item.snippet || '(Başlıksız E-posta)';
const dateValue = item.date || getHeader('Date') || item.internalDate;
const parsedDate = dateValue ? new Date(dateValue) : new Date();
const isoDate = Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString();
const messageId = item.messageId || getHeader('Message-ID') || getHeader('Message-Id') || ('gmail-' + item.id);

let plainText = item.text || item.snippet || '';
let htmlBody = item.html || item.textAsHtml || '';

if (!item.text && item.payload?.body?.data) {
  plainText = Buffer.from(item.payload.body.data, 'base64').toString('utf8');
} else if (!item.text && item.payload?.parts) {
  for (const part of item.payload.parts) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      plainText = Buffer.from(part.body.data, 'base64').toString('utf8');
    } else if (part.mimeType === 'text/html' && part.body?.data) {
      htmlBody = Buffer.from(part.body.data, 'base64').toString('utf8');
    }
  }
}

return [{
  json: {
    provider: 'GMAIL',
    mailbox_address: 'eldornisoai@gmail.com',
    provider_message_id: item.id,
    provider_thread_id: item.threadId || null,
    internet_message_id: messageId,
    from_address: fromHeader,
    from_name: fromName,
    to_addresses: toAddresses,
    cc_addresses: ccAddresses,
    bcc_visible: false,
    reply_to_address: addressText(getHeader('Reply-To')) || null,
    subject,
    received_at: isoDate,
    sent_at: isoDate,
    in_reply_to: getHeader('In-Reply-To'),
    references: getHeader('References'),
    labels_or_categories: item.labelIds || [],
    plain_text_body: plainText,
    html_body: htmlBody,
    attachment_metadata: (item.attachments || []).map((attachment) => ({
      filename: attachment.filename,
      mime_type: attachment.mimeType,
      size: attachment.size,
      attachment_id: attachment.attachmentId,
    })),
    raw_metadata: {
      history_id: item.historyId,
      size_estimate: item.sizeEstimate,
    },
    source_trigger: 'GMAIL_POLLING',
    ingested_at: new Date().toISOString(),
  },
}];`;

const { file: gmailFile, workflow: gmailWorkflow } = loadWorkflow('n8n_10A_gmail_mail_source_workflow.json');
nodeByName(gmailWorkflow, 'Transform to Common Mail Schema').parameters.jsCode = gmailTransform;
saveWorkflow(gmailFile, gmailWorkflow);

const { file: commonFile, workflow: commonWorkflow } = loadWorkflow('n8n_10C_common_mail_ingestion_workflow.json');

const normalizeNode = nodeByName(commonWorkflow, 'Validate & Normalize Message Schema');
normalizeNode.parameters.jsCode = normalizeNode.parameters.jsCode
  .replace('const item = $input.first().json;', 'const input = $input.first().json;\nconst item = input.body && typeof input.body === \'object\' ? input.body : input;')
  .replace("const crypto = require('crypto');\nconst contentHash = crypto.createHash('sha256').update(subject + '::' + cleanText).digest('hex');", "const hashInput = subject + '::' + cleanText;\nlet hashA = 2166136261;\nlet hashB = 2246822519;\nfor (let index = 0; index < hashInput.length; index += 1) {\n  const code = hashInput.charCodeAt(index);\n  hashA = Math.imul(hashA ^ code, 16777619);\n  hashB = Math.imul(hashB ^ code, 3266489917);\n}\nconst hashSeed = (hashA >>> 0).toString(16).padStart(8, '0') + (hashB >>> 0).toString(16).padStart(8, '0');\nconst contentHash = hashSeed.repeat(4);")
  .replace("'eldor', 'bms', 'ecu', 'test', 'hata'", "'eldor', 'bms', 'ecu', 'hata'")
  .replace('    to_addresses: item.to_addresses || [],\n    subject: subject,', '    to_addresses: item.to_addresses || [],\n    cc_addresses: item.cc_addresses || [],\n    labels_or_categories: item.labels_or_categories || [],\n    subject: subject,')
  .replace('    requires_manual_review: decision === \'MANUAL_REVIEW\'\n', '    requires_manual_review: decision === \'MANUAL_REVIEW\',\n    suspected_prompt_injection: isInjection\n');

const checkNode = nodeByName(commonWorkflow, 'Check Existing Event in Postgres');
checkNode.parameters.query = `SELECT existing.id, existing.provider, existing.decision
FROM (VALUES (1)) AS seed(value)
LEFT JOIN LATERAL (
  SELECT id, provider, decision
  FROM mail.ingestion_event
  WHERE (provider = $1 AND mailbox_address = $2 AND provider_message_id = $3)
     OR content_hash = $4
  LIMIT 1
) AS existing ON true;`;

const documentNode = nodeByName(commonWorkflow, 'Upsert RAG Document');
documentNode.parameters.query = `INSERT INTO rag.document (
  source_type, source_provider, external_id, title, project_code,
  sender_address, received_at, content_hash, sensitivity, is_active, metadata
) VALUES (
  'EMAIL', $1, $2, $3, $4, $5, $6::timestamptz, $7, 'INTERNAL', true, $8::jsonb
)
ON CONFLICT (source_type, external_id) DO UPDATE SET
  source_provider = EXCLUDED.source_provider,
  title = EXCLUDED.title,
  project_code = EXCLUDED.project_code,
  sender_address = EXCLUDED.sender_address,
  received_at = EXCLUDED.received_at,
  content_hash = EXCLUDED.content_hash,
  is_active = true,
  metadata = EXCLUDED.metadata
RETURNING id;`;
documentNode.parameters.options.queryReplacement = `={{ [
  $json.provider,
  $json.provider_message_id,
  $json.subject,
  $json.project_code,
  $json.from_address,
  $json.received_at,
  $json.content_hash,
  JSON.stringify({
    mailbox_address: $json.mailbox_address,
    project_name: $json.project_name,
    internet_message_id: $json.internet_message_id,
    to_addresses: $json.to_addresses,
    cc_addresses: $json.cc_addresses,
    classification: $json.classification
  })
] }}`;

const chunkNode = nodeByName(commonWorkflow, 'Upsert RAG Chunk');
chunkNode.parameters.query = `INSERT INTO rag.chunk (
  document_id, chunk_index, content, token_count,
  embedding_model, embedding_dimension, embedding, metadata
) VALUES (
  $1::uuid, 0, $2, $3::integer,
  'qwen3-embedding:0.6b', 1024, $4::vector, $5::jsonb
)
ON CONFLICT (document_id, chunk_index) DO UPDATE SET
  content = EXCLUDED.content,
  token_count = EXCLUDED.token_count,
  embedding_model = EXCLUDED.embedding_model,
  embedding_dimension = EXCLUDED.embedding_dimension,
  embedding = EXCLUDED.embedding,
  metadata = EXCLUDED.metadata
RETURNING id;`;
chunkNode.parameters.options.queryReplacement = `={{ [
  $('Upsert RAG Document').first().json.id,
  'E-POSTA KONUSU: ' + $('Apply Deduplication Decision').first().json.subject + '\\n' +
    'GÖNDEREN: ' + $('Apply Deduplication Decision').first().json.from_address + '\\n' +
    'TARİH: ' + $('Apply Deduplication Decision').first().json.received_at + '\\n' +
    'PROJE: ' + $('Apply Deduplication Decision').first().json.project_code + '\\n\\nİÇERİK:\\n' +
    $('Apply Deduplication Decision').first().json.clean_text,
  Math.max(1, Math.round($('Apply Deduplication Decision').first().json.clean_text.length / 4)),
  '[' + $json.embedding.join(',') + ']',
  JSON.stringify({
    project_code: $('Apply Deduplication Decision').first().json.project_code,
    subject: $('Apply Deduplication Decision').first().json.subject,
    provider: $('Apply Deduplication Decision').first().json.provider,
    received_at: $('Apply Deduplication Decision').first().json.received_at,
    from_address: $('Apply Deduplication Decision').first().json.from_address
  })
] }}`;

const auditNode = nodeByName(commonWorkflow, 'Audit Ingestion Event');
auditNode.parameters.query = `INSERT INTO mail.ingestion_event (
  provider, mailbox_address, provider_message_id, provider_thread_id,
  internet_message_id, from_address, to_addresses, cc_addresses, subject,
  received_at, delivery_mode, labels_or_categories, is_business_related,
  classification, classification_confidence, decision, reason, project_code,
  content_hash, suspected_prompt_injection, requires_manual_review, metadata
) VALUES (
  $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9,
  $10::timestamptz, $11, $12::jsonb, $13::boolean,
  $14, $15::numeric, $16, $17, $18,
  $19, $20::boolean, $21::boolean, $22::jsonb
)
ON CONFLICT (provider, mailbox_address, provider_message_id) DO UPDATE SET
  provider_thread_id = EXCLUDED.provider_thread_id,
  internet_message_id = EXCLUDED.internet_message_id,
  from_address = EXCLUDED.from_address,
  to_addresses = EXCLUDED.to_addresses,
  cc_addresses = EXCLUDED.cc_addresses,
  subject = EXCLUDED.subject,
  received_at = EXCLUDED.received_at,
  decision = EXCLUDED.decision,
  reason = EXCLUDED.reason,
  project_code = EXCLUDED.project_code,
  metadata = EXCLUDED.metadata,
  processed_at = now()
RETURNING id;`;
auditNode.parameters.options.queryReplacement = `={{ [
  $('Apply Deduplication Decision').first().json.provider,
  $('Apply Deduplication Decision').first().json.mailbox_address,
  $('Apply Deduplication Decision').first().json.provider_message_id,
  $('Apply Deduplication Decision').first().json.provider_thread_id,
  $('Apply Deduplication Decision').first().json.internet_message_id,
  $('Apply Deduplication Decision').first().json.from_address,
  JSON.stringify($('Apply Deduplication Decision').first().json.to_addresses || []),
  JSON.stringify($('Apply Deduplication Decision').first().json.cc_addresses || []),
  $('Apply Deduplication Decision').first().json.subject,
  $('Apply Deduplication Decision').first().json.received_at,
  (($('Apply Deduplication Decision').first().json.cc_addresses || []).length ? 'CC' : 'DIRECT_TO'),
  JSON.stringify($('Apply Deduplication Decision').first().json.labels_or_categories || []),
  $('Apply Deduplication Decision').first().json.is_business_related,
  $('Apply Deduplication Decision').first().json.classification,
  $('Apply Deduplication Decision').first().json.classification_confidence,
  $('Apply Deduplication Decision').first().json.decision,
  $('Apply Deduplication Decision').first().json.reason,
  $('Apply Deduplication Decision').first().json.project_code,
  $('Apply Deduplication Decision').first().json.content_hash,
  $('Apply Deduplication Decision').first().json.suspected_prompt_injection || false,
  $('Apply Deduplication Decision').first().json.requires_manual_review,
  JSON.stringify({
    project_name: $('Apply Deduplication Decision').first().json.project_name,
    clean_text: $('Apply Deduplication Decision').first().json.clean_text,
    internet_message_id: $('Apply Deduplication Decision').first().json.internet_message_id,
    labels_or_categories: $('Apply Deduplication Decision').first().json.labels_or_categories || []
  })
] }}`;

commonWorkflow.connections['Switch Decision'].main[1] = [{
  node: 'Format Ingestion Result',
  type: 'main',
  index: 0,
}];

saveWorkflow(commonFile, commonWorkflow);

console.log('Updated Gmail source and common mail ingestion workflows.');
