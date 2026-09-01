const fs = require('fs');
const { execSync } = require('child_process');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const FILE_PATH = 'C:\\Users\\Emre Gundogdu\\Downloads\\niso_eldor_temizlenmis_tum_bilgiler.txt';

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
    throw new Error(`Embedding failed: ${response.statusText}`);
  }
  const data = await response.json();
  return data.embedding;
}

function runAdminPsql(sqlQuery) {
  return execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(sqlQuery, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
}

function parseDocument(content) {
  const chunks = [];
  const lines = content.split('\n');

  // Separate Section 1 (NISO) and Section 2 (ELDOR)
  const sec2LineIdx = lines.findIndex(l => l.includes('BÖLÜM 2 — ELDOR GROUP'));
  const nisoLines = sec2LineIdx !== -1 ? lines.slice(0, sec2LineIdx) : lines;
  const eldorLines = sec2LineIdx !== -1 ? lines.slice(sec2LineIdx) : [];

  // 1. Parse NISO Overview (lines before [01])
  const firstPageLineIdx = nisoLines.findIndex(l => /^\[01\]/.test(l.trim()));
  if (firstPageLineIdx !== -1) {
    const overviewText = nisoLines.slice(0, firstPageLineIdx).join('\n').trim();
    // Split overview into logical sub-chunks
    const overviewParts = overviewText.split(/(?=\n[A-ZÇĞİÖŞÜa-zçğıöşü\s—]+—|\nKısa profil|\nBaşlıca çözüm|\nVortex AI Engine|\nPolitikalar|\nNISO — pasif)/g);
    overviewParts.forEach((part, idx) => {
      const cleanPart = part.trim();
      if (cleanPart.length > 50) {
        chunks.push({
          source_doc: 'niso_eldor_temizlenmis_tum_bilgiler.txt',
          section: 'NISO',
          page_number: 0,
          page_title: 'NISO Genel Kurumsal ve Teknik Profil',
          url: 'https://www.niso.com.tr',
          chunk_index: idx + 1,
          chunk_content: cleanPart,
          metadata: { category: 'overview' }
        });
      }
    });
  }

  // 2. Parse NISO Pages [01] to [75]
  let currentPage = null;
  let currentTitle = '';
  let currentUrl = '';
  let currentBodyLines = [];

  for (let i = (firstPageLineIdx !== -1 ? firstPageLineIdx : 0); i < nisoLines.length; i++) {
    const line = nisoLines[i];
    const pageMatch = line.match(/^\[(\d{2})\]\s*(.*)$/);
    if (pageMatch) {
      if (currentPage !== null && currentBodyLines.length > 0) {
        const body = currentBodyLines.join('\n').trim();
        if (body.length > 20) {
          chunks.push({
            source_doc: 'niso_eldor_temizlenmis_tum_bilgiler.txt',
            section: 'NISO',
            page_number: parseInt(currentPage, 10),
            page_title: currentTitle || `NISO Sayfa ${currentPage}`,
            url: currentUrl,
            chunk_index: 1,
            chunk_content: `NISO [${currentPage}] ${currentTitle}\nURL: ${currentUrl}\n\n${body}`,
            metadata: { category: 'page_content', page_number: parseInt(currentPage, 10) }
          });
        }
      }
      currentPage = pageMatch[1];
      currentTitle = pageMatch[2].trim();
      currentUrl = '';
      currentBodyLines = [];
    } else if (line.startsWith('URL:')) {
      currentUrl = line.replace(/^URL:\s*/, '').trim();
    } else if (!line.startsWith('---') && !line.startsWith('===') && !line.startsWith('Son değişiklik:')) {
      // Clean Visual Composer tags
      const cleanLine = line
        .replace(/\[\/?vc_[^\]]*\]/gi, '')
        .replace(/\[\/?vc_column[^\]]*\]/gi, '')
        .replace(/\[\/?vc_row[^\]]*\]/gi, '')
        .trim();
      if (cleanLine.length > 0) {
        currentBodyLines.push(cleanLine);
      }
    }
  }

  // Last NISO page
  if (currentPage !== null && currentBodyLines.length > 0) {
    const body = currentBodyLines.join('\n').trim();
    if (body.length > 20) {
      chunks.push({
        source_doc: 'niso_eldor_temizlenmis_tum_bilgiler.txt',
        section: 'NISO',
        page_number: parseInt(currentPage, 10),
        page_title: currentTitle || `NISO Sayfa ${currentPage}`,
        url: currentUrl,
        chunk_index: 1,
        chunk_content: `NISO [${currentPage}] ${currentTitle}\nURL: ${currentUrl}\n\n${body}`,
        metadata: { category: 'page_content', page_number: parseInt(currentPage, 10) }
      });
    }
  }

  // 3. Parse ELDOR Sections
  if (eldorLines.length > 0) {
    const eldorText = eldorLines.join('\n').trim();
    const eldorParts = eldorText.split(/(?=\nKısa profil|\nKurumsal iletişim|\nGlobal varlık|\nÜrün ve teknoloji alanları|\nAr-Ge yetkinlikleri|\nPolitikalar ve kurumsal yönetim|\nSitede bulunan işlem yüzeyleri|\nEldor — pasif)/g);

    eldorParts.forEach((part, idx) => {
      const cleanPart = part.replace(/^===+[\s\S]*?===+/g, '').trim();
      if (cleanPart.length > 30) {
        const firstLine = cleanPart.split('\n')[0].trim();
        chunks.push({
          source_doc: 'niso_eldor_temizlenmis_tum_bilgiler.txt',
          section: 'ELDOR',
          page_number: null,
          page_title: `Eldor Group — ${firstLine}`,
          url: 'https://www.eldorgroup.com',
          chunk_index: idx + 1,
          chunk_content: `ELDOR GROUP (${firstLine})\n\n${cleanPart}`,
          metadata: { category: 'eldor_section', topic: firstLine }
        });
      }
    });
  }

  return chunks;
}

async function main() {
  console.log('Reading file:', FILE_PATH);
  const content = fs.readFileSync(FILE_PATH, 'utf8');
  const chunks = parseDocument(content);
  console.log(`Parsed ${chunks.length} semantic chunks from document.`);

  // Clean existing chunks
  runAdminPsql('TRUNCATE TABLE knowledge.company_doc_chunk;');
  console.log('Truncated knowledge.company_doc_chunk table.');

  let insertedCount = 0;
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    process.stdout.write(`[${i + 1}/${chunks.length}] Embedding "${c.page_title}"... `);

    try {
      const embedding = await getEmbedding(c.chunk_content);
      const tokenEst = Math.round(c.chunk_content.length / 4);
      const escapedDoc = c.source_doc.replace(/'/g, "''");
      const escapedSec = c.section.replace(/'/g, "''");
      const pageNumVal = c.page_number !== null ? c.page_number : 'NULL';
      const escapedTitle = c.page_title.replace(/'/g, "''");
      const escapedUrl = c.url ? `'${c.url.replace(/'/g, "''")}'` : 'NULL';
      const escapedContent = c.chunk_content.replace(/'/g, "''");
      const metaJson = JSON.stringify(c.metadata).replace(/'/g, "''");

      const insertSql = `
        INSERT INTO knowledge.company_doc_chunk (
          source_doc, section, page_number, page_title, url,
          chunk_index, chunk_content, token_estimate, embedding, metadata, created_at
        ) VALUES (
          '${escapedDoc}', '${escapedSec}', ${pageNumVal}, '${escapedTitle}', ${escapedUrl},
          ${c.chunk_index}, '${escapedContent}', ${tokenEst}, '[${embedding.join(',')}]'::vector, '${metaJson}'::jsonb, now()
        );
      `;
      runAdminPsql(insertSql);
      console.log(`✅ (Tokens: ~${tokenEst})`);
      insertedCount++;
    } catch (err) {
      console.log(`❌ Error: ${err.message}`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`Successfully indexed ${insertedCount} / ${chunks.length} chunks into PGVector!`);
  console.log(`================================================================\n`);
}

main().catch(console.error);
