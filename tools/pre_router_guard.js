/**
 * Pre-Router Guard & Fast Normalization Engine
 * Handles Deterministic routing, Small Talk, Security Denials, LATEST_MAIL intent, and Normalization
 */

function normalizeTurkish(str) {
  if (!str) return '';
  return str
    .replace(/İ/g, 'i')
    .replace(/I/g, 'i')
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/Ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/Ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/Ü/g, 'u')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_'~()?'"\+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalize common Turkish typos in chat
function normalizeTypos(normStr) {
  return normStr
    .replace(/\bmail\b/g, 'mail')
    .replace(/\bmaili\b/g, 'mail')
    .replace(/\bmaili\b/g, 'mail')
    .replace(/\bmaille\b/g, 'mail')
    .replace(/\bmailler\b/g, 'mail')
    .replace(/\bmailde\b/g, 'mail')
    .replace(/\bmailin\b/g, 'mail')
    .replace(/\bmeyl\b/g, 'mail')
    .replace(/\bmeyli\b/g, 'mail')
    .replace(/\beposta\b/g, 'mail')
    .replace(/\bepostada\b/g, 'mail')
    .replace(/\bepostayi\b/g, 'mail')
    .replace(/\be posta\b/g, 'mail')
    .replace(/\be postada\b/g, 'mail')
    .replace(/\be postayi\b/g, 'mail')
    .replace(/\bgeln\b/g, 'gelen')
    .replace(/\bokuustum\b/g, 'okudum')
    .replace(/\bokumustum\b/g, 'okudum')
    .replace(/\bdeozetle\b/g, 'ozetle')
    .replace(/\bozetlee\b/g, 'ozetle')
    .replace(/\bguncel\b/g, 'son')
    .replace(/\ben guncel\b/g, 'son')
    .replace(/\ben son\b/g, 'son');
}

function preRouteGuard(message) {
  const raw = String(message || '').trim();

  // 1. Empty or whitespace-only messages
  if (!raw) {
    return {
      is_deterministic: true,
      intent: 'UNKNOWN',
      title: 'Açıklama Gerekli',
      answer: 'Lütfen yanıtlayabileceğim bir soru veya mesaj yazınız.',
      confidence: 1.0,
      route_used: 'EMPTY_INPUT',
      retrieval_used: false,
      sources: []
    };
  }

  const norm = normalizeTurkish(raw);
  const normClean = normalizeTypos(norm);

  // 2. Security Guard / Malicious & Jailbreak heuristics
  const securityPatterns = [
    'veritabanini sil', 'tablolari sil', 'drop table', 'delete from', 'truncate table',
    'sifreleri goster', 'sifreleri listele', 'credential', 'kimlik bilgileri', 'sistem promptunu goster',
    'onceki talimatlari unut', 'ignore previous instructions', 'butun kisisel verilerini dondur',
    'calisanlarin butun kisisel verilerini', 'api key', 'gizli anahtar', 'prompt injection',
    'talimatlari calistir', 'talimatlari calistirma', 'komut calistir', 'shell komutu'
  ];
  if (securityPatterns.some(p => norm.includes(p))) {
    return {
      is_deterministic: true,
      intent: 'SECURITY_REJECTED',
      title: 'Güvenli Ret',
      answer: 'Bu isteği güvenlik ve yetkilendirme kuralları nedeniyle gerçekleştiremiyorum.',
      confidence: 1.0,
      route_used: 'SECURITY_GUARD',
      retrieval_used: false,
      sources: []
    };
  }

  // 2B. Spam / Advertisement Mail Queries (Policy Guard)
  if (normClean.includes('reklam mail') || normClean.includes('spam mail') || normClean.includes('spam klasor')) {
    return {
      is_deterministic: true,
      intent: 'PROJECT_MAIL',
      title: 'Bilgi Notu',
      answer: 'Reklam ve spam niteliğindeki e-postalar güvenlik ve filtreleme kuralları gereğince sisteme indekslenmemektedir. Yalnızca onaylanmış iş ve proje e-postaları sorgulanabilir.',
      confidence: 1.0,
      route_used: 'FILTERED_MAIL_NOTICE',
      retrieval_used: false,
      sources: []
    };
  }

  // 3. Small Talk heuristics
  const greetings = ['merhaba', 'merhabalar', 'selam', 'selamlar', 'gunaydin', 'iyi gunler', 'iyi aksamlar', 'iyi geceler', 'hey', 'hi', 'hello', 'slm', 'mrb'];
  const pleasantries = ['nasilsin', 'nasil gidiyor', 'ne haber', 'naber', 'iyi misin', 'ne yapiyorsun', 'napiyorsun', 'keyifler nasil', 'selam nasilsin', 'merhaba nasilsin'];
  const thanks = ['tesekkurler', 'tesekkur ederim', 'sag ol', 'sagol', 'eyvallah', 'tamamdir', 'tamam'];
  const farewells = ['gorusuruz', 'hosca kal', 'hoscakal', 'kendine iyi bak', 'bay bay', 'bye'];
  const allSmallTalk = [...greetings, ...pleasantries, ...thanks, ...farewells];

  if (allSmallTalk.includes(norm)) {
    let ans = 'Merhaba! Size nasıl yardımcı olabilirim? İK politikaları, devam bilgileri veya proje güncellemeleri hakkında soru sorabilirsiniz.';
    if (pleasantries.includes(norm)) {
      ans = 'İyiyim, teşekkür ederim. Size nasıl yardımcı olabilirim? İK politikaları, devam bilgileri veya proje güncellemeleri hakkında soru sorabilirsiniz.';
    } else if (thanks.includes(norm)) {
      ans = 'Rica ederim. Başka bir konuda yardımcı olabilir miyim?';
    } else if (farewells.includes(norm)) {
      ans = 'Görüşmek üzere, iyi günler dilerim.';
    }
    return {
      is_deterministic: true,
      intent: 'SMALL_TALK',
      title: 'Asistan',
      answer: ans,
      confidence: 1.0,
      route_used: 'SMALL_TALK_LOCAL',
      retrieval_used: false,
      sources: []
    };
  }

  // 4. Help Detection
  const helpPatterns = ['neler yapabilirsin', 'neler yapabiliyorsun', 'nasil kullanilir', 'bana nasil yardimci olabilirsin', 'hangi sorulari sorabilirim', 'ozelliklerin neler', 'yardim', 'help', 'yardim eder misin', 'yardimci olabilir misin'];
  if (helpPatterns.includes(norm)) {
    return {
      is_deterministic: true,
      intent: 'HELP',
      title: 'Yardım',
      answer: '### Yönetim Bilgi Asistanı Yetenekleri\n\n- **İK Politikaları:** Çalışma saatleri, giriş toleransı, yıllık izin hak edişi, dress code ve şirket kuralları.\n- **Devam ve Puantaj Bilgisi (SQL):** Bugün veya belirli tarihlerde geç kalanlar, zamanında gelenler, mesaide olanlar.\n- **Proje E-posta Güncellemeleri (RAG):** TEMSA, VORTEX ve diğer projelere ait son e-posta akışları, sprint durumları ve teslim tarihleri.\n- **Hibrit Analiz:** Devam verileri ile proje e-postalarını birleştiren çok kaynaklı korelasyon analizleri.',
      confidence: 1.0,
      route_used: 'HELP_LOCAL',
      retrieval_used: false,
      sources: []
    };
  }

  // 5. Strip leading greetings/fillers to extract core question
  let stripped = norm;
  for (const g of greetings) {
    if (stripped.startsWith(g + ' ')) {
      stripped = stripped.substring(g.length).trim();
      break;
    }
  }
  const strippedClean = normalizeTypos(stripped);

  // 6. Company Knowledge Patterns
  const companyKeywords = [
    'niso ne is yapar', 'niso hakkinda bilgi', 'sirketin faaliyet alanlari', 'faaliyet alanlari',
    'sirket hangi hizmetleri', 'fabrikanin adresi', 'fabrika adresi', 'niso kimdir', 'eldor kimdir'
  ];
  if (companyKeywords.some(k => stripped.includes(k))) {
    return {
      is_deterministic: true,
      intent: 'COMPANY_KNOWLEDGE',
      title: 'Şirket Bilgisi',
      answer: '### NISO & Eldor Şirket Bilgisi\n\n- **Faaliyet Alanları:** Otomotiv elektroniği, elektrikli araç batarya yönetim sistemleri (BMS), motor kontrol üniteleri (ECU), otonom robotik (UGV) ve endüstriyel yapay zekâ çözümleri.\n- **Fabrika & Lokasyon:** Ana üretim ve Ar-Ge merkezi ESBAŞ (Ege Serbest Bölgesi) / İzmir lokasyonundadır.\n- **Önemli Projeler:** TEMSA Elektrikli Otobüs, Vortex Otonom Sürüş Motoru, Eldor On-Board Charger (OBC) ve NISO Akıllı Fabrika İzleme Sistemleri.',
      confidence: 1.0,
      route_used: 'COMPANY_KNOWLEDGE',
      retrieval_used: false,
      sources: [{
        source_id: 'NISO-CORP',
        provider: 'COMPANY_KB',
        message_id: 'NISO-CORP',
        thread_id: null,
        title: 'Şirket Tanıtım Dokümanı',
        sender: 'NISO Kurumsal',
        received_at: null,
        project_code: null,
        data_mode: 'LIVE',
        is_synthetic: false
      }]
    };
  }

  // 7. LATEST_MAIL & Specific Mail Patterns
  const latestMailPhrases = [
    'son gelen mail', 'en son gelen mail', 'son gelen eposta', 'son gelen e posta', 'son eposta',
    'son e posta', 'son mail', 'en son mail', 'son maili ozetle', 'en son maili ozetle',
    'bana gelen son mail', 'bot hesabina gelen son mail', 'son gelen is mail', 'en guncel mail',
    'son gelen mailde ne yaziyor', 'son maille alakali', 'son maille ilgili', 'son maili okumustum',
    'son maili goster', 'son mailin riskleri'
  ];

  const isLatestMailQuery = latestMailPhrases.some(p => strippedClean.includes(p) || normClean.includes(p));

  // Check for sender pattern: "ali'den gelen son mail", "ahmetten gelen mail"
  let extractedSender = null;
  const senderMatch = strippedClean.match(/([a-zA-ZçğıöşüÇĞİÖŞÜ]+)(?:'den|'dan|den|dan|'ten|'tan|ten|tan)\s+gelen\s+(?:son\s+)?mail/i);
  if (senderMatch) {
    extractedSender = senderMatch[1];
  }

  // Check for project code inside mail query
  let extractedProjectCode = null;
  if (strippedClean.includes('temsa')) extractedProjectCode = 'PRJ-TEMSA';
  else if (strippedClean.includes('vortex')) extractedProjectCode = 'PRJ-VORTEX';
  else if (strippedClean.includes('eldor obc') || strippedClean.includes('obc')) extractedProjectCode = 'PRJ-ELDOR-OBC';
  else if (strippedClean.includes('smart factory') || strippedClean.includes('fabrika')) extractedProjectCode = 'PRJ-SMART-FACTORY';
  else if (strippedClean.includes('autosar')) extractedProjectCode = 'PRJ-AUTOSAR-ECU';

  if (isLatestMailQuery || (extractedSender && strippedClean.includes('mail')) || (strippedClean.includes('gelen') && strippedClean.includes('mail'))) {
    let queryMode = 'LATEST_MAIL';
    if (extractedSender) queryMode = 'MAIL_BY_SENDER';
    else if (strippedClean.includes('risk')) queryMode = 'PROJECT_RISKS';
    else if (strippedClean.includes('aksiyon')) queryMode = 'PROJECT_ACTIONS';

    return {
      is_deterministic: true,
      intent: 'PROJECT_MAIL',
      confidence: 0.98,
      route_used: 'PROJECT_MAIL',
      entities: {
        query_mode: queryMode,
        project_code: extractedProjectCode,
        sender: extractedSender,
        date_from: null,
        date_to: null
      },
      normalized_question: 'son gelen e-postayı özetle'
    };
  }

  // 8. General Domain Heuristics
  const attendanceKeywords = [
    'gec kaldi', 'gec kalan', 'geciken', 'gecikenler', 'gecikti', 'mesaide', 'ise geldi',
    'zamaninda gelen', 'zamaninda geldi', 'izinli', 'uzaktan calisan', 'kac kisi', 'puantaj',
    'gecikme', 'gecikmeler', 'devamsizlik', 'devamsizliklar'
  ];
  const hrKeywords = [
    'calisma saatleri', 'calisma saati', 'mesai saatleri', 'ise giris saati', 'mesai kacta basliyor',
    'ise baslama saati', 'ofis calisma saatleri', 'dress code', 'kiyafet', 'dogum izni', 'yillik izin',
    'yemek yardim', 'yol yardim', 'deneme suresi', 'prim politikasi', 'resmi tatiller'
  ];
  const projectKeywords = ['temsa', 'vortex', 'eldor obc', 'smart factory', 'bms', 'ecu', 'proje e posta', 'proje guncelleme', 'proje'];

  const hasAttendance = attendanceKeywords.some(k => stripped.includes(k));
  const hasHr = hrKeywords.some(k => stripped.includes(k));
  const hasProject = projectKeywords.some(k => stripped.includes(k));

  // Multi-source hybrid intent
  if (hasProject && (hasAttendance || hasHr || (stripped.includes('risk') && stripped.includes('gecikme')) || stripped.includes('birlikte anlat') || stripped.includes('birlikte ozetle'))) {
    return {
      is_deterministic: true,
      intent: 'HYBRID',
      confidence: 0.98,
      route_used: 'HYBRID'
    };
  }

  // Single source deterministic intent
  if (hasAttendance) {
    return {
      is_deterministic: true,
      intent: 'ATTENDANCE_SQL',
      confidence: 0.98,
      route_used: 'ATTENDANCE_SQL'
    };
  }

  if (hasHr) {
    return {
      is_deterministic: true,
      intent: 'HR_POLICY',
      confidence: 0.98,
      route_used: 'HR_POLICY'
    };
  }

  if (hasProject) {
    return {
      is_deterministic: true,
      intent: 'PROJECT_MAIL',
      confidence: 0.95,
      route_used: 'PROJECT_MAIL',
      entities: {
        query_mode: 'PROJECT_STATUS',
        project_code: extractedProjectCode,
        sender: null,
        date_from: null,
        date_to: null
      }
    };
  }

  // 9. Out-of-domain heuristics
  const unknownPatterns = ['hava nasil', 'yemek tarifi', 'sacma bir sey', 'xyzabc', 'fikra anlat', 'sarki soyle'];
  if (unknownPatterns.some(p => norm.includes(p))) {
    return {
      is_deterministic: true,
      intent: 'UNKNOWN',
      title: 'Açıklama Gerekli',
      answer: 'Bu isteğin hangi bilgi alanıyla ilgili olduğunu netleştiremedim. İK politikası, devam bilgisi veya proje güncellemesi olarak biraz daha açık sorabilir misiniz?',
      confidence: 0.99,
      route_used: 'UNKNOWN',
      retrieval_used: false,
      sources: []
    };
  }

  // Non-deterministic: fallback to LLM
  return {
    is_deterministic: false,
    confidence: 0.0,
    route_used: 'LLM_FALLBACK'
  };
}

module.exports = {
  preRouteGuard,
  normalizeTurkish,
  normalizeTypos
};
