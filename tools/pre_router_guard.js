/**
 * Multilingual Pre-Router Guard & Fast Normalization Engine (TR, EN, IT)
 * First-Class Support for Turkish (tr), English (en), and Italian (it).
 */

const { normalizeText } = require('./date_normalizer');

// Fast deterministic language detector based on distinctive character n-grams and vocabulary
function detectLanguageDeterministic(text) {
  const norm = normalizeText(text);

  // 1. Distinctive Turkish Tokens
  const trTokens = [
    'merhaba', 'selam', 'nasilsin', 'tesekkur', 'gorusuruz', 'calisma', 'saatleri', 'izin',
    'dogum', 'yillik', 'bugun', 'dun', 'kimler', 'gec', 'kaldi', 'projesinde', 'son', 'durum',
    'eposta', 'meyl', 'ozetle', 'bana', 'veritabanini', 'sil', 'neler', 'yapabilirsin',
    'yardim', 'kiyafet', 'yemek', 'mesai', 'nedir', 'hangi', 'kisi', 'kac', 'tarif', 'kek',
    'fikra', 'goster', 'anlat', 'hakkinda', 'var', 'mi', 've', 'icin',
    'kim', 'sirket', 'sahibi', 'kurdu', 'yapti', 'mail', 'oku', 'icerigi', 'alakali',
    'diyorum', 'ampul', 'patladi', 'turkce', 'cevap', 'iyiyim', 'okumustum', 'ozet'
  ];

  // 2. Distinctive English Tokens
  const enTokens = [
    'hello', 'hi', 'how', 'are', 'you', 'thanks', 'thank', 'goodbye', 'bye', 'good', 'morning',
    'working', 'hours', 'leave', 'maternity', 'annual', 'today', 'yesterday', 'who', 'late',
    'arrived', 'latest', 'status', 'project', 'email', 'summarize', 'most', 'recent', 'delete',
    'database', 'drop', 'what', 'can', 'help', 'dress', 'code', 'recipe', 'cake', 'joke',
    'show', 'tell', 'about', 'is', 'available', 'does', 'say', 'give', 'me', 'the', 'of'
  ];

  // 3. Distinctive Italian Tokens
  const itTokens = [
    'ciao', 'salve', 'buongiorno', 'buonasera', 'come', 'stai', 'grazie', 'arrivederci', 'orari',
    'lavoro', 'ferie', 'permesso', 'congedo', 'maternita', 'oggi', 'ieri', 'chi', 'ritardo',
    'arrivato', 'ultimo', 'stato', 'progetto', 'riassumi', 'recente', 'elimina', 'cancella',
    'cosa', 'puoi', 'fare', 'aiuto', 'abbigliamento', 'ricetta', 'torta', 'barzelletta',
    'mostra', 'racconta', 'previsto', 'dice', 'dammi', 'una', 'qual', 'quali', 'sono',
    'il', 'la', 'le', 'lo', 'gli', 'i', 'un', 'uno', 'del', 'della', 'degli', 'dei', 'nel', 'per'
  ];

  const words = norm.split(/\s+/).filter(Boolean);

  let trScore = 0;
  let enScore = 0;
  let itScore = 0;

  for (const w of words) {
    if (trTokens.includes(w)) trScore += 2;
    if (enTokens.includes(w)) enScore += 2;
    if (itTokens.includes(w)) itScore += 2;
  }

  // Exact phrase bonuses
  if (norm.includes('how are you') || norm.includes('what is') || norm.includes('working hours') || norm.includes('who arrived') || norm.includes('latest status') || norm.includes('give me') || norm.includes('delete the database') || norm.includes('summarize the latest')) enScore += 8;
  if (norm.includes('come stai') || norm.includes('orari di lavoro') || norm.includes('chi e arrivato') || norm.includes('ultimo stato') || norm.includes('dammi una') || norm.includes('qual e') || norm.includes('elimina il database') || norm.includes('riassumi l ultima')) itScore += 8;
  if (norm.includes('nasilsin') || norm.includes('calisma saatleri') || norm.includes('kimler gec kaldi') || norm.includes('son durum') || norm.includes('bana kek') || norm.includes('veritabanini sil') || norm.includes('son gelen maili')) trScore += 8;

  if (enScore > trScore && enScore > itScore) {
    return { lang: 'en', confidence: Math.min(0.99, 0.75 + enScore * 0.05) };
  }
  if (itScore > trScore && itScore > enScore) {
    return { lang: 'it', confidence: Math.min(0.99, 0.75 + itScore * 0.05) };
  }
  if (trScore > 0) {
    return { lang: 'tr', confidence: Math.min(0.99, 0.75 + trScore * 0.05) };
  }

  return { lang: 'tr', confidence: 0.50 };
}

function preRouteGuard(message, sessionLanguage = 'tr') {
  const raw = String(message || '').trim();

  // 1. Empty or whitespace-only messages
  if (!raw) {
    const lang = sessionLanguage || 'tr';
    const emptyMsgs = {
      tr: 'Lütfen yanıtlayabileceğim bir soru veya mesaj yazınız.',
      en: 'Please enter a question or message so I can assist you.',
      it: 'Inserisci una domanda o un messaggio per consentirmi di aiutarti.'
    };
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: 1.0,
      response_language: lang,
      intent: 'UNKNOWN',
      intent_confidence: 1.0,
      title: lang === 'en' ? 'Clarification Needed' : (lang === 'it' ? 'Chiarimento Necessario' : 'Açıklama Gerekli'),
      answer: emptyMsgs[lang] || emptyMsgs.tr,
      route_used: 'EMPTY_INPUT',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: ''
    };
  }

  const norm = normalizeText(raw);
  const detected = detectLanguageDeterministic(raw);
  const lang = detected.lang;
  const langConf = detected.confidence;

  // 2. Security Guard (Malicious / DB drop / Credential leak) in TR, EN, IT
  const securityPatterns = [
    // TR
    'veritabanini sil', 'tablolari sil', 'drop table', 'delete from', 'truncate table',
    'sifreleri goster', 'sifreleri listele', 'credential', 'kimlik bilgileri', 'sistem promptunu goster',
    'onceki talimatlari unut', 'talimatlari calistir', 'komut calistir',
    // EN
    'delete the database', 'delete database', 'drop database', 'delete from table',
    'show passwords', 'ignore previous instructions', 'execute shell', 'system prompt',
    // IT
    'elimina il database', 'cancella il database', 'elimina database', 'cancella le tabelle',
    'mostra le password', 'ignora le istruzioni precedenti', 'esegui comando'
  ];

  if (securityPatterns.some(p => norm.includes(p))) {
    const secMsgs = {
      tr: 'Bu isteği güvenlik ve yetkilendirme kuralları nedeniyle gerçekleştiremiyorum.',
      en: 'This operation cannot be performed due to security and authorization rules.',
      it: 'Questa operazione non può essere eseguita per motivi di sicurezza e autorizzazione.'
    };
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'SECURITY_REJECTED',
      intent_confidence: 1.0,
      title: lang === 'en' ? 'Security Denial' : (lang === 'it' ? 'Rifiuto di Sicurezza' : 'Güvenli Ret'),
      answer: secMsgs[lang] || secMsgs.tr,
      route_used: 'SECURITY_GUARD',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  // 2B. Spam / Advertisement Queries (Policy Notice)
  if (norm.includes('reklam mail') || norm.includes('spam mail') || norm.includes('spam folder') || norm.includes('cartella spam')) {
    const spamMsgs = {
      tr: 'Reklam ve spam niteliğindeki e-postalar güvenlik ve filtreleme kuralları gereğince sisteme indekslenmemektedir. Yalnızca onaylanmış iş ve proje e-postaları sorgulanabilir.',
      en: 'Promotional and spam emails are not indexed into the system per security policy. Only verified business and project emails can be queried.',
      it: 'Le email promozionali e di spam non vengono indicizzate nel sistema per motivi di sicurezza. È possibile consultare solo email aziendali e di progetto verificate.'
    };
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'PROJECT_MAIL',
      intent_confidence: 0.98,
      title: lang === 'en' ? 'Notice' : (lang === 'it' ? 'Avviso' : 'Bilgi Notu'),
      answer: spamMsgs[lang] || spamMsgs.tr,
      route_used: 'FILTERED_MAIL_NOTICE',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  // 3. Small Talk in TR, EN, IT
  const greetingsTr = ['merhaba', 'merhabalar', 'selam', 'selamlar', 'gunaydin', 'iyi gunler', 'iyi aksamlar', 'hey', 'slm'];
  const pleasantriesTr = ['nasilsin', 'nasil gidiyor', 'ne haber', 'naber', 'iyi misin', 'keyifler nasil'];
  const positiveRepliesTr = ['ben de iyiyim', 'bende iyiyim', 'ben iyiyim', 'iyiyim ben de', 'iyiyim tesekkurler'];
  const thanksTr = ['tesekkurler', 'tesekkur ederim', 'sag ol', 'sagol', 'eyvallah', 'tamamdir', 'tamam'];
  const farewellsTr = ['gorusuruz', 'hosca kal', 'hoscakal', 'bay bay', 'bye'];

  const greetingsEn = ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening'];
  const pleasantriesEn = ['how are you', 'how are you doing', 'how is it going', 'whats up', 'how do you do'];
  const thanksEn = ['thanks', 'thank you', 'thank you very much', 'thx'];
  const farewellsEn = ['goodbye', 'bye', 'see you', 'see you later', 'farewell'];

  const greetingsIt = ['ciao', 'salve', 'buongiorno', 'buonasera', 'buon pomeriggio'];
  const pleasantriesIt = ['come stai', 'come va', 'come andiamo', 'tutto bene'];
  const thanksIt = ['grazie', 'mille grazie', 'molte grazie', 'ti ringrazio'];
  const farewellsIt = ['arrivederci', 'a presto', 'addio', 'buona giornata'];

  const isGreeting = greetingsTr.includes(norm) || greetingsEn.includes(norm) || greetingsIt.includes(norm);
  const isPleasantry = pleasantriesTr.includes(norm) || pleasantriesEn.includes(norm) || pleasantriesIt.includes(norm);
  const isPositiveReply = positiveRepliesTr.includes(norm);
  const isThanks = thanksTr.includes(norm) || thanksEn.includes(norm) || thanksIt.includes(norm);
  const isFarewell = farewellsTr.includes(norm) || farewellsEn.includes(norm) || farewellsIt.includes(norm);

  const languagePreferenceTr = ['turkce cevap ver', 'turkce konus', 'turkce devam et'];
  if (languagePreferenceTr.some(p => norm.includes(p))) {
    return {
      is_deterministic: true,
      detected_language: 'tr',
      language_confidence: 1.0,
      response_language: 'tr',
      intent: 'SMALL_TALK',
      intent_confidence: 1.0,
      title: 'Asistan',
      answer: 'Elbette, bundan sonra Türkçe yanıt vereceğim.',
      route_used: 'LANGUAGE_PREFERENCE_LOCAL',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  const assistantIdentityTr = ['seni kim yapti', 'seni kim gelistirdi', 'sen kimsin', 'hangi modelsin'];
  if (assistantIdentityTr.some(p => norm.includes(p))) {
    return {
      is_deterministic: true,
      detected_language: 'tr',
      language_confidence: 1.0,
      response_language: 'tr',
      intent: 'SMALL_TALK',
      intent_confidence: 1.0,
      title: 'Asistan',
      answer: "NISO yönetim süreçleri için geliştirilen yerel bir yapay zekâ asistanıyım. Yanıt üretiminde Ollama üzerinde çalışan Qwen3.5:9B modelini kullanıyorum.",
      route_used: 'ASSISTANT_IDENTITY_LOCAL',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  if (isGreeting || isPleasantry || isPositiveReply || isThanks || isFarewell) {
    let ans = '';
    if (lang === 'en') {
      if (isPleasantry) ans = "I'm doing well, thank you. How can I help you?";
      else if (isThanks) ans = "You're welcome! Let me know if you need anything else.";
      else if (isFarewell) ans = "Goodbye! Have a great day.";
      else ans = "Hello! How can I help you today? You can ask about HR policies, attendance records, or project updates.";
    } else if (lang === 'it') {
      if (isPleasantry) ans = "Sto bene, grazie. Come posso aiutarti?";
      else if (isThanks) ans = "Prego! Fammi sapere se posso aiutarti con altro.";
      else if (isFarewell) ans = "Arrivederci! Buona giornata.";
      else ans = "Ciao! Come posso aiutarti oggi? Puoi chiedermi informazioni sulle politiche HR, sulle presenze o sugli aggiornamenti di progetto.";
    } else {
      if (isPositiveReply) ans = "Buna sevindim. Size nasıl yardımcı olabilirim?";
      else if (isPleasantry) ans = "İyiyim, teşekkür ederim. Size nasıl yardımcı olabilirim?";
      else if (isThanks) ans = "Rica ederim. Başka bir konuda yardımcı olabilir miyim?";
      else if (isFarewell) ans = "Görüşmek üzere, iyi günler dilerim.";
      else ans = "Merhaba! Size nasıl yardımcı olabilirim? İK politikaları, devam bilgileri veya proje güncellemeleri hakkında soru sorabilirsiniz.";
    }

    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: 0.99,
      response_language: lang,
      intent: 'SMALL_TALK',
      intent_confidence: 1.0,
      title: lang === 'en' ? 'Assistant' : (lang === 'it' ? 'Assistente' : 'Asistan'),
      answer: ans,
      route_used: 'SMALL_TALK_LOCAL',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  // 4. Help Detection in TR, EN, IT
  const helpTr = ['neler yapabilirsin', 'nasil kullanilir', 'bana nasil yardimci olabilirsin', 'yardim'];
  const helpEn = ['what can you do', 'how to use', 'how can you help me', 'help'];
  const helpIt = ['cosa puoi fare', 'come si usa', 'come puoi aiutarmi', 'aiuto'];

  if (helpTr.some(p => norm.includes(p)) || helpEn.some(p => norm.includes(p)) || helpIt.some(p => norm.includes(p))) {
    const helpAnswers = {
      tr: '### Yönetim Bilgi Asistanı Yetenekleri\n\n- **İK Politikaları:** Çalışma saatleri, giriş toleransı, yıllık izin hak edişi, doğum izni ve dress code.\n- **Devam ve Puantaj (SQL):** Bugün veya belirli tarihlerde geç kalanlar, zamanında gelenler, mesaide olanlar.\n- **Proje E-Postası (RAG):** TEMSA, Vortex ve diğer projelere ait güncellemeler ve en son e-postalar.\n- **Hibrit Analiz:** Devam verileri ile proje e-postalarını birleştiren çok kaynaklı analizler.',
      en: '### Management Assistant Capabilities\n\n- **HR Policies:** Working hours, arrival grace period, annual leave entitlement, maternity leave, and dress code.\n- **Attendance (SQL):** Employees who arrived late today or on specific dates, on-time arrivals, presence.\n- **Project Email (RAG):** Status updates and latest emails for TEMSA, Vortex, and other projects.\n- **Hybrid Analysis:** Multi-source correlations combining attendance and project emails.',
      it: "### Funzionalità dell'Assistente di Direzione\n\n- **Politiche HR:** Orari di lavoro, tolleranza d'ingresso, ferie annuali, congedo di maternità e dress code.\n- **Presenze (SQL):** Dipendenti in ritardo oggi o in date specifiche, presenze puntuali, stato servizio.\n- **Email di Progetto (RAG):** Aggiornamenti di stato e ultime email per TEMSA, Vortex e altri progetti.\n- **Analisi Ibrida:** Correlazioni multi-fonte tra dati di presenza ed email di progetto."
    };
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'HELP',
      intent_confidence: 1.0,
      title: lang === 'en' ? 'Help' : (lang === 'it' ? 'Aiuto' : 'Yardım'),
      answer: helpAnswers[lang] || helpAnswers.tr,
      route_used: 'HELP_LOCAL',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  // 5. Out-of-domain / Unknown in TR, EN, IT (e.g. cake recipe, joke)
  const unknownPatterns = [
    'kek tarifi', 'yemek tarifi', 'fikra anlat', 'sarki soyle', 'sacma bir sey',
    'cake recipe', 'recipe', 'tell me a joke', 'sing a song', 'random nonsense', 'give me a cake recipe',
    'ricetta per una torta', 'ricetta', 'raccontami una barzelletta', 'canta una canzone', 'dammi una ricetta'
  ];
  if (unknownPatterns.some(p => norm.includes(p))) {
    const unkMsgs = {
      tr: 'Bu asistan şirket içi yönetim bilgileri için tasarlanmıştır; yemek tarifi gibi kapsam dışı isteklere yanıt veremem. İK politikaları, devam bilgileri, kurumsal bilgiler veya proje e-postaları hakkında yardımcı olabilirim.',
      en: 'This assistant is designed for internal management information and cannot answer out-of-scope requests such as recipes. I can help with HR policies, attendance, company information, or project emails.',
      it: "Questo assistente è progettato per informazioni gestionali interne e non può rispondere a richieste fuori ambito come le ricette. Posso aiutarti con politiche HR, presenze, informazioni aziendali o email di progetto."
    };
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'UNKNOWN',
      intent_confidence: 0.99,
      title: lang === 'en' ? 'Clarification Needed' : (lang === 'it' ? 'Chiarimento Necessario' : 'Açıklama Gerekli'),
      answer: unkMsgs[lang] || unkMsgs.tr,
      route_used: 'UNKNOWN',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  // 6. LATEST_MAIL & Project Mail in TR, EN, IT
  const latestMailPhrases = [
    // TR
    'son gelen mail', 'en son gelen mail', 'son gelen eposta', 'son eposta', 'son maili ozetle', 'en son e postada ne yaziyor', 'son proje mailini anlat', 'son maili goster',
    // EN
    'summarize the latest email', 'what does the most recent email say', 'summarize the latest project email', 'latest email', 'most recent email', 'last email',
    // IT
    'riassumi l ultima email', 'riassumi lultima email', 'cosa dice l email piu recente', 'cosa dice lemail piu recente', 'riassumi l ultima email del progetto', 'ultima email'
  ];

  const hasMailReference = ['mail', 'eposta', 'e posta'].some(p => norm.includes(p));
  const hasLatestCue = ['son ', 'en son', 'sonuncu', 'latest', 'most recent', 'last email', 'ultima'].some(p => norm.includes(p));
  const wantsMailContent = ['oku', 'ozet', 'icerik', 'ne yaziyor', 'neyle alakali', 'neden bahsediyor'].some(p => norm.includes(p));
  const hasNamedProject = ['temsa', 'vortex', 'eldor obc', 'obc', 'smart factory'].some(p => norm.includes(p));
  const isLatestMail = latestMailPhrases.some(p => norm.includes(p)) ||
    (hasMailReference && hasLatestCue) ||
    (hasMailReference && wantsMailContent && hasNamedProject);

  // Extract Project Code if present
  let extractedProjectCode = null;
  if (norm.includes('temsa')) extractedProjectCode = 'PRJ-TEMSA';
  else if (norm.includes('vortex')) extractedProjectCode = 'PRJ-VORTEX';
  else if (norm.includes('eldor obc') || norm.includes('obc')) extractedProjectCode = 'PRJ-ELDOR-OBC';
  else if (norm.includes('smart factory') || norm.includes('fabrika')) extractedProjectCode = 'PRJ-SMART-FACTORY';

  if (isLatestMail) {
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'PROJECT_MAIL',
      intent_confidence: 0.98,
      route_used: 'PROJECT_MAIL',
      entities: {
        query_mode: 'LATEST_MAIL',
        project_code: extractedProjectCode,
        sender: null,
        response_language: lang
      },
      original_question: raw,
      normalized_question: norm
    };
  }

  // 7. General Project Questions (TEMSA, Vortex status)
  const projectKeywords = [
    'temsa', 'vortex', 'eldor obc', 'smart factory', 'autosar',
    'son durum', 'latest status', 'current status', 'ultimo stato', 'stato attuale'
  ];
  const hasProject = projectKeywords.some(k => norm.includes(k));

  // 7B. Company profile and ownership questions
  const companyNames = ['niso', 'eldor'];
  const companyQuestionKeywords = [
    'sahibi', 'kurucu', 'kim kurdu', 'ne is yapar', 'faaliyet alani', 'faaliyet alanlari',
    'genel merkez', 'fabrika adresi', 'nerede', 'urunleri', 'teknolojileri', 'sirket profili'
  ];
  const hasCompanyKnowledge = companyNames.some(k => norm.includes(k)) &&
    companyQuestionKeywords.some(k => norm.includes(k));

  if (hasCompanyKnowledge) {
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'COMPANY_KNOWLEDGE',
      intent_confidence: 0.98,
      route_used: 'COMPANY_KNOWLEDGE',
      original_question: raw,
      normalized_question: norm
    };
  }

  // 7C. Operational facility reports: provide a useful handoff without inventing a ticket.
  const facilityIssuePatterns = ['ampul patladi', 'lamba patladi', 'isik bozuk', 'klima bozuk', 'su akiyor'];
  if (facilityIssuePatterns.some(p => norm.includes(p))) {
    return {
      is_deterministic: true,
      detected_language: 'tr',
      language_confidence: 1.0,
      response_language: 'tr',
      intent: 'HELP',
      intent_confidence: 0.98,
      title: 'Operasyonel Bildirim',
      answer: 'Bu durum tesis veya idari işler ekibine bildirilmelidir. Konumu ve mümkünse arızanın kısa açıklamasını paylaşın; bu arayüzde henüz otomatik bakım kaydı oluşturma entegrasyonu bulunmuyor.',
      route_used: 'FACILITY_HANDOFF_LOCAL',
      retrieval_used: false,
      sources: [],
      original_question: raw,
      normalized_question: norm
    };
  }

  // 8. Attendance & SQL in TR, EN, IT
  const attendanceKeywords = [
    // TR
    'gec kaldi', 'geciken', 'gec kalan', 'mesaide', 'ise geldi', 'zamaninda gelen', 'puantaj',
    // EN
    'arrived late', 'who arrived late', 'who is late', 'was on time', 'who was on time', 'attendance', 'late today',
    // IT
    'arrivato in ritardo', 'chi e arrivato in ritardo', 'chi e in ritardo', 'era puntuale', 'presenze', 'in ritardo oggi'
  ];
  const hasAttendance = attendanceKeywords.some(k => norm.includes(k));

  // 9. HR Policy in TR, EN, IT
  const hrKeywords = [
    // TR
    'calisma saatleri', 'calisma saati', 'mesai saatleri', 'dogum izni', 'yillik izin', 'kiyafet', 'dress code',
    // EN
    'working hours', 'work hours', 'office hours', 'maternity leave', 'annual leave', 'dress code', 'vacation',
    // IT
    'orari di lavoro', 'orario di lavoro', 'congedo di maternita', 'maternita', 'ferie annuali', 'giorni di ferie', 'codice di abbigliamento'
  ];
  const hasHr = hrKeywords.some(k => norm.includes(k));

  // Multi-source hybrid intent
  if (hasProject && (hasAttendance || hasHr || norm.includes('hybrid') || norm.includes('birlikte anlat'))) {
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'HYBRID',
      intent_confidence: 0.98,
      route_used: 'HYBRID',
      original_question: raw,
      normalized_question: norm
    };
  }

  if (hasAttendance) {
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'ATTENDANCE_SQL',
      intent_confidence: 0.98,
      route_used: 'ATTENDANCE_SQL',
      original_question: raw,
      normalized_question: norm
    };
  }

  if (hasHr) {
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'HR_POLICY',
      intent_confidence: 0.98,
      route_used: 'HR_POLICY',
      original_question: raw,
      normalized_question: norm
    };
  }

  if (hasProject) {
    return {
      is_deterministic: true,
      detected_language: lang,
      language_confidence: langConf,
      response_language: lang,
      intent: 'PROJECT_MAIL',
      intent_confidence: 0.95,
      route_used: 'PROJECT_MAIL',
      entities: {
        query_mode: 'PROJECT_STATUS',
        project_code: extractedProjectCode,
        response_language: lang
      },
      original_question: raw,
      normalized_question: norm
    };
  }

  // Non-deterministic: Layer 2 fallback
  return {
    is_deterministic: false,
    detected_language: lang,
    language_confidence: langConf,
    response_language: lang,
    intent: 'UNKNOWN',
    intent_confidence: 0.0,
    route_used: 'LLM_FALLBACK',
    original_question: raw,
    normalized_question: norm
  };
}

module.exports = {
  preRouteGuard,
  detectLanguageDeterministic,
  normalizeText
};
