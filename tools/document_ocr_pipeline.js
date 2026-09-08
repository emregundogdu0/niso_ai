/**
 * NISO AI — Document Ingestion & Hybrid OCR Pipeline
 * 1. Hybrid Text Extraction: pdf-parse for digital PDFs, Tesseract.js for scanned images
 * 2. LLM Structuring: Qwen3.5:9b for typo correction, markdown formatting & metadata extraction
 * 3. Vector Embedding: Qwen3-embedding:0.6b (1024 dims)
 * 4. DB Storage: PostgreSQL pgvector (rag.document & rag.chunk)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const Tesseract = require('tesseract.js');
const { PDFParse } = require('pdf-parse');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const LLM_MODEL = 'qwen3.5:9b';

// Helper: Run admin psql queries in Docker
function runAdminPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

function runAdminPsqlJson(sqlQuery) {
  const cleanQuery = sqlQuery.trim().replace(/;+$/, '');
  const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${cleanQuery}) t;`;
  const result = execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(jsonWrapped, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'null') return [];
  return JSON.parse(trimmed);
}

// Helper: Generate embedding vector
async function getEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      prompt: text.substring(0, 3000)
    })
  });
  if (!response.ok) {
    throw new Error(`Embedding error: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

/**
 * Step 1: Extract Raw Text from file buffer
 */
async function extractRawText(fileBuffer, fileName, onProgress) {
  const ext = path.extname(fileName || '').toLowerCase();
  let rawText = '';
  let extractionMethod = 'UNKNOWN';
  let pageCount = 1;

  if (ext === '.pdf') {
    if (onProgress) onProgress('EXTRACTING', 15, 'PDF metin katmanı okunuyor...');
    let parser = null;
    try {
      parser = new PDFParse({ data: fileBuffer });
      const pdfData = await parser.getText();
      const info = await parser.getInfo();
      pageCount = info?.total || 1;
      await parser.destroy();
      parser = null;
      rawText = (pdfData.text || '').trim();

      if (rawText.length >= 20) {
        extractionMethod = 'PDF_DIGITAL';
        return { rawText, extractionMethod, pageCount };
      }
    } catch (err) {
      if (parser) {
        try { await parser.destroy(); } catch (e) {}
      }
      console.warn('pdf-parse warning:', err.message);
    }
  }

  // Image or Scanned Document -> Tesseract OCR (only for image files)
  if (['.png', '.jpg', '.jpeg', '.bmp', '.webp', '.tiff'].includes(ext)) {
    if (onProgress) onProgress('OCR_RUNNING', 30, 'Tesseract OCR motoru çalışıyor...');
    let worker = null;
    try {
      worker = await Tesseract.createWorker(['tur', 'eng']);
      const ocrResult = await worker.recognize(fileBuffer);
      rawText = (ocrResult.data?.text || '').trim();
      extractionMethod = 'TESSERACT_OCR';
      await worker.terminate();
    } catch (ocrErr) {
      if (worker) {
        try { await worker.terminate(); } catch (e) {}
      }
      console.warn('Tesseract OCR error with tur+eng, falling back to eng:', ocrErr.message);
      try {
        const fallbackRes = await Tesseract.recognize(fileBuffer, 'eng');
        rawText = (fallbackRes.data?.text || '').trim();
        extractionMethod = 'TESSERACT_OCR_FALLBACK';
      } catch (err2) {
        throw new Error('Metin çıkarma / OCR başarısız oldu: ' + err2.message);
      }
    }
  } else if (!rawText) {
    throw new Error('Dokümandan metin okunamadı veya dosya formatı desteklenmiyor.');
  }

  return { rawText, extractionMethod, pageCount };
}

/**
 * Step 2: LLM Structuring, Typo Correction & Metadata Extraction
 */
async function structureWithLlm(rawText, originalName, defaultCategory = 'GENERAL', onProgress) {
  if (onProgress) onProgress('LLM_PROCESSING', 55, 'Yapay zekâ dokümanı analiz ediyor ve düzenliyor...');

  const prompt = `Sen kurumsal yönetim asistanı NISO AI için uzman bir doküman analisti ve editörüsün.
Aşağıda "${originalName}" adlı yüklenmiş dosyadan OCR / metin çıkarıcı ile alınmış ham metin yer almaktadır.

Görevlerin:
1. İmla, harf veya OCR okuma hatalarını düzelt; başlık, liste ve tabloları nizami Markdown haline getir.
2. Dokümanı analiz ederek aşağıdaki JSON yapısını eksiksiz üret:
   - "title": Dokümana uygun, net ve profesyonel bir başlık.
   - "summary": Dokümanın içeriğini açıklayan 2-3 cümlelik yönetici özeti.
   - "date": Dokümanda geçen ana tarih (YYYY-MM-DD) veya bulunamazsa null.
   - "keywords": İlgili 3-6 adet anahtar kelime dizisi.
   - "category": PROJECT_DOC, HR_POLICY, SPECIFICATION veya GENERAL.
   - "project_code": İlgili proje kodu (PRJ-TEMSA, PRJ-VORTEX, PRJ-ELDOR-OBC, PRJ-SMART-FACTORY veya null).
   - "cleaned_markdown": Düzenlenmiş ve temizlenmiş tam Markdown metni.

Ham Metin:
${rawText.substring(0, 8000)}

YALNIZCA geçerli JSON formatında yanıt ver:`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LLM_MODEL,
        format: 'json',
        messages: [
          { role: 'user', content: prompt }
        ],
        stream: false,
        options: { temperature: 0.1 }
      }),
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const content = data.message?.content || '{}';
      const parsed = JSON.parse(content);
      return {
        title: parsed.title || originalName,
        summary: parsed.summary || rawText.substring(0, 150) + '...',
        date: parsed.date || null,
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
        category: parsed.category || defaultCategory,
        project_code: parsed.project_code || null,
        cleaned_markdown: parsed.cleaned_markdown || rawText
      };
    }
  } catch (err) {
    console.warn('LLM structuring warning, using raw fallback:', err.message);
  }

  // Fallback if LLM unavailable
  return {
    title: originalName.replace(/\.[^/.]+$/, ''),
    summary: rawText.substring(0, 180) + '...',
    date: null,
    keywords: ['doküman', 'yükleme'],
    category: defaultCategory,
    project_code: null,
    cleaned_markdown: rawText
  };
}

/**
 * Step 3: Chunking Text
 */
function chunkText(text, maxChars = 800, overlap = 150) {
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    const cleanPara = para.trim();
    if (!cleanPara) continue;

    if ((currentChunk.length + cleanPara.length) <= maxChars) {
      currentChunk += (currentChunk ? '\n\n' : '') + cleanPara;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      if (cleanPara.length > maxChars) {
        // Split long paragraph
        let start = 0;
        while (start < cleanPara.length) {
          chunks.push(cleanPara.substring(start, start + maxChars));
          start += (maxChars - overlap);
        }
        currentChunk = '';
      } else {
        currentChunk = cleanPara;
      }
    }
  }
  if (currentChunk) chunks.push(currentChunk);
  return chunks.length > 0 ? chunks : [text.substring(0, maxChars)];
}

/**
 * Step 4: Full Ingestion Pipeline
 */
async function processAndIngestDocument({ fileBuffer, fileName, category = 'GENERAL', projectCode = null, onProgress }) {
  const startTime = Date.now();
  if (onProgress) onProgress('START', 5, 'Dosya alındı, işleme başlıyor...');

  // 1. Text Extraction
  const { rawText, extractionMethod, pageCount } = await extractRawText(fileBuffer, fileName, onProgress);
  if (!rawText || rawText.length < 10) {
    throw new Error('Dosyadan okunabilir metin çıkarılamadı. Belgenin net bir görsel veya metin içerdiğinden emin olun.');
  }

  // 2. LLM Structuring
  const structured = await structureWithLlm(rawText, fileName, category, onProgress);
  const finalProjectCode = projectCode || structured.project_code || (category === 'HR_POLICY' ? 'HR-POLICY' : 'GENERAL-DOC');

  // 3. Chunking
  if (onProgress) onProgress('EMBEDDING', 75, 'Metin vektörleştiriliyor ve veritabanına indeksleniyor...');
  const chunks = chunkText(structured.cleaned_markdown);

  // 4. Save Document to rag.document
  const documentId = crypto.randomUUID();
  const externalId = 'upload_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
  const contentHash = crypto.createHash('sha256').update(structured.cleaned_markdown).digest('hex');

  const docMetadata = {
    original_filename: fileName,
    page_count: pageCount,
    extraction_method: extractionMethod,
    summary: structured.summary,
    keywords: structured.keywords,
    category: structured.category || category,
    detected_date: structured.date,
    chunk_count: chunks.length,
    file_size_bytes: fileBuffer.length
  };

  const insertDocSql = `
    INSERT INTO rag.document (
      id, source_type, external_id, title, project_code, content_hash,
      source_uri, sensitivity, is_active, metadata, created_at
    ) VALUES (
      '${documentId}',
      'FILE_UPLOAD',
      '${externalId}',
      '${(structured.title || fileName).replace(/'/g, "''")}',
      '${finalProjectCode.replace(/'/g, "''")}',
      '${contentHash}',
      'local://uploads/${fileName.replace(/'/g, "''")}',
      'internal_doc',
      true,
      '${JSON.stringify(docMetadata).replace(/'/g, "''")}'::jsonb,
      now()
    );
  `;
  runAdminPsql(insertDocSql);

  // 5. Embed & Insert Chunks into rag.chunk
  for (let i = 0; i < chunks.length; i++) {
    const chunkContent = `[Belge: ${structured.title}]\n\n${chunks[i]}`;
    const embedding = await getEmbedding(chunkContent);
    const vectorStr = `[${embedding.join(',')}]`;

    const chunkMeta = {
      chunk_index: i,
      total_chunks: chunks.length,
      original_filename: fileName,
      category: structured.category || category
    };

    const insertChunkSql = `
      INSERT INTO rag.chunk (
        document_id, chunk_index, content, token_count,
        embedding_model, embedding_dimension, embedding, metadata, created_at
      ) VALUES (
        '${documentId}',
        ${i},
        '${chunkContent.replace(/'/g, "''")}',
        ${Math.round(chunkContent.length / 4)},
        '${EMBEDDING_MODEL}',
        1024,
        '${vectorStr}'::vector,
        '${JSON.stringify(chunkMeta).replace(/'/g, "''")}'::jsonb,
        now()
      );
    `;
    runAdminPsql(insertChunkSql);
  }

  if (onProgress) onProgress('COMPLETED', 100, 'Doküman başarıyla işlendi ve veritabanına eklendi.');

  return {
    document_id: documentId,
    external_id: externalId,
    title: structured.title,
    summary: structured.summary,
    category: structured.category || category,
    project_code: finalProjectCode,
    extraction_method: extractionMethod,
    page_count: pageCount,
    chunk_count: chunks.length,
    detected_date: structured.date,
    keywords: structured.keywords,
    latency_ms: Date.now() - startTime
  };
}

/**
 * List all uploaded documents
 */
function listUploadedDocuments() {
  const sql = `
    SELECT 
      d.id,
      d.external_id,
      d.title,
      d.project_code,
      d.created_at,
      d.metadata->>'original_filename' as original_filename,
      COALESCE((d.metadata->>'page_count')::int, 1) as page_count,
      COALESCE((d.metadata->>'chunk_count')::int, 0) as chunk_count,
      COALESCE(d.metadata->>'category', 'GENERAL') as category,
      COALESCE(d.metadata->>'extraction_method', 'PDF_DIGITAL') as extraction_method,
      COALESCE(d.metadata->>'summary', '') as summary,
      COALESCE(d.metadata->>'detected_date', null) as detected_date,
      (d.metadata->'keywords') as keywords
    FROM rag.document d
    WHERE d.source_type = 'FILE_UPLOAD' AND d.is_active = true
    ORDER BY d.created_at DESC;
  `;
  return runAdminPsqlJson(sql);
}

/**
 * Delete an uploaded document
 */
function deleteUploadedDocument(documentId) {
  const cleanId = String(documentId).replace(/[^a-zA-Z0-9-]/g, '');
  const sql = `
    DELETE FROM rag.document 
    WHERE id = '${cleanId}' AND source_type = 'FILE_UPLOAD';
  `;
  runAdminPsql(sql);
  return { deleted: true, document_id: cleanId };
}

/**
 * Vector similarity search across uploaded documents
 */
async function searchUploadedDocuments(query, topK = 4) {
  const queryEmbedding = await getEmbedding(query);
  const vectorStr = `[${queryEmbedding.join(',')}]`;

  // Extract query keywords for hybrid matching
  const stopWords = new Set([
    've', 'veya', 'ile', 'için', 'hakkında', 'olan', 'gibi', 'bilgi', 'ver', 'nedir', 'nelerdir',
    'bana', 'bir', 'bu', 'şu', 'the', 'and', 'for', 'about', 'son', 'durum', 'durumu', 'kaç',
    'gün', 'kimler', 'ne', 'nasıl', 'var', 'mı', 'mi', 'mu', 'mü', 'nerede', 'kim', 'bunun'
  ]);
  const tokens = (query || '')
    .toLowerCase()
    .replace(/[^a-z0-9ğüşıöç]/gi, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2 && !stopWords.has(t));

  let keywordClause = '0.0';
  if (tokens.length > 0) {
    const patterns = tokens.map(t => `'%' || '${t.replace(/'/g, "''")}' || '%'`).join(', ');
    keywordClause = `(
      CASE 
        WHEN lower(d.title) LIKE ANY(ARRAY[${patterns}]) THEN 0.35
        WHEN lower(d.metadata->>'original_filename') LIKE ANY(ARRAY[${patterns}]) THEN 0.30
        WHEN lower(c.content) LIKE ANY(ARRAY[${patterns}]) THEN 0.20
        ELSE 0.0
      END
    )`;
  }

  const sql = `
    SELECT 
      c.id,
      c.document_id,
      c.chunk_index,
      c.content,
      d.title as document_title,
      d.project_code,
      d.metadata->>'original_filename' as original_filename,
      d.metadata->>'category' as category,
      ROUND((1 - (c.embedding <=> '${vectorStr}'::vector))::numeric, 4) as vector_similarity,
      ROUND((${keywordClause})::numeric, 4) as keyword_boost,
      ROUND(((1 - (c.embedding <=> '${vectorStr}'::vector)) + ${keywordClause})::numeric, 4) as similarity
    FROM rag.chunk c
    JOIN rag.document d ON d.id = c.document_id
    WHERE d.source_type = 'FILE_UPLOAD' AND d.is_active = true
    ORDER BY similarity DESC
    LIMIT ${topK};
  `;

  return runAdminPsqlJson(sql);
}

module.exports = {
  extractRawText,
  structureWithLlm,
  chunkText,
  processAndIngestDocument,
  listUploadedDocuments,
  deleteUploadedDocument,
  searchUploadedDocuments
};
