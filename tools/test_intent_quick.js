const systemPrompt = `Sen bir Yönetim ve İK Asistanı niyet sınıflandırıcısısın (Intent Router).
Görevin, kullanıcının sorusunu aşağıdaki 5 niyetten (intent) birine sınıflandırmak ve JSON döndürmektir:

INTENTLER:
1. HR_POLICY: Şirket İK politikaları, izin hakları (yıllık izin, mazeret, doğum vb.), mesai kuralları, yan haklar, bordro prosedürü, kıyafet kuralı (dress code), iş sağlığı/güvenliği kuralları, istifa ve etik kurallar.
2. ATTENDANCE_SQL: Çalışanların fiili giriş-çıkış saatleri, geç kalma, bugün kim geldi/gelmedi, devamsızlık, günlük yoklama, turnike kayıtları, mesai devam çizelgesi.
3. PROJECT_MAIL: Projelerin durumu, e-posta yazışmaları, müşteri toplantıları, teslimat takvimi, paydaş yazışmaları, proje e-postaları.
4. HYBRID: Birden fazla alanı (ör. hem turnike/devam durumu hem proje maili, veya hem İK kuralı hem proje durumu) birleştiren birleşik sorular.
5. UNKNOWN: Şirket yönetimi, İK, devam durumu veya proje konuları dışındaki alakasız konular (genel sohbet, şiir yazma, hava durumu, kod yazma, felsefe vb.).

KURAL: SADECE ve SADECE aşağıdaki JSON formatında geçerli bir JSON çıktısı üret:
{
  "intent": "HR_POLICY" | "ATTENDANCE_SQL" | "PROJECT_MAIL" | "HYBRID" | "UNKNOWN",
  "confidence": 0.95,
  "normalized_question": "...",
  "entities": {
    "date_range": "bugün" | "bu hafta" | null,
    "employee": "Ahmet Yılmaz" | null,
    "department": "Yazılım" | null,
    "project": "TEMSA" | null
  },
  "needs_fresh_data": true | false,
  "reason": "..."
}`;

async function classifyIntent(question) {
  const response = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'qwen3.5:9b',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question }
      ],
      stream: false,
      format: 'json',
      options: {
        temperature: 0.0
      }
    })
  });

  const data = await response.json();
  const raw = data.message?.content ? data.message.content.trim() : '';
  const cleanJson = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error('Failed to parse JSON:', raw);
    throw err;
  }
}

const testQuestions = [
  'Çalışma saatleri nedir?',
  'Bugün kimler geç kaldı?',
  'TEMSA projesinde son durum nedir?',
  'TEMSA ekibi bugün geç kaldı mı ve proje durumu nedir?',
  'Bana şiir yaz'
];

(async () => {
  for (const q of testQuestions) {
    const t0 = Date.now();
    const res = await classifyIntent(q);
    const ms = Date.now() - t0;
    console.log(`[${ms}ms] "${q}" -> ${res.intent} (conf: ${res.confidence})`);
    console.log(JSON.stringify(res, null, 2));
    console.log('---');
  }
})();
