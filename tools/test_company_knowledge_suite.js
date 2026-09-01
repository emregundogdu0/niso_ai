const { answerCompanyKnowledgeQuestion } = require('./company_knowledge_rag_engine');

const TEST_QUESTIONS = [
  {
    id: 'KNOW-01',
    question: 'Vortex AI Engine hangi donanım ve teknolojileri kullanıyor?',
    expectedKeywords: ['Jetson Orin NX', 'SLAM', 'ROS 2', 'TensorRT', 'LiDAR']
  },
  {
    id: 'KNOW-02',
    question: 'Eldor Group kurucusu kimdir ve kaç çalışanı vardır?',
    expectedKeywords: ['Pasquale Forte', '3.000', '1972']
  },
  {
    id: 'KNOW-03',
    question: 'Eldor Group genel merkezi nerededir?',
    expectedKeywords: ['Orsenigo', 'Como', 'İtalya']
  },
  {
    id: 'KNOW-04',
    question: 'Eldor hangi ülkelerde üretim tesislerine sahiptir?',
    expectedKeywords: ['İtalya', 'Çin', 'Türkiye', 'Brezilya', 'ABD']
  },
  {
    id: 'KNOW-05',
    question: 'Eldor Group başlıca hangi ürün ve teknolojileri üretiyor?',
    expectedKeywords: ['ateşleme bobin', 'e-motor', 'e-mobilite', 'CO2']
  },
  {
    id: 'KNOW-06',
    question: 'NISO Bilgi Güvenliği Politikasını kim imzalamıştır?',
    expectedKeywords: ['Gökhan BİNGÖL', 'Bilgi Güvenliği']
  },
  {
    id: 'KNOW-07',
    question: 'NISO Kalite Politikası hangi ISO standardını esas alır?',
    expectedKeywords: ['ISO 9001', 'Kalite']
  },
  {
    id: 'KNOW-08',
    question: 'NISO otomotiv yazılımı alanında hangi standart ve teknolojileri destekler?',
    expectedKeywords: ['AUTOSAR', 'ISO 26262', 'ADAS', 'Android Automotive']
  },
  {
    id: 'KNOW-09',
    question: 'NISO ekibinin yaş ortalaması ve lokasyon dağılımı nasıldır?',
    expectedKeywords: ['29.6', 'İzmir', 'Ankara', 'İstanbul']
  },
  {
    id: 'KNOW-10',
    question: 'NISO gizlilik ve NDA konusunda müşterilerine nasıl bir güvence veriyor?',
    expectedKeywords: ['NDA', 'Gizlilik']
  },
  {
    id: 'KNOW-11',
    question: 'NISO için pasif güvenlik gözlemleri nelerdir?',
    expectedKeywords: ['PHP/7.4.33', 'pasif gözlem']
  },
  {
    id: 'KNOW-12',
    question: "Eldor Group'un İtalya'daki Ar-Ge merkezleri hangi şehirlerdedir?",
    expectedKeywords: ['Orsenigo', 'Lomazzo', 'Milano', 'Torino']
  },
  {
    id: 'KNOW-13',
    question: 'NISO robot kestirimci bakım veya üretim izleme çözümü sunuyor mu?',
    expectedKeywords: ['kestirimci bakım', 'üretim izleme']
  },
  {
    id: 'KNOW-14',
    question: 'NISO yenilenebilir enerji alanında hangi çözümleri sunar?',
    expectedKeywords: ['rüzgâr', 'güneş']
  },
  {
    id: 'KNOW-15',
    question: 'Vortex AI GPS olmayan ortamlarda yön bulmayı nasıl sağlar?',
    expectedKeywords: ['SLAM', 'GPS-denied']
  }
];

async function runTestSuite() {
  console.log('================================================================');
  console.log('    NISO & ELDOR COMPANY KNOWLEDGE BASE EVALUATION SUITE        ');
  console.log('================================================================\n');

  let passedCount = 0;
  let totalLatency = 0;

  for (let i = 0; i < TEST_QUESTIONS.length; i++) {
    const t = TEST_QUESTIONS[i];
    process.stdout.write(`[${i + 1}/${TEST_QUESTIONS.length}] Testing [${t.id}] "${t.question}"... `);

    const res = await answerCompanyKnowledgeQuestion(t.question);
    totalLatency += res.latency_ms;

    // Check if expected keywords are present in the answer
    const lowerAns = res.answer.toLowerCase();
    const matchedKws = t.expectedKeywords.filter(k => lowerAns.includes(k.toLowerCase()));
    const isSuccess = matchedKws.length >= Math.ceil(t.expectedKeywords.length * 0.5) && res.sources.length > 0;

    if (isSuccess) {
      passedCount++;
      const topSrc = res.sources[0]?.tag || 'Bilinmiyor';
      console.log(`✅ SUCCESS (Latency: ${res.latency_ms}ms, Source: ${topSrc})`);
    } else {
      console.log(`❌ FAILED (Matched: ${matchedKws.join(', ')} / Expected: ${t.expectedKeywords.join(', ')})`);
      console.log('Answer:', res.answer);
    }
  }

  const accuracyRate = (passedCount / TEST_QUESTIONS.length) * 100;
  const avgLatency = Math.round(totalLatency / TEST_QUESTIONS.length);

  console.log('\n================================================================');
  console.log('               EVALUATION METRICS & SUMMARY                     ');
  console.log('================================================================');
  console.log(`1. Total Evaluated Questions: ${TEST_QUESTIONS.length}`);
  console.log(`2. Accuracy Rate            : ${passedCount} / ${TEST_QUESTIONS.length} (${accuracyRate.toFixed(1)}%) (Target: >= 90%) -> ${accuracyRate >= 90 ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log(`3. Average Latency          : ${avgLatency} ms`);
  console.log('================================================================\n');

  if (accuracyRate < 90) {
    process.exit(1);
  }
}

runTestSuite().catch(console.error);
