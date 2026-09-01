const { execSync } = require('child_process');

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const EMBEDDING_MODEL = 'qwen3-embedding:0.6b';
const EXPECTED_DIMENSION = 1024;

async function getEmbedding(text) {
  const response = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: EMBEDDING_MODEL,
      input: text
    })
  });
  if (!response.ok) throw new Error(`Ollama embed failed: ${response.statusText}`);
  const data = await response.json();
  return data.embeddings[0];
}

function runPsqlJson(sqlQuery) {
  const jsonWrapped = `\\t\n\\a\nSELECT json_agg(t) FROM (${sqlQuery}) t;`;
  const result = execSync('docker exec -i management-postgres psql -U management_admin -d management_ai -q -X', {
    input: Buffer.from(jsonWrapped, 'utf8'),
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });
  const trimmed = result.trim();
  if (!trimmed || trimmed === 'null') return [];
  return JSON.parse(trimmed);
}

async function runSemanticQuery(query, topK = 5) {
  const embedding = await getEmbedding(query);
  const vectorLiteral = `[${embedding.join(',')}]`;

  const sql = `
    SELECT 
      c.id AS chunk_id,
      d.external_id AS policy_code,
      d.title,
      c.metadata->>'category' AS category,
      c.metadata->>'version' AS version,
      ROUND((1 - (c.embedding <=> '${vectorLiteral}'::vector))::numeric, 4) AS cosine_similarity,
      ROUND((c.embedding <=> '${vectorLiteral}'::vector)::numeric, 4) AS cosine_distance,
      SUBSTRING(c.content, 1, 140) AS snippet
    FROM rag.chunk c
    JOIN rag.document d ON c.document_id = d.id
    WHERE d.is_active = true
    ORDER BY c.embedding <=> '${vectorLiteral}'::vector ASC
    LIMIT ${topK}
  `;

  return runPsqlJson(sql);
}

async function runAllTests() {
  console.log('====================================================');
  console.log('       RAG & SEMANTIC SEARCH VERIFICATION SUITE      ');
  console.log('====================================================\n');

  // Test 1: Count Verification
  console.log('--- TEST 1: Document & Chunk Count Check ---');
  const countDocs = runPsqlJson(`SELECT COUNT(*)::int AS count FROM rag.document WHERE source_type = 'hr_policy' AND is_active = true`);
  const countChunks = runPsqlJson(`SELECT COUNT(*)::int AS count FROM rag.chunk WHERE embedding_model = '${EMBEDDING_MODEL}'`);
  const docCount = countDocs[0]?.count || 0;
  const chunkCount = countChunks[0]?.count || 0;
  console.log(`Active Documents in rag.document: ${docCount}`);
  console.log(`Active Chunks in rag.chunk: ${chunkCount}`);
  const test1Pass = (docCount === 100 && chunkCount === 100);
  console.log(`Test 1 Result: ${test1Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

  // Test 2: "Şirkette bonus var mı?" -> expect bonus/prim in top 5
  console.log('--- TEST 2: "Şirkette bonus var mı?" ---');
  const results2 = await runSemanticQuery('Şirkette bonus var mı?', 5);
  console.table(results2.map(r => ({
    Rank: '',
    Code: r.policy_code,
    Similarity: r.cosine_similarity,
    Distance: r.cosine_distance,
    Title: r.title
  })));
  const test2Pass = results2.some(r => r.policy_code === 'HR-051' || r.title.toLowerCase().includes('prim') || r.category.toLowerCase().includes('prim'));
  console.log(`Test 2 Result (Prim/Bonus in Top 5): ${test2Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

  // Test 3: "Ofiste nasıl giyinmeliyim?" -> expect dress code in top 5
  console.log('--- TEST 3: "Ofiste nasıl giyinmeliyim?" ---');
  const results3 = await runSemanticQuery('Ofiste nasıl giyinmeliyim?', 5);
  console.table(results3.map(r => ({
    Rank: '',
    Code: r.policy_code,
    Similarity: r.cosine_similarity,
    Distance: r.cosine_distance,
    Title: r.title
  })));
  const test3Pass = results3.some(r => r.policy_code === 'HR-064' || r.category.toLowerCase().includes('dress') || r.title.toLowerCase().includes('kıyafet'));
  console.log(`Test 3 Result (Dress Code in Top 5): ${test3Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

  // Test 4: "Babalık izni kaç gün?" -> expect paternity/parental leave in top 5
  console.log('--- TEST 4: "Babalık izni kaç gün?" ---');
  const results4 = await runSemanticQuery('Babalık izni kaç gün?', 5);
  console.table(results4.map(r => ({
    Rank: '',
    Code: r.policy_code,
    Similarity: r.cosine_similarity,
    Distance: r.cosine_distance,
    Title: r.title
  })));
  const test4Pass = results4.some(r => r.policy_code === 'HR-030' || r.title.toLowerCase().includes('babalık'));
  console.log(`Test 4 Result (Babalık İzni in Top 5): ${test4Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

  // Test 5: Irrelevant query -> low similarity check
  console.log('--- TEST 5: Irrelevant Query: "Kuantum fiziğinde Schrödinger dalga denklemi nedir?" ---');
  const results5 = await runSemanticQuery('Kuantum fiziğinde Schrödinger dalga denklemi nedir?', 5);
  console.table(results5.map(r => ({
    Rank: '',
    Code: r.policy_code,
    Similarity: r.cosine_similarity,
    Distance: r.cosine_distance,
    Title: r.title
  })));
  const topSimilarity5 = results5[0]?.cosine_similarity || 0;
  const test5Pass = topSimilarity5 < 0.60;
  console.log(`Top similarity for irrelevant query: ${topSimilarity5}`);
  console.log(`Test 5 Result (Low Similarity for Irrelevant Query < 0.60): ${test5Pass ? 'PASSED ✅' : 'FAILED ❌'}\n`);

  console.log('====================================================');
  console.log('                  TEST SUMMARY                      ');
  console.log(`Test 1 (Doc/Chunk Count 100/100): ${test1Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 2 (Bonus/Prim Query):       ${test2Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 3 (Dress Code Query):        ${test3Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 4 (Babalık İzni Query):      ${test4Pass ? 'PASSED' : 'FAILED'}`);
  console.log(`Test 5 (Irrelevant Query Low):    ${test5Pass ? 'PASSED' : 'FAILED'}`);
  console.log('====================================================');

  return {
    test1Pass,
    test2Pass,
    test3Pass,
    test4Pass,
    test5Pass,
    allPassed: test1Pass && test2Pass && test3Pass && test4Pass && test5Pass
  };
}

if (require.main === module) {
  runAllTests().catch(err => {
    console.error('Error running test suite:', err);
    process.exit(1);
  });
}

module.exports = {
  runAllTests,
  runSemanticQuery
};
