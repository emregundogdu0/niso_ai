const { answerHrPolicyQuestion } = require('./hr_hybrid_cag_rag_engine');

(async () => {
  console.log('--- TEST 1: HR-001 ---');
  const r1 = await answerHrPolicyQuestion('Günlük standart çalışma saatleri nedir?');
  console.log(r1.answer);

  console.log('\n--- TEST 2: UNANS-1 ---');
  const r2 = await answerHrPolicyQuestion('Uzay üssünde yıllık izin hakkı kaç gün olarak tanımlanmıştır?');
  console.log(r2.answer);
})();
