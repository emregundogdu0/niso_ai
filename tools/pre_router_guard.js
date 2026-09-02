/**
 * Pre-Router Guard & Fast Normalization Engine
 * Handles Deterministic routing, Small Talk, Security Denials, and Intent Normalization
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

  // 2. Security Guard / Malicious & Jailbreak heuristics
  const securityPatterns = [
    'veritabanini sil', 'tablolari sil', 'drop table', 'delete from', 'truncate table',
    'sifreleri goster', 'sifreleri listele', 'credential', 'kimlik bilgileri', 'sistem promptunu goster',
    'onceki talimatlari unut', 'ignore previous instructions', 'butun kisisel verilerini dondur',
    'calisanlarin butun kisisel verilerini', 'api key', 'gizli anahtar', 'prompt injection'
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
      answer: '### Yönetim Bilgi Asistanı Yetenekleri\n\n- **İK Politikaları:** Çalışma saatleri, giriş toleransı, yıllık izin hak edişi, dress code ve şirket kuralları.\n- **Devam ve Puantaj Bilgisi (SQL):** Bugün veya belirli tarihlerde geç kalanlar, zamanında gelenler, mesaide olanlar.\n- **Proje E-posta Güncellemeleri (RAG):** TEMSA, VORTEX ve diğer projelere ait e-posta akışları, sprint durumları ve teslim tarihleri.\n- **Hibrit Analiz:** Devam verileri ile proje e-postalarını birleştiren çok kaynaklı korelasyon analizleri.',
      confidence: 1.0,
      route_used: 'HELP_LOCAL',
      retrieval_used: false,
      sources: []
    };
  }

  // 5. Strip leading greetings/fillers to extract the core question
  let stripped = norm;
  for (const g of greetings) {
    if (stripped.startsWith(g + ' ')) {
      stripped = stripped.substring(g.length).trim();
      break;
    }
  }

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
      sources: [{ title: 'Şirket Tanıtım Dokümanı', policy_code: 'NISO-CORP' }]
    };
  }

  // 7. Check if query has deterministic business intent
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
      route_used: 'PROJECT_MAIL'
    };
  }

  // 8. Out-of-domain heuristics
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
  normalizeTurkish
};
