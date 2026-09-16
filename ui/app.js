/**
 * NISO Management Assistant — Frontend Application Architecture
 * Modular Components: I18n, Sidebar, UserStatus, ChatWelcome, ChatInput, SuggestionCards, ConversationStream, HistoryManager
 */

document.addEventListener('DOMContentLoaded', () => {
  // =========================================================================
  // I18n (Internationalization) Engine: TR, EN, IT
  // =========================================================================
  const I18n = {
    current: localStorage.getItem('niso_language') || 'tr',
    translations: {
      tr: {
        page_title: 'NISO Yönetim Asistanı',
        new_chat: 'Yeni Sohbet',
        attendance_nav: 'Giriş Saatleri (Puantaj)',
        documents_nav: 'Doküman Yükle (OCR)',
        history: 'Sohbet Geçmişi',
        system_info: 'Sistem Bilgisi',
        settings: 'Ayarlar',
        secure_conn: 'Güvenli bağlantı',
        greeting_prefix: 'Merhaba',
        greeting_suffix_1: 'Bugün nasıl',
        greeting_suffix_2: 'yardımcı',
        greeting_suffix_3: 'olabilirim?',
        hero_placeholder: 'NISO hakkında bir şey sorun... (Shift+Enter yeni satır)',
        bottom_placeholder: 'Takip sorusu veya yeni bir konu sorun...',
        send: 'Gönder',
        attach: 'Dosya Ekle',
        voice: 'Sesli Giriş',
        voice_listening: 'Dinliyorum...',
        voice_processing: 'Yanıt hazırlanıyor...',
        voice_speaking: 'Yanıt okunuyor...',
        voice_unsupported: 'Sesli giriş bu tarayıcıda desteklenmiyor.',
        suggestion_1: 'Projelerde son durum nedir?',
        suggestion_2: 'Bugün kimler geç kaldı?',
        suggestion_3: 'Çalışma saatleri nelerdir?',
        footer_note: 'Yanıtlar şirket içi kaynaklardan (İK, Puantaj SQL ve Proje RAG) oluşturulur.',
        step_1: 'Soru analiz ediliyor ve sınıflandırılıyor...',
        step_2: 'Veritabanı ve dokümanlar taranıyor...',
        step_3: 'Yanıt güvenli şekilde sentezleniyor...',
        copy: 'Kopyala',
        copied: 'Kopyalandı',
        sources_title: 'Doğrulanmış Kaynaklar',
        badge_demo: 'Sentetik Demo',
        badge_live_test: 'Canlı Test',
        badge_live: 'Canlı Kaynak',
        history_title: 'Sohbet Geçmişi',
        clear_history: 'Geçmişi Temizle',
        no_history: 'Henüz kaydedilmiş sohbet geçmişi bulunmuyor.',
        sidebar_open: "Sidebar'ı genişlet",
        sidebar_close: "Sidebar'ı daralt",
        info_title: 'Sistem ve Entegrasyon Durumu',
        info_model: 'Yapay Zekâ Modeli:',
        info_embedding: 'Embedding Modeli:',
        info_db: 'Veritabanı & Vektör:',
        info_gmail: 'Gmail Entegrasyonu:',
        info_outlook: 'Outlook Entegrasyonu:',
        info_privacy: 'Gizlilik & Güvenlik:',
        info_session: 'Oturum ID:',
        route_hr: 'İK Bilgisi',
        route_sql: 'Devam Bilgisi',
        route_mail: 'Proje E-postası (RAG)',
        route_hybrid: 'Hibrit Analiz',
        route_company: 'Şirket Bilgisi',
        route_smalltalk: 'Asistan',
        route_help: 'Yardım',
        route_security: 'Güvenli Ret',
        route_unknown: 'Açıklama Gerekli',
        route_error: 'Sistem Uyarısı',
        empty_input_msg: 'Lütfen yanıtlayabileceğim bir soru veya mesaj yazınız.',
        synthetic_notice: 'Bu cevap sentetik demo verileri içermektedir.',
        live_test_notice: 'Bu cevap canlı test verilerine dayanmaktadır.',
        confidence_label: 'Güven',
        judge_label: 'Hakem'
      },
      en: {
        page_title: 'NISO Management Assistant',
        new_chat: 'New Chat',
        attendance_nav: 'Attendance',
        documents_nav: 'Document Upload (OCR)',
        history: 'Chat History',
        system_info: 'System Info',
        settings: 'Settings',
        secure_conn: 'Secure connection',
        greeting_prefix: 'Hello',
        greeting_suffix_1: 'How can I',
        greeting_suffix_2: 'help',
        greeting_suffix_3: 'you today?',
        hero_placeholder: 'Ask something about NISO... (Shift+Enter for new line)',
        bottom_placeholder: 'Ask a follow-up or a new topic...',
        send: 'Send',
        attach: 'Attach File',
        voice: 'Voice Input',
        voice_listening: 'Listening...',
        voice_processing: 'Preparing answer...',
        voice_speaking: 'Reading answer...',
        voice_unsupported: 'Voice input is not supported in this browser.',
        suggestion_1: 'What is the latest status of the projects?',
        suggestion_2: 'Who is late today?',
        suggestion_3: 'What are the working hours?',
        footer_note: 'Answers are generated from internal company sources (HR, Attendance SQL, Project RAG).',
        step_1: 'Analyzing and classifying query...',
        step_2: 'Scanning database and documents...',
        step_3: 'Synthesizing secure response...',
        copy: 'Copy',
        copied: 'Copied',
        sources_title: 'Verified Sources',
        badge_demo: 'Synthetic Demo',
        badge_live_test: 'Live Test',
        badge_live: 'Live Source',
        history_title: 'Chat History',
        clear_history: 'Clear History',
        no_history: 'No saved chat history yet.',
        sidebar_open: 'Expand sidebar',
        sidebar_close: 'Collapse sidebar',
        info_title: 'System & Integration Status',
        info_model: 'AI Model:',
        info_embedding: 'Embedding Model:',
        info_db: 'Database & Vector:',
        info_gmail: 'Gmail Integration:',
        info_outlook: 'Outlook Integration:',
        info_privacy: 'Privacy & Security:',
        info_session: 'Session ID:',
        route_hr: 'HR Policy',
        route_sql: 'Attendance Info',
        route_mail: 'Project Email (RAG)',
        route_hybrid: 'Hybrid Analysis',
        route_company: 'Company Info',
        route_smalltalk: 'Assistant',
        route_help: 'Help',
        route_security: 'Security Denial',
        route_unknown: 'Clarification Needed',
        route_error: 'System Notice',
        empty_input_msg: 'Please enter a question or message.',
        synthetic_notice: 'This response contains synthetic demo data.',
        live_test_notice: 'This response is based on live test data.',
        confidence_label: 'Confidence',
        judge_label: 'Judge'
      },
      it: {
        page_title: 'NISO Assistente di Direzione',
        new_chat: 'Nuova Chat',
        attendance_nav: 'Presenze',
        documents_nav: 'Carica Documenti (OCR)',
        history: 'Cronologia Chat',
        system_info: 'Info Sistema',
        settings: 'Impostazioni',
        secure_conn: 'Connessione sicura',
        greeting_prefix: 'Ciao',
        greeting_suffix_1: 'Come posso',
        greeting_suffix_2: 'aiutarti',
        greeting_suffix_3: 'oggi?',
        hero_placeholder: 'Chiedi qualcosa su NISO... (Shift+Enter per nuova riga)',
        bottom_placeholder: 'Fai una domanda di follow-up o un nuovo argomento...',
        send: 'Invia',
        attach: 'Allega File',
        voice: 'Input Vocale',
        voice_listening: 'Sto ascoltando...',
        voice_processing: 'Preparazione risposta...',
        voice_speaking: 'Lettura risposta...',
        voice_unsupported: 'Input vocale non supportato in questo browser.',
        suggestion_1: 'Qual è lo stato più recente dei progetti?',
        suggestion_2: 'Chi è in ritardo oggi?',
        suggestion_3: 'Quali sono gli orari di lavoro?',
        footer_note: 'Le risposte sono generate da fonti interne aziendali (HR, Presenze SQL, RAG Progetti).',
        step_1: 'Analisi e classificazione della richiesta...',
        step_2: 'Scansione del database e dei documenti...',
        step_3: 'Sintesi sicura della risposta...',
        copy: 'Copia',
        copied: 'Copiato',
        sources_title: 'Fonti Verificate',
        badge_demo: 'Demo Sintetica',
        badge_live_test: 'Test dal Vivo',
        badge_live: 'Fonte dal Vivo',
        history_title: 'Cronologia Chat',
        clear_history: 'Cancella Cronologia',
        no_history: 'Nessuna cronologia chat salvata.',
        sidebar_open: 'Espandi barra laterale',
        sidebar_close: 'Riduci barra laterale',
        info_title: 'Stato del Sistema e Integrazione',
        info_model: 'Modello AI:',
        info_embedding: 'Modello di Embedding:',
        info_db: 'Database e Vettore:',
        info_gmail: 'Integrazione Gmail:',
        info_outlook: 'Integrazione Outlook:',
        info_privacy: 'Privacy e Sicurezza:',
        info_session: 'ID Sessione:',
        route_hr: 'Info HR',
        route_sql: 'Info Presenze',
        route_mail: 'Email Progetto (RAG)',
        route_hybrid: 'Analisi Ibrida',
        route_company: 'Info Aziendali',
        route_smalltalk: 'Assistente',
        route_help: 'Aiuto',
        route_security: 'Rifiuto di Sicurezza',
        route_unknown: 'Chiarimento Necessario',
        route_error: 'Avviso di Sistema',
        empty_input_msg: 'Inserisci una domanda o un messaggio.',
        synthetic_notice: 'Questa risposta contiene dati demo sintetici.',
        live_test_notice: 'Questa risposta si basa su dati di test dal vivo.',
        confidence_label: 'Confidenza',
        judge_label: 'Giudice'
      }
    },

    t(key) {
      const lang = this.translations[this.current] || this.translations['tr'];
      return lang[key] || (this.translations['tr'] && this.translations['tr'][key]) || key;
    },

    setLanguage(lang) {
      if (!this.translations[lang]) return;
      this.current = lang;
      localStorage.setItem('niso_language', lang);
      this.apply();
    },

    apply() {
      // 1. Update Lang Switcher Buttons
      document.querySelectorAll('.lang-btn').forEach(btn => {
        if (btn.getAttribute('data-lang') === this.current) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });

      // 2. Page Title & Document Lang
      document.documentElement.lang = this.current;
      const titleElem = document.getElementById('pageTitle');
      if (titleElem) titleElem.textContent = this.t('page_title');
      document.title = this.t('page_title');

      // 3. Navigation Rail Tooltips & Aria
      const newChatBtn = document.getElementById('newChatBtn');
      if (newChatBtn) {
        newChatBtn.title = this.t('new_chat');
        newChatBtn.setAttribute('aria-label', this.t('new_chat'));
      }
      const attNavBtn = document.getElementById('attendanceNavBtn');
      if (attNavBtn) {
        attNavBtn.title = this.t('attendance_nav');
        attNavBtn.setAttribute('aria-label', this.t('attendance_nav'));
      }
      const docNavBtn = document.getElementById('documentsNavBtn');
      if (docNavBtn) {
        docNavBtn.title = this.t('documents_nav');
        docNavBtn.setAttribute('aria-label', this.t('documents_nav'));
      }
      const historyBtn = document.getElementById('historyBtn');
      if (historyBtn) {
        historyBtn.title = this.t('history');
        historyBtn.setAttribute('aria-label', this.t('history'));
      }
      const infoBtn = document.getElementById('infoBtn');
      if (infoBtn) {
        infoBtn.title = this.t('system_info');
        infoBtn.setAttribute('aria-label', this.t('system_info'));
      }
      const navNewChat = document.getElementById('txtNavNewChat');
      if (navNewChat) navNewChat.textContent = this.t('new_chat');
      const navAttendance = document.getElementById('txtNavAttendance');
      if (navAttendance) navAttendance.textContent = this.t('attendance_nav');
      const navDocuments = document.getElementById('txtNavDocuments');
      if (navDocuments) navDocuments.textContent = this.t('documents_nav');
      const navHistory = document.getElementById('txtNavHistory');
      if (navHistory) navHistory.textContent = this.t('history');
      const sidebarHistoryTitle = document.getElementById('txtSidebarHistoryTitle');
      if (sidebarHistoryTitle) sidebarHistoryTitle.textContent = this.t('history');
      const navSettings = document.getElementById('txtNavSettings');
      if (navSettings) navSettings.textContent = this.t('settings');

      // 4. Secure Connection Badge
      const txtSecure = document.getElementById('txtSecureConn');
      if (txtSecure) txtSecure.textContent = this.t('secure_conn');

      // 5. Welcome Greeting
      const txtGPrefix = document.getElementById('txtGreetingPrefix');
      if (txtGPrefix) txtGPrefix.textContent = this.t('greeting_prefix');
      const txtGSuffix1 = document.getElementById('txtGreetingSuffix1');
      if (txtGSuffix1) txtGSuffix1.textContent = this.t('greeting_suffix_1');
      const txtGSuffix2 = document.getElementById('txtGreetingSuffix2');
      if (txtGSuffix2) txtGSuffix2.textContent = this.t('greeting_suffix_2');
      const txtGSuffix3 = document.getElementById('txtGreetingSuffix3');
      if (txtGSuffix3) txtGSuffix3.textContent = this.t('greeting_suffix_3');

      // 6. Composers (Hero & Bottom)
      const heroInput = document.getElementById('heroMessageInput');
      if (heroInput) {
        heroInput.placeholder = this.t('hero_placeholder');
        heroInput.setAttribute('aria-label', this.t('hero_placeholder'));
      }
      const bottomInput = document.getElementById('bottomMessageInput');
      if (bottomInput) {
        bottomInput.placeholder = this.t('bottom_placeholder');
        bottomInput.setAttribute('aria-label', this.t('bottom_placeholder'));
      }

      const heroAttach = document.getElementById('heroAttachBtn');
      if (heroAttach) { heroAttach.title = this.t('attach'); heroAttach.setAttribute('aria-label', this.t('attach')); }
      const bottomAttach = document.getElementById('bottomAttachBtn');
      if (bottomAttach) { bottomAttach.title = this.t('attach'); bottomAttach.setAttribute('aria-label', this.t('attach')); }

      const heroVoice = document.getElementById('heroVoiceBtn');
      if (heroVoice) { heroVoice.title = this.t('voice'); heroVoice.setAttribute('aria-label', this.t('voice')); }
      const bottomVoice = document.getElementById('bottomVoiceBtn');
      if (bottomVoice) { bottomVoice.title = this.t('voice'); bottomVoice.setAttribute('aria-label', this.t('voice')); }

      const heroSend = document.getElementById('heroSendBtn');
      if (heroSend) { heroSend.title = this.t('send'); heroSend.setAttribute('aria-label', this.t('send')); }
      const bottomSend = document.getElementById('bottomSendBtn');
      if (bottomSend) { bottomSend.title = this.t('send'); bottomSend.setAttribute('aria-label', this.t('send')); }

      // 7. Suggestions
      const s1 = document.getElementById('txtSugg1');
      if (s1) s1.textContent = this.t('suggestion_1');
      const s2 = document.getElementById('txtSugg2');
      if (s2) s2.textContent = this.t('suggestion_2');
      const s3 = document.getElementById('txtSugg3');
      if (s3) s3.textContent = this.t('suggestion_3');
      [s1, s2, s3].forEach(item => {
        if (item?.parentElement) item.parentElement.setAttribute('data-query', item.textContent);
      });

      // 8. Footer Note
      const footerNote = document.getElementById('txtFooterNote');
      if (footerNote) footerNote.textContent = this.t('footer_note');

      // 9. Modals
      const histTitle = document.getElementById('txtHistoryModalTitle');
      if (histTitle) histTitle.textContent = this.t('history_title');
      const clearHistBtn = document.getElementById('clearHistoryBtn');
      if (clearHistBtn) clearHistBtn.textContent = this.t('clear_history');

      const infoTitle = document.getElementById('txtInfoModalTitle');
      if (infoTitle) infoTitle.textContent = this.t('info_title');
      const infoModel = document.getElementById('txtInfoModel');
      if (infoModel) infoModel.textContent = this.t('info_model');
      const infoEmb = document.getElementById('txtInfoEmbedding');
      if (infoEmb) infoEmb.textContent = this.t('info_embedding');
      const infoDb = document.getElementById('txtInfoDb');
      if (infoDb) infoDb.textContent = this.t('info_db');
      const infoGmail = document.getElementById('txtInfoGmail');
      if (infoGmail) infoGmail.textContent = this.t('info_gmail');
      const infoOutlook = document.getElementById('txtInfoOutlook');
      if (infoOutlook) infoOutlook.textContent = this.t('info_outlook');
      const infoPriv = document.getElementById('txtInfoPrivacy');
      if (infoPriv) infoPriv.textContent = this.t('info_privacy');
      const infoSess = document.getElementById('txtInfoSession');
      if (infoSess) infoSess.textContent = this.t('info_session');
    }
  };

  // =========================================================================
  // State Management
  // =========================================================================
  const State = {
    user: {
      name: localStorage.getItem('niso_user_name') || 'Emre',
      initials: localStorage.getItem('niso_user_initials') || 'EG'
    },
    sessionId: 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now(),
    conversation: [],
    isLoading: false,
    history: JSON.parse(localStorage.getItem('niso_chat_history') || '[]')
  };

  // DOM Elements
  const DOM = {
    // Sidebar & Navigation
    sidebarRail: document.getElementById('sidebarRail'),
    appShell: document.querySelector('.app'),
    sidebarToggleBtn: document.getElementById('sidebarToggleBtn'),
    sidebarHistoryList: document.getElementById('sidebarHistoryList'),
    newChatBtn: document.getElementById('newChatBtn'),
    attendanceNavBtn: document.getElementById('attendanceNavBtn'),
    documentsNavBtn: document.getElementById('documentsNavBtn'),
    historyBtn: document.getElementById('historyBtn'),
    infoBtn: document.getElementById('infoBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),

    // Documents / OCR View Elements
    documentsViewport: document.getElementById('documentsViewport'),
    docDropZone: document.getElementById('docDropZone'),
    docFileInput: document.getElementById('docFileInput'),
    btnBrowseDoc: document.getElementById('btnBrowseDoc'),
    dropzoneContent: document.getElementById('dropzoneContent'),
    docSelectedFile: document.getElementById('docSelectedFile'),
    selectedFileName: document.getElementById('selectedFileName'),
    selectedFileSize: document.getElementById('selectedFileSize'),
    btnRemoveSelectedFile: document.getElementById('btnRemoveSelectedFile'),
    docCategorySelect: document.getElementById('docCategorySelect'),
    docProjectSelect: document.getElementById('docProjectSelect'),
    btnProcessDocument: document.getElementById('btnProcessDocument'),
    docProgressContainer: document.getElementById('docProgressContainer'),
    docProgressBar: document.getElementById('docProgressBar'),
    docProgressText: document.getElementById('docProgressText'),
    docProgressPercent: document.getElementById('docProgressPercent'),
    btnRefreshDocuments: document.getElementById('btnRefreshDocuments'),
    docSearchInput: document.getElementById('docSearchInput'),
    documentsTableBody: document.getElementById('documentsTableBody'),

    // Attendance View Elements
    attendanceViewport: document.getElementById('attendanceViewport'),
    attendanceDatePicker: document.getElementById('attendanceDatePicker'),
    btnTodayAttendance: document.getElementById('btnTodayAttendance'),
    btnRefreshAttendance: document.getElementById('btnRefreshAttendance'),
    statTotal: document.getElementById('statTotal'),
    statOnTime: document.getElementById('statOnTime'),
    statLate: document.getElementById('statLate'),
    statLeave: document.getElementById('statLeave'),
    statAbsent: document.getElementById('statAbsent'),
    attEmployeeSelect: document.getElementById('attEmployeeSelect'),
    attShiftDisplay: document.getElementById('attShiftDisplay'),
    attGraceDisplay: document.getElementById('attGraceDisplay'),
    attFirstIn: document.getElementById('attFirstIn'),
    attLastOut: document.getElementById('attLastOut'),
    attStatusSelect: document.getElementById('attStatusSelect'),
    attNote: document.getElementById('attNote'),
    attendanceEntryForm: document.getElementById('attendanceEntryForm'),
    btnResetForm: document.getElementById('btnResetForm'),
    formFeedback: document.getElementById('formFeedback'),
    attSearchInput: document.getElementById('attSearchInput'),
    attDeptFilter: document.getElementById('attDeptFilter'),
    attStatusFilter: document.getElementById('attStatusFilter'),
    attendanceTableBody: document.getElementById('attendanceTableBody'),

    // Top Bar
    userNameDisplay: document.getElementById('userNameDisplay'),
    userAvatar: document.getElementById('userAvatar'),
    providerStatusPill: document.getElementById('providerStatusPill'),
    langSwitcher: document.getElementById('langSwitcher'),

    // Viewport & Hero
    chatViewport: document.getElementById('chatViewport'),
    centerHero: document.getElementById('centerHero'),
    conversationStream: document.getElementById('conversationStream'),
    streamLoadingBar: document.getElementById('streamLoadingBar'),
    loadingStepLabel: document.getElementById('loadingStepLabel'),

    // Composers
    heroComposerForm: document.getElementById('heroComposerForm'),
    heroMessageInput: document.getElementById('heroMessageInput'),
    heroSendBtn: document.getElementById('heroSendBtn'),
    heroAttachBtn: document.getElementById('heroAttachBtn'),
    heroVoiceBtn: document.getElementById('heroVoiceBtn'),

    bottomComposerContainer: document.getElementById('bottomComposerContainer'),
    bottomComposerForm: document.getElementById('bottomComposerForm'),
    bottomMessageInput: document.getElementById('bottomMessageInput'),
    bottomSendBtn: document.getElementById('bottomSendBtn'),
    bottomAttachBtn: document.getElementById('bottomAttachBtn'),
    bottomVoiceBtn: document.getElementById('bottomVoiceBtn'),

    // Suggestion Cards
    suggestionsGrid: document.getElementById('suggestionsGrid'),

    // Modals & Inputs
    filePicker: document.getElementById('filePicker'),
    historyModal: document.getElementById('historyModal'),
    historyList: document.getElementById('historyList'),
    closeHistoryBtn: document.getElementById('closeHistoryBtn'),
    clearHistoryBtn: document.getElementById('clearHistoryBtn'),

    infoModal: document.getElementById('infoModal'),
    closeInfoBtn: document.getElementById('closeInfoBtn'),
    sessionInfoDisplay: document.getElementById('sessionInfoDisplay')
  };

  // =========================================================================
  // Helper: Markdown Parser & HTML Sanitizer
  // =========================================================================
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function parseMarkdown(mdText) {
    if (!mdText) return '';
    let html = escapeHtml(mdText);

    // Code blocks with syntax container
    html = html.replace(/```([a-z]*)\n([\s\S]*?)```/gi, '<pre><code>$2</code></pre>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    // Tables
    html = html.replace(/^\|(.+)\|$/gim, (match) => {
      const cells = match.split('|').filter((c, i, a) => i > 0 && i < a.length - 1);
      const isHeaderSep = cells.every(c => /^[\s-:]+$/.test(c));
      if (isHeaderSep) return '<!--sep-->';
      const cellTag = 'td';
      return '<tr>' + cells.map(c => `<${cellTag}>${c.trim()}</${cellTag}>`).join('') + '</tr>';
    });
    html = html.replace(/(<tr>[\s\S]*?<\/tr>)/gim, '<table>$1</table>');
    html = html.replace(/<!--sep-->/g, '');
    // Lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)/gim, '<ul>$1</ul>');
    // Paragraphs / line breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
  }

  // =========================================================================
  // Component 1: UserStatus Component
  // =========================================================================
  const UserStatus = {
    init() {
      if (DOM.userNameDisplay) {
        DOM.userNameDisplay.textContent = State.user.name || 'Emre';
      }
      if (DOM.userAvatar) {
        DOM.userAvatar.textContent = State.user.initials || 'EG';
      }
      if (DOM.sessionInfoDisplay) {
        DOM.sessionInfoDisplay.textContent = State.sessionId;
      }
    }
  };

  // =========================================================================
  // Component 2: ChatWelcome & Layout Manager
  // =========================================================================
  const ChatWelcome = {
    showWelcome() {
      DOM.centerHero.style.display = 'block';
      DOM.conversationStream.style.display = 'none';
      DOM.bottomComposerContainer.style.display = 'none';
      if (DOM.heroMessageInput) {
        DOM.heroMessageInput.focus();
      }
    },
    hideWelcome() {
      DOM.centerHero.style.display = 'none';
      DOM.conversationStream.style.display = 'flex';
      DOM.bottomComposerContainer.style.display = 'block';
      if (DOM.bottomMessageInput) {
        DOM.bottomMessageInput.focus();
      }
    }
  };

  // =========================================================================
  // Component 3: Conversation Stream (Messages, Badges, Citations)
  // =========================================================================
  const ConversationStream = {
    appendUserMessage(text) {
      ChatWelcome.hideWelcome();

      const row = document.createElement('div');
      row.className = 'msg-row user-msg';
      row.innerHTML = `
        <div class="msg-bubble">
          <p>${escapeHtml(text)}</p>
        </div>
      `;
      DOM.conversationStream.appendChild(row);
      this.scrollToBottom();

      State.conversation.push({ role: 'user', text, timestamp: new Date().toISOString() });
    },

    appendAssistantMessage(data) {
      const row = document.createElement('div');
      row.className = 'msg-row assistant-msg';

      let routeClass = 'hr';
      let routeKey = 'route_hr';

      if (data.intent === 'SMALL_TALK') {
        routeClass = 'smalltalk';
        routeKey = 'route_smalltalk';
      } else if (data.intent === 'HELP') {
        routeClass = 'help';
        routeKey = 'route_help';
      } else if (data.intent === 'UNKNOWN') {
        routeClass = 'unknown';
        routeKey = 'route_unknown';
      } else if (data.intent === 'SECURITY_REJECTED') {
        routeClass = 'security';
        routeKey = 'route_security';
      } else if (data.intent === 'ATTENDANCE_SQL') {
        routeClass = 'sql';
        routeKey = 'route_sql';
      } else if (data.intent === 'COMPANY_KNOWLEDGE') {
        routeClass = 'company';
        routeKey = 'route_company';
      } else if (data.intent === 'PROJECT_MAIL') {
        routeClass = 'mail';
        routeKey = 'route_mail';
      } else if (data.intent === 'HYBRID') {
        routeClass = 'hybrid';
        routeKey = 'route_hybrid';
      } else if (data.status === 'ERROR') {
        routeClass = 'error';
        routeKey = 'route_error';
      }

      const routeLabel = I18n.t(routeKey) || data.title || 'Bilgi';
      const contentHtml = parseMarkdown(data.answer || data.user_message || 'Yanıt alınamadı.');
      const auditId = data.audit_id || data.request_id || ('req_' + Date.now().toString(36));
      const isSmallOrHelp = ['SMALL_TALK', 'HELP', 'UNKNOWN', 'SECURITY_REJECTED'].includes(data.intent);

      // Synthetic / Live Test Notice
      let noticeHtml = '';
      if (data.synthetic_notice) {
        noticeHtml = `<div class="synthetic-banner">⚠️ <em>${escapeHtml(data.synthetic_notice)}</em></div>`;
      } else if (data.is_synthetic) {
        noticeHtml = `<div class="synthetic-banner">⚠️ <em>${I18n.t('synthetic_notice')}</em></div>`;
      }

      // Unified Sources Card Rendering
      let sourcesHtml = '';
      if (Array.isArray(data.sources) && data.sources.length > 0 && !isSmallOrHelp) {
        const validSources = data.sources.filter(s => s && typeof s === 'object');
        if (validSources.length > 0) {
          sourcesHtml = `
            <div class="sources-card">
              <div class="sources-title">${I18n.t('sources_title')} (${validSources.length})</div>
              <div class="sources-items">
                ${validSources.map(s => {
                  const mode = (s.data_mode || (s.is_synthetic ? 'DEMO' : 'LIVE_TEST')).toUpperCase();
                  const badgeClass = mode === 'LIVE' ? 'badge-live' : (mode === 'LIVE_TEST' ? 'badge-live-test' : 'badge-demo');
                  const badgeText = mode === 'LIVE' ? I18n.t('badge_live') : (mode === 'LIVE_TEST' ? I18n.t('badge_live_test') : I18n.t('badge_demo'));
                  const title = escapeHtml(s.title || s.subject || 'Başlıksız kaynak');
                  const ref = s.source_id || s.message_id || s.policy_code || '';
                  const metaParts = [];
                  if (s.sender) metaParts.push(s.sender);
                  if (s.received_at) metaParts.push(new Date(s.received_at).toLocaleDateString(I18n.current === 'tr' ? 'tr-TR' : (I18n.current === 'it' ? 'it-IT' : 'en-US')));
                  const metaStr = metaParts.length > 0 ? `(${escapeHtml(metaParts.join(' • '))})` : '';

                  return `
                    <div class="source-row">
                      <span class="source-badge ${badgeClass}">[${badgeText}]</span>
                      <strong class="source-name">${title}</strong>
                      ${ref ? `<code class="source-code">${escapeHtml(String(ref).substring(0, 18))}</code>` : ''}
                      ${metaStr ? `<span class="source-meta">${metaStr}</span>` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `;
        }
      }

      // Empirical F1-Score Confidence Badge
      let confidenceHtml = '';
      const f1Percent = typeof data.f1_percent === 'number'
        ? data.f1_percent
        : (typeof data.intent_confidence === 'number'
            ? Math.min(100, Math.max(0, Math.round(data.intent_confidence <= 1.0 ? data.intent_confidence * 100 : data.intent_confidence)))
            : (typeof data.confidence === 'number' ? Math.min(100, Math.max(0, Math.round(data.confidence * 100))) : null));

      if (f1Percent !== null && !isNaN(f1Percent)) {
        const confTier = f1Percent >= 85 ? 'high' : (f1Percent >= 70 ? 'medium' : 'low');
        const f1Details = data.f1_details || {};
        const pStr = typeof f1Details.precision === 'number' ? ` | Hassasiyet (P): %${Math.round(f1Details.precision * 100)}` : '';
        const rStr = typeof f1Details.recall === 'number' ? ` | Duyarlılık (R): %${Math.round(f1Details.recall * 100)}` : '';
        const f1Tooltip = `F1-Score: %${f1Percent}${pStr}${rStr} (Ground Truth Benchmark ile hesaplanmıştır)`;
        const confText = I18n.current === 'tr'
          ? `%${f1Percent} F1 Güven`
          : (I18n.current === 'it' ? `${f1Percent}% F1 Confidenza` : `${f1Percent}% F1 Confidence`);
        confidenceHtml = `
          <span class="confidence-badge ${confTier}" title="${escapeHtml(f1Tooltip)}">
            <span class="confidence-dot" aria-hidden="true"></span>
            <span>${confText}</span>
          </span>
        `;
      }

      // LLM as a Judge Evaluation Badge
      let judgeHtml = '';
      if (data.judge_evaluation) {
        const j = data.judge_evaluation;
        const jScore = typeof j.score === 'number' ? j.score : 95;
        const jVerdict = (j.verdict || 'PASS').toUpperCase();
        const jTier = jVerdict === 'FAIL' ? 'fail' : (jVerdict === 'WARNING' ? 'warning' : 'pass');
        const jIcon = jVerdict === 'FAIL' ? '⚠️' : (jVerdict === 'WARNING' ? '🔍' : '🛡️');
        const jTitle = escapeHtml(j.critique || (I18n.current === 'tr' ? 'Hakem değerlendirmesi yapıldı.' : 'Judge evaluation completed.'));
        
        let jText = '';
        if (I18n.current === 'tr') {
          jText = `Hakem: %${jScore}`;
        } else if (I18n.current === 'it') {
          jText = `Giudice: ${jScore}%`;
        } else {
          jText = `Judge: ${jScore}%`;
        }

        judgeHtml = `
          <span class="judge-badge ${jTier}" title="${jTitle} (${jVerdict})">
            <span class="judge-icon" aria-hidden="true">${jIcon}</span>
            <span>${jText}</span>
          </span>
        `;
      }

      row.innerHTML = `
        <div class="msg-bubble">
          <div class="msg-header-badges">
            <span class="route-badge ${routeClass}">${routeLabel}</span>
            <div style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
              ${confidenceHtml}
              ${judgeHtml}
            </div>
          </div>
          <div class="msg-content">${contentHtml}${noticeHtml}${sourcesHtml}</div>
          <div class="msg-actions">
            ${!isSmallOrHelp ? `<span>Ref: <code>${auditId.substring(0, 8)}</code></span>` : '<span></span>'}
            <button class="action-btn copy-btn" title="${I18n.t('copy')}" aria-label="${I18n.t('copy')}">
              <span class="copy-icon" aria-hidden="true"></span>
              <span class="copy-label">${I18n.t('copy')}</span>
            </button>
          </div>
        </div>
      `;

      // Copy Handler
      const copyBtn = row.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(data.answer || data.user_message || '');
        const copyLabel = copyBtn.querySelector('.copy-label');
        copyLabel.textContent = I18n.t('copied');
        setTimeout(() => { copyLabel.textContent = I18n.t('copy'); }, 2000);
      });

      DOM.conversationStream.appendChild(row);
      this.scrollToBottom();

      State.conversation.push({ role: 'assistant', data, timestamp: new Date().toISOString() });
      HistoryManager.saveCurrentSession();
    },

    scrollToBottom() {
      if (!DOM.chatViewport) return;
      requestAnimationFrame(() => {
        DOM.chatViewport.scrollTo({
          top: DOM.chatViewport.scrollHeight,
          behavior: 'smooth'
        });
      });
    },

    clearMessages() {
      DOM.conversationStream.innerHTML = '';
      State.conversation = [];
      State.sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
      UserStatus.init();
      ChatWelcome.showWelcome();
    }
  };

  // =========================================================================
  // Component 3B: Voice Conversation (Low-latency Browser STT + TTS)
  // =========================================================================
  const VoiceConversation = {
    recognition: null,
    active: false,
    listening: false,
    speaking: false,
    activeTextarea: null,
    activeButton: null,
    currentAudio: null,
    currentAudioUrl: null,
    restartTimer: null,

    get SpeechRecognition() {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    },

    getLangCode(lang = I18n.current) {
      const langMap = { tr: 'tr-TR', en: 'en-US', it: 'it-IT' };
      return langMap[lang] || langMap.tr;
    },

    isSupported() {
      return !!this.SpeechRecognition && 'speechSynthesis' in window;
    },

    toggle(textarea, button) {
      if (this.active && this.activeButton === button) {
        this.stop();
        return;
      }

      if (!this.isSupported()) {
        this.showStatus(textarea, I18n.t('voice_unsupported'), true);
        return;
      }

      this.stop();
      this.active = true;
      this.activeTextarea = textarea;
      this.activeButton = button;
      this.updateButtonState('listening');
      this.startListening();
    },

    startListening() {
      if (!this.active || State.isLoading || this.speaking || this.listening) return;

      const Recognition = this.SpeechRecognition;
      this.recognition = new Recognition();
      this.recognition.lang = this.getLangCode();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;
      this.listening = true;
      this.updateButtonState('listening');
      this.showStatus(this.activeTextarea, I18n.t('voice_listening'));

      let finalTranscript = '';
      let lastInterim = '';

      this.recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript.trim();
          if (event.results[i].isFinal) {
            finalTranscript += (finalTranscript ? ' ' : '') + transcript;
          } else {
            interim += (interim ? ' ' : '') + transcript;
          }
        }

        lastInterim = interim;
        if (this.activeTextarea) {
          this.activeTextarea.value = finalTranscript || lastInterim;
          this.activeTextarea.dispatchEvent(new Event('input'));
        }
      };

      this.recognition.onerror = () => {
        this.listening = false;
        this.updateButtonState(this.active ? 'idle' : null);
      };

      this.recognition.onend = () => {
        this.listening = false;
        if (!this.active) {
          this.updateButtonState(null);
          return;
        }

        const transcript = (finalTranscript || lastInterim || '').trim();
        if (transcript && this.activeTextarea) {
          this.activeTextarea.value = transcript;
          this.activeTextarea.dispatchEvent(new Event('input'));
          this.showStatus(this.activeTextarea, I18n.t('voice_processing'));
          ChatInput.submitQuery(this.activeTextarea, { fromVoice: true });
        } else if (!State.isLoading && !this.speaking) {
          this.restartTimer = setTimeout(() => this.startListening(), 350);
        }
      };

      try {
        this.recognition.start();
      } catch (err) {
        this.listening = false;
      }
    },

    stopListening() {
      clearTimeout(this.restartTimer);
      if (this.recognition) {
        try { this.recognition.stop(); } catch (err) {}
        this.recognition = null;
      }
      this.listening = false;
    },

    async speakAnswer(data) {
      if (!this.active) return;

      const answer = this.toSpeechText(data.answer || data.user_message || '');
      if (!answer) {
        this.resumeAfterAnswer();
        return;
      }

      this.stopListening();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      const responseLang = data.response_language || I18n.current;
      this.speaking = true;
      this.updateButtonState('speaking');
      this.showStatus(this.activeTextarea, I18n.t('voice_speaking'));

      const customPlayed = await this.playCustomTts(answer, responseLang);
      if (customPlayed) return;

      if (!('speechSynthesis' in window)) {
        this.speaking = false;
        this.resumeAfterAnswer();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.lang = this.getLangCode(responseLang);
      utterance.rate = responseLang === 'it' ? 0.98 : 1.02;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voice = this.pickVoice(utterance.lang);
      if (voice) utterance.voice = voice;

      utterance.onstart = () => {
        this.speaking = true;
        this.updateButtonState('speaking');
        this.showStatus(this.activeTextarea, I18n.t('voice_speaking'));
      };

      utterance.onend = () => {
        this.speaking = false;
        this.resumeAfterAnswer();
      };

      utterance.onerror = () => {
        this.speaking = false;
        this.resumeAfterAnswer();
      };

      window.speechSynthesis.speak(utterance);
    },

    async playCustomTts(text, lang) {
      try {
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, lang })
        });

        if (!response.ok || !(response.headers.get('Content-Type') || '').includes('audio/')) {
          return false;
        }

        const blob = await response.blob();
        this.releaseAudioUrl();
        this.currentAudioUrl = URL.createObjectURL(blob);
        const audio = new Audio(this.currentAudioUrl);
        this.currentAudio = audio;

        audio.onended = () => {
          this.speaking = false;
          this.releaseAudioUrl();
          this.resumeAfterAnswer();
        };

        audio.onerror = () => {
          this.speaking = false;
          this.releaseAudioUrl();
          this.resumeAfterAnswer();
        };

        await audio.play();
        return true;
      } catch (err) {
        this.releaseAudioUrl();
        return false;
      }
    },

    releaseAudioUrl() {
      if (this.currentAudio) {
        try {
          this.currentAudio.pause();
          this.currentAudio.src = '';
        } catch (err) {}
        this.currentAudio = null;
      }
      if (this.currentAudioUrl) {
        URL.revokeObjectURL(this.currentAudioUrl);
        this.currentAudioUrl = null;
      }
    },

    pickVoice(langCode) {
      const voices = window.speechSynthesis.getVoices() || [];
      const exact = voices.find(v => v.lang && v.lang.toLowerCase() === langCode.toLowerCase());
      if (exact) return exact;
      const prefix = langCode.split('-')[0].toLowerCase();
      return voices.find(v => v.lang && v.lang.toLowerCase().startsWith(prefix)) || null;
    },

    resumeAfterAnswer() {
      if (!this.active) return;
      this.updateButtonState('listening');
      this.restartTimer = setTimeout(() => this.startListening(), 450);
    },

    stop() {
      this.active = false;
      this.stopListening();
      this.releaseAudioUrl();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.speaking = false;
      this.showStatus(this.activeTextarea, '');
      this.updateButtonState(null);
      this.activeTextarea = null;
      this.activeButton = null;
    },

    updateButtonState(state) {
      const buttons = [DOM.heroVoiceBtn, DOM.bottomVoiceBtn].filter(Boolean);
      buttons.forEach(btn => {
        btn.classList.remove('voice-active', 'voice-listening', 'voice-speaking');
        btn.setAttribute('aria-pressed', 'false');
      });

      if (!this.activeButton || !state) return;

      this.activeButton.classList.add('voice-active');
      this.activeButton.setAttribute('aria-pressed', 'true');
      if (state === 'listening') this.activeButton.classList.add('voice-listening');
      if (state === 'speaking') this.activeButton.classList.add('voice-speaking');
    },

    showStatus(textarea, text, isError = false) {
      if (!textarea) return;
      const form = textarea.closest('.composer');
      if (!form) return;
      let status = form.querySelector('.voice-status');
      if (!status) {
        status = document.createElement('span');
        status.className = 'voice-status';
        form.appendChild(status);
      }
      status.textContent = text || '';
      status.classList.toggle('error', !!isError);
      status.style.display = text ? 'inline-flex' : 'none';
    },

    toSpeechText(markdown) {
      return String(markdown || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
        .replace(/[#>*_~|]/g, ' ')
        .replace(/\n{2,}/g, '. ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1800);
    }
  };

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
  }

  // =========================================================================
  // Component 4: ChatInput (Auto-Grow, Send, Attachments, Voice)
  // =========================================================================
  const ChatInput = {
    init() {
      this.bindComposer(DOM.heroComposerForm, DOM.heroMessageInput, DOM.heroSendBtn, DOM.heroAttachBtn, DOM.heroVoiceBtn);
      this.bindComposer(DOM.bottomComposerForm, DOM.bottomMessageInput, DOM.bottomSendBtn, DOM.bottomAttachBtn, DOM.bottomVoiceBtn);

      // File picker handler
      if (DOM.filePicker) {
        DOM.filePicker.addEventListener('change', (e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            const fileNames = Array.from(files).map(f => f.name).join(', ');
            const currentInput = DOM.bottomComposerContainer.style.display !== 'none' ? DOM.bottomMessageInput : DOM.heroMessageInput;
            currentInput.value = `[${I18n.t('attach')}: ${fileNames}] ` + currentInput.value;
            currentInput.focus();
          }
        });
      }
    },

    bindComposer(form, textarea, sendBtn, attachBtn, voiceBtn) {
      if (!form || !textarea) return;

      // Auto-grow textarea
      textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 130) + 'px';
      });

      // Enter to send, Shift+Enter for newline
      textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.submitQuery(textarea);
        }
      });

      // Submit form
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitQuery(textarea);
      });

      // Attach button
      if (attachBtn) {
        attachBtn.addEventListener('click', () => {
          DOM.filePicker.click();
        });
      }

      // Voice conversation button (STT + TTS loop with graceful fallback)
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          VoiceConversation.toggle(textarea, voiceBtn);
        });
      }
    },

    async submitQuery(textarea, options = {}) {
      const text = textarea.value.trim();
      if (!text || State.isLoading) return;

      textarea.value = '';
      textarea.style.height = 'auto';

      ConversationStream.appendUserMessage(text);
      await this.executeChatRequest(text, options);
    },

    async executeChatRequest(text, options = {}) {
      State.isLoading = true;
      this.setInputsDisabled(true);
      DOM.streamLoadingBar.style.display = 'flex';

      // Step notifications
      DOM.loadingStepLabel.textContent = I18n.t('step_1');
      const stepTimer1 = setTimeout(() => { DOM.loadingStepLabel.textContent = I18n.t('step_2'); }, 300);
      const stepTimer2 = setTimeout(() => { DOM.loadingStepLabel.textContent = I18n.t('step_3'); }, 600);

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            session_id: State.sessionId
          })
        });

        const data = await response.json();
        ConversationStream.appendAssistantMessage(data);
        if (options.fromVoice) VoiceConversation.speakAnswer(data);
      } catch (err) {
        const errorData = {
          status: 'ERROR',
          intent: 'UNKNOWN',
          user_message: 'Sunucuya bağlanırken bir hata oluştu. Lütfen yerel servislerin aktif olduğunu kontrol edin.'
        };
        ConversationStream.appendAssistantMessage(errorData);
        if (options.fromVoice) VoiceConversation.speakAnswer(errorData);
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        DOM.streamLoadingBar.style.display = 'none';
        State.isLoading = false;
        this.setInputsDisabled(false);
        this.focusActiveInput();
      }
    },

    focusActiveInput() {
      const activeInput = DOM.centerHero.style.display === 'none'
        ? DOM.bottomMessageInput
        : DOM.heroMessageInput;

      if (!activeInput || activeInput.disabled) return;
      requestAnimationFrame(() => activeInput.focus({ preventScroll: true }));
    },

    setInputsDisabled(disabled) {
      if (DOM.heroMessageInput) DOM.heroMessageInput.disabled = disabled;
      if (DOM.heroSendBtn) DOM.heroSendBtn.disabled = disabled;
      if (DOM.bottomMessageInput) DOM.bottomMessageInput.disabled = disabled;
      if (DOM.bottomSendBtn) DOM.bottomSendBtn.disabled = disabled;
    }
  };

  // =========================================================================
  // Component 5: SuggestionCards Component
  // =========================================================================
  const SuggestionCards = {
    init() {
      if (!DOM.suggestionsGrid) return;
      DOM.suggestionsGrid.querySelectorAll('.suggestion-card').forEach(btn => {
        btn.addEventListener('click', () => {
          const query = btn.getAttribute('data-query');
          if (query) {
            ConversationStream.appendUserMessage(query);
            ChatInput.executeChatRequest(query);
          }
        });
      });
    }
  };

  // =========================================================================
  // Component 6: Sidebar & Navigation Handlers
  // =========================================================================
  const Sidebar = {
    setExpanded(expanded) {
      if (!DOM.sidebarRail) return;
      DOM.sidebarRail.classList.toggle('expanded', expanded);
      if (DOM.appShell) DOM.appShell.classList.toggle('sidebar-expanded', expanded);
      if (DOM.sidebarToggleBtn) {
        DOM.sidebarToggleBtn.setAttribute('aria-expanded', String(expanded));
        const label = I18n.t(expanded ? 'sidebar_close' : 'sidebar_open');
        DOM.sidebarToggleBtn.setAttribute('aria-label', label);
        DOM.sidebarToggleBtn.title = label;
      }
      localStorage.setItem('niso_sidebar_expanded', String(expanded));
      if (expanded) HistoryManager.renderHistoryList();
    },

    init() {
      const initiallyExpanded = localStorage.getItem('niso_sidebar_expanded') === 'true';
      this.setExpanded(initiallyExpanded);

      // Language Switcher Click
      if (DOM.langSwitcher) {
        DOM.langSwitcher.querySelectorAll('.lang-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const lang = btn.getAttribute('data-lang');
            I18n.setLanguage(lang);
          });
        });
      }

      // New Chat
      if (DOM.newChatBtn) {
        DOM.newChatBtn.addEventListener('click', () => {
          ConversationStream.clearMessages();
          if (window.innerWidth <= 860) DOM.sidebarRail?.classList.remove('open');
        });
      }

      if (DOM.sidebarToggleBtn) {
        DOM.sidebarToggleBtn.addEventListener('click', () => {
          if (window.innerWidth <= 860 && DOM.sidebarRail.classList.contains('open')) {
            DOM.sidebarRail.classList.remove('open');
            return;
          }
          this.setExpanded(!DOM.sidebarRail.classList.contains('expanded'));
        });
      }

      // Mobile Menu Toggle
      if (DOM.mobileMenuBtn && DOM.sidebarRail) {
        DOM.mobileMenuBtn.addEventListener('click', () => {
          DOM.sidebarRail.classList.toggle('open');
          if (DOM.sidebarRail.classList.contains('open')) this.setExpanded(true);
        });
      }

      // History area inside the expanded sidebar
      if (DOM.historyBtn) {
        DOM.historyBtn.addEventListener('click', () => {
          this.setExpanded(true);
          HistoryManager.renderHistoryList();
        });
      }
      if (DOM.closeHistoryBtn) {
        DOM.closeHistoryBtn.addEventListener('click', () => {
          DOM.historyModal.style.display = 'none';
        });
      }
      if (DOM.clearHistoryBtn) {
        DOM.clearHistoryBtn.addEventListener('click', () => {
          HistoryManager.clearAllHistory();
        });
      }

      // Info Modal
      if (DOM.infoBtn && DOM.infoModal) {
        DOM.infoBtn.addEventListener('click', () => {
          DOM.infoModal.style.display = 'grid';
        });
      }
      if (DOM.closeInfoBtn) {
        DOM.closeInfoBtn.addEventListener('click', () => {
          DOM.infoModal.style.display = 'none';
        });
      }

      // Close modals on backdrop click
      window.addEventListener('click', (e) => {
        if (e.target === DOM.historyModal) DOM.historyModal.style.display = 'none';
        if (e.target === DOM.infoModal) DOM.infoModal.style.display = 'none';
      });
    }
  };

  // =========================================================================
  // Component 7: History Manager (Persistence)
  // =========================================================================
  const HistoryManager = {
    saveCurrentSession() {
      if (State.conversation.length === 0) return;
      const firstUserMsg = State.conversation.find(m => m.role === 'user');
      const title = firstUserMsg ? firstUserMsg.text : I18n.t('new_chat');

      const existingIndex = State.history.findIndex(h => h.sessionId === State.sessionId);
      const sessionData = {
        sessionId: State.sessionId,
        title: title.length > 50 ? title.substring(0, 48) + '...' : title,
        timestamp: new Date().toLocaleTimeString(I18n.current === 'tr' ? 'tr-TR' : (I18n.current === 'it' ? 'it-IT' : 'en-US'), { hour: '2-digit', minute: '2-digit' }),
        conversation: State.conversation
      };

      if (existingIndex >= 0) {
        State.history[existingIndex] = sessionData;
      } else {
        State.history.unshift(sessionData);
      }

      localStorage.setItem('niso_chat_history', JSON.stringify(State.history.slice(0, 30)));
      this.renderHistoryList();
    },

    renderHistoryList() {
      const targets = [DOM.historyList, DOM.sidebarHistoryList].filter(Boolean);
      if (targets.length === 0) return;
      targets.forEach(target => { target.innerHTML = ''; });

      if (State.history.length === 0) {
        targets.forEach(target => {
          target.innerHTML = `<p class="sidebar-history-empty">${I18n.t('no_history')}</p>`;
        });
        return;
      }

      targets.forEach(target => State.history.forEach((h) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-item-q">${escapeHtml(h.title)}</div>
          <div class="history-item-time">${h.timestamp} • ${h.conversation.length} ${I18n.current === 'tr' ? 'mesaj' : (I18n.current === 'it' ? 'messaggi' : 'messages')}</div>
        `;
        item.addEventListener('click', () => {
          DOM.historyModal.style.display = 'none';
          this.restoreSession(h);
          if (window.innerWidth <= 860) DOM.sidebarRail?.classList.remove('open');
        });
        target.appendChild(item);
      }));
    },

    restoreSession(sessionData) {
      DOM.conversationStream.innerHTML = '';
      State.conversation = [];
      State.sessionId = sessionData.sessionId;
      UserStatus.init();
      ChatWelcome.hideWelcome();

      sessionData.conversation.forEach(m => {
        if (m.role === 'user') {
          const row = document.createElement('div');
          row.className = 'msg-row user-msg';
          row.innerHTML = `<div class="msg-bubble"><p>${escapeHtml(m.text)}</p></div>`;
          DOM.conversationStream.appendChild(row);
        } else if (m.role === 'assistant') {
          ConversationStream.appendAssistantMessage(m.data);
        }
      });

      ConversationStream.scrollToBottom();
    },

    clearAllHistory() {
      State.history = [];
      localStorage.removeItem('niso_chat_history');
      this.renderHistoryList();
    }
  };

  // =========================================================================
  // Component: AttendanceManager
  // =========================================================================
  const AttendanceManager = {
    employees: [],
    currentRecords: [],
    selectedDate: new Date().toISOString().slice(0, 10),

    init() {
      if (!DOM.attendanceViewport) return;
      this.selectedDate = DOM.attendanceDatePicker?.value || new Date().toISOString().slice(0, 10);
      this.bindEvents();
      this.loadEmployees();
    },

    bindEvents() {
      // Tab Switching
      DOM.attendanceNavBtn?.addEventListener('click', () => {
        this.showAttendanceView();
      });

      DOM.newChatBtn?.addEventListener('click', () => {
        this.showChatView();
      });

      // Date changes
      DOM.attendanceDatePicker?.addEventListener('change', (e) => {
        this.selectedDate = e.target.value;
        this.loadDailyRecords();
      });

      DOM.btnTodayAttendance?.addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
        if (DOM.attendanceDatePicker) DOM.attendanceDatePicker.value = today;
        this.selectedDate = today;
        this.loadDailyRecords();
      });

      DOM.btnRefreshAttendance?.addEventListener('click', () => {
        this.loadDailyRecords();
      });

      // Employee select changes -> update shift info
      DOM.attEmployeeSelect?.addEventListener('change', (e) => {
        const empNo = e.target.value;
        const emp = this.employees.find(x => x.employee_no === empNo);
        if (emp) {
          if (DOM.attShiftDisplay) DOM.attShiftDisplay.value = `${emp.shift_name} (${(emp.shift_start || '').slice(0, 5)} - ${(emp.shift_end || '').slice(0, 5)})`;
          if (DOM.attGraceDisplay) DOM.attGraceDisplay.value = `${emp.grace_minutes} dk tolerans`;
          
          const existing = this.currentRecords.find(r => r.employee_no === empNo);
          if (existing) {
            if (DOM.attFirstIn) DOM.attFirstIn.value = existing.first_in_time || '';
            if (DOM.attLastOut) DOM.attLastOut.value = existing.last_out_time || '';
            if (DOM.attStatusSelect) DOM.attStatusSelect.value = existing.status || 'AUTO';
            if (DOM.attNote) DOM.attNote.value = existing.exception_types || '';
          } else {
            if (DOM.attFirstIn) DOM.attFirstIn.value = '';
            if (DOM.attLastOut) DOM.attLastOut.value = '';
            if (DOM.attStatusSelect) DOM.attStatusSelect.value = 'AUTO';
            if (DOM.attNote) DOM.attNote.value = '';
          }
        }
      });

      // Form Submit
      DOM.attendanceEntryForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.saveAttendance();
      });

      DOM.btnResetForm?.addEventListener('click', () => {
        DOM.attendanceEntryForm?.reset();
        this.hideFeedback();
        document.querySelectorAll('.att-table tr').forEach(r => r.classList.remove('row-selected'));
      });

      // Table Filters
      DOM.attSearchInput?.addEventListener('input', () => this.renderTable());
      DOM.attDeptFilter?.addEventListener('change', () => this.renderTable());
      DOM.attStatusFilter?.addEventListener('change', () => this.renderTable());
    },

    showAttendanceView() {
      if (DOM.chatViewport) DOM.chatViewport.style.display = 'none';
      if (DOM.bottomComposerContainer) DOM.bottomComposerContainer.style.display = 'none';
      if (DOM.streamLoadingBar) DOM.streamLoadingBar.style.display = 'none';
      if (DOM.documentsViewport) DOM.documentsViewport.style.display = 'none';
      if (DOM.attendanceViewport) DOM.attendanceViewport.style.display = 'flex';

      DOM.newChatBtn?.classList.remove('active');
      DOM.documentsNavBtn?.classList.remove('active');
      DOM.attendanceNavBtn?.classList.add('active');

      this.loadDailyRecords();
      if (window.innerWidth <= 860) DOM.sidebarRail?.classList.remove('open');
    },

    showChatView() {
      if (DOM.attendanceViewport) DOM.attendanceViewport.style.display = 'none';
      if (DOM.documentsViewport) DOM.documentsViewport.style.display = 'none';
      if (DOM.chatViewport) DOM.chatViewport.style.display = 'flex';
      if (State.conversation.length > 0 && DOM.bottomComposerContainer) {
        DOM.bottomComposerContainer.style.display = 'block';
      }

      DOM.attendanceNavBtn?.classList.remove('active');
      DOM.documentsNavBtn?.classList.remove('active');
      DOM.newChatBtn?.classList.add('active');
    },

    async loadEmployees() {
      try {
        const res = await fetch('/api/attendance/employees');
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.employees)) {
          this.employees = data.employees;
          if (DOM.attEmployeeSelect) {
            DOM.attEmployeeSelect.innerHTML = '<option value="">-- Çalışan Seçiniz --</option>' +
              this.employees.map(emp => `<option value="${emp.employee_no}">${emp.employee_no} - ${emp.full_name} (${emp.department})</option>`).join('');
          }
        }
      } catch (err) {
        console.error('Error loading employees:', err);
      }
    },

    async loadDailyRecords() {
      if (!DOM.attendanceTableBody) return;
      DOM.attendanceTableBody.innerHTML = '<tr><td colspan="8" class="text-center">Kayıtlar yükleniyor...</td></tr>';
      try {
        const res = await fetch(`/api/attendance?day=${encodeURIComponent(this.selectedDate)}`);
        const data = await res.json();
        if (data.status === 'OK') {
          this.currentRecords = data.records || [];
          this.updateStats(data.stats);
          this.renderTable();
        } else {
          DOM.attendanceTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#b42318">${data.message || 'Kayıtlar yüklenemedi.'}</td></tr>`;
        }
      } catch (err) {
        console.error('Error loading attendance records:', err);
        DOM.attendanceTableBody.innerHTML = `<tr><td colspan="8" class="text-center" style="color:#b42318">Hata: ${err.message}</td></tr>`;
      }
    },

    updateStats(stats) {
      if (!stats) return;
      if (DOM.statTotal) DOM.statTotal.textContent = stats.total ?? 0;
      if (DOM.statOnTime) DOM.statOnTime.textContent = stats.on_time ?? 0;
      if (DOM.statLate) DOM.statLate.textContent = stats.late ?? 0;
      if (DOM.statLeave) DOM.statLeave.textContent = (stats.on_leave || 0) + (stats.remote || 0);
      if (DOM.statAbsent) DOM.statAbsent.textContent = stats.absent ?? 0;
    },

    renderTable() {
      if (!DOM.attendanceTableBody) return;
      const search = (DOM.attSearchInput?.value || '').toLowerCase().trim();
      const dept = DOM.attDeptFilter?.value || '';
      const status = DOM.attStatusFilter?.value || '';

      const filtered = this.currentRecords.filter(r => {
        if (search && !r.full_name?.toLowerCase().includes(search) && !r.employee_no?.toLowerCase().includes(search)) return false;
        if (dept && r.department !== dept) return false;
        if (status && r.status !== status) return false;
        return true;
      });

      if (filtered.length === 0) {
        DOM.attendanceTableBody.innerHTML = '<tr><td colspan="8" class="text-center" style="color:#64748b; padding:24px;">Kriterlere uygun kayıt bulunamadı.</td></tr>';
        return;
      }

      DOM.attendanceTableBody.innerHTML = filtered.map(r => {
        const statusBadge = this.getStatusBadge(r.status);
        const lateDetail = (r.late_minutes && r.late_minutes > 0) ? `<strong>${r.late_minutes} dk</strong>` : '-';
        const inTime = r.first_in_time || '<span style="color:#94a3b8">Giriş yok</span>';
        const outTime = r.last_out_time || '<span style="color:#94a3b8">-</span>';

        return `
          <tr data-emp="${r.employee_no}">
            <td><code>${r.employee_no}</code></td>
            <td><strong>${r.full_name}</strong></td>
            <td>${r.department || '-'}</td>
            <td>${inTime}</td>
            <td>${outTime}</td>
            <td>${lateDetail}</td>
            <td>${statusBadge}</td>
            <td>
              <button type="button" class="btn-edit-row" onclick="window.editAttendanceRow('${r.employee_no}')">
                Düzenle
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    getStatusBadge(status) {
      switch (status) {
        case 'ON_TIME': return '<span class="badge-status on-time">Zamanında</span>';
        case 'LATE': return '<span class="badge-status late">Geç Kaldı</span>';
        case 'ON_LEAVE': return '<span class="badge-status leave">İzinli</span>';
        case 'REMOTE': return '<span class="badge-status remote">Uzaktan</span>';
        case 'ABSENT': return '<span class="badge-status absent">Gelmedi</span>';
        case 'HOLIDAY': return '<span class="badge-status leave">Tatil</span>';
        case 'WEEKEND': return '<span class="badge-status leave">Hafta Sonu</span>';
        default: return `<span class="badge-status">${status || '-'}</span>`;
      }
    },

    editRow(empNo) {
      if (DOM.attEmployeeSelect) {
        DOM.attEmployeeSelect.value = empNo;
        DOM.attEmployeeSelect.dispatchEvent(new Event('change'));
      }
      document.querySelectorAll('.att-table tr').forEach(r => {
        if (r.getAttribute('data-emp') === empNo) r.classList.add('row-selected');
        else r.classList.remove('row-selected');
      });
      DOM.attFirstIn?.focus();
    },

    async saveAttendance() {
      const empNo = DOM.attEmployeeSelect?.value;
      if (!empNo) {
        this.showFeedback('Lütfen bir çalışan seçiniz.', 'error');
        return;
      }

      const payload = {
        day: this.selectedDate,
        employee_no: empNo,
        first_in: DOM.attFirstIn?.value || '',
        last_out: DOM.attLastOut?.value || '',
        status: DOM.attStatusSelect?.value || 'AUTO',
        note: DOM.attNote?.value || ''
      };

      const btn = document.getElementById('btnSaveAttendance');
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Kaydediliyor...';
      }

      try {
        const res = await fetch('/api/attendance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.status === 'OK') {
          this.showFeedback(data.message || 'Kayıt başarıyla veritabanına işlendi. Yapay zekâ artık bu veriyi kullanacak.', 'success');
          await this.loadDailyRecords();
        } else {
          this.showFeedback(data.message || 'Kayıt başarısız oldu.', 'error');
        }
      } catch (err) {
        this.showFeedback('İletişim hatası: ' + err.message, 'error');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Veritabanına Kaydet';
        }
      }
    },

    showFeedback(msg, type = 'success') {
      if (!DOM.formFeedback) return;
      DOM.formFeedback.className = `form-feedback ${type}`;
      DOM.formFeedback.textContent = msg;
      DOM.formFeedback.style.display = 'block';
    },

    hideFeedback() {
      if (DOM.formFeedback) DOM.formFeedback.style.display = 'none';
    }
  };

  window.editAttendanceRow = (empNo) => AttendanceManager.editRow(empNo);

  // =========================================================================
  // Component: DocumentsManager (OCR & Document Knowledge Base)
  // =========================================================================
  const DocumentsManager = {
    selectedFile: null,
    documentsList: [],

    init() {
      if (!DOM.documentsViewport) return;
      this.bindEvents();
      this.loadDocuments();
    },

    bindEvents() {
      // Sidebar tab navigation
      DOM.documentsNavBtn?.addEventListener('click', () => {
        this.showDocumentsView();
      });

      // Browse triggers hidden input
      DOM.btnBrowseDoc?.addEventListener('click', (e) => {
        e.stopPropagation();
        DOM.docFileInput?.click();
      });

      DOM.docDropZone?.addEventListener('click', (e) => {
        if (e.target.closest('#btnRemoveSelectedFile') || this.selectedFile) return;
        DOM.docFileInput?.click();
      });

      DOM.docFileInput?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleFileSelected(e.target.files[0]);
        }
      });

      // Drag & drop support
      ['dragenter', 'dragover'].forEach(eventName => {
        DOM.docDropZone?.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          DOM.docDropZone.classList.add('drag-over');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        DOM.docDropZone?.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          DOM.docDropZone.classList.remove('drag-over');
        });
      });

      DOM.docDropZone?.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) {
          this.handleFileSelected(dt.files[0]);
        }
      });

      // Remove selected file
      DOM.btnRemoveSelectedFile?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.clearSelectedFile();
      });

      // Process and Ingest button
      DOM.btnProcessDocument?.addEventListener('click', async () => {
        await this.processAndUpload();
      });

      // Refresh list
      DOM.btnRefreshDocuments?.addEventListener('click', () => {
        this.loadDocuments();
      });

      // Search filter
      DOM.docSearchInput?.addEventListener('input', () => {
        this.renderTable();
      });
    },

    handleFileSelected(file) {
      const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg'];
      const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
      if (!allowedExts.includes(ext)) {
        alert('Lütfen geçerli bir PDF, PNG veya JPG dosyası seçin.');
        return;
      }

      if (file.size > 25 * 1024 * 1024) {
        alert('Dosya boyutu 25 MB sınırını aşıyor.');
        return;
      }

      this.selectedFile = file;
      if (DOM.selectedFileName) DOM.selectedFileName.textContent = file.name;
      if (DOM.selectedFileSize) DOM.selectedFileSize.textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
      if (DOM.dropzoneContent) DOM.dropzoneContent.style.display = 'none';
      if (DOM.docSelectedFile) DOM.docSelectedFile.style.display = 'flex';
      if (DOM.btnProcessDocument) DOM.btnProcessDocument.disabled = false;
    },

    clearSelectedFile() {
      this.selectedFile = null;
      if (DOM.docFileInput) DOM.docFileInput.value = '';
      if (DOM.dropzoneContent) DOM.dropzoneContent.style.display = 'flex';
      if (DOM.docSelectedFile) DOM.docSelectedFile.style.display = 'none';
      if (DOM.btnProcessDocument) DOM.btnProcessDocument.disabled = true;
    },

    showDocumentsView() {
      if (DOM.chatViewport) DOM.chatViewport.style.display = 'none';
      if (DOM.bottomComposerContainer) DOM.bottomComposerContainer.style.display = 'none';
      if (DOM.streamLoadingBar) DOM.streamLoadingBar.style.display = 'none';
      if (DOM.attendanceViewport) DOM.attendanceViewport.style.display = 'none';
      if (DOM.documentsViewport) DOM.documentsViewport.style.display = 'flex';

      DOM.newChatBtn?.classList.remove('active');
      DOM.attendanceNavBtn?.classList.remove('active');
      DOM.documentsNavBtn?.classList.add('active');

      this.loadDocuments();
      if (window.innerWidth <= 860) DOM.sidebarRail?.classList.remove('open');
    },

    async processAndUpload() {
      if (!this.selectedFile) return;

      const file = this.selectedFile;
      const category = DOM.docCategorySelect?.value || 'GENERAL';
      const projectCode = DOM.docProjectSelect?.value || null;

      if (DOM.btnProcessDocument) DOM.btnProcessDocument.disabled = true;
      if (DOM.docProgressContainer) DOM.docProgressContainer.style.display = 'block';
      this.updateProgress(15, 'Dosya okunuyor ve hazırlanıyor...');

      let ticker = null;
      try {
        const base64Data = await this.readFileAsBase64(file);

        this.updateProgress(30, 'OCR / Metin analizi ve LLM yapılandırması yapılıyor...');

        ticker = setInterval(() => {
          const cur = parseInt(DOM.docProgressPercent?.textContent?.replace('%', '') || '30', 10);
          if (cur < 85) {
            this.updateProgress(cur + 5, cur > 55 ? 'LLM dokümanı analiz ediyor ve özetliyor...' : 'Metin çıkarımı ve OCR devam ediyor...');
          }
        }, 1200);

        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileData: base64Data,
            category: category,
            projectCode: projectCode
          })
        });

        if (ticker) clearInterval(ticker);

        const result = await response.json();

        if (result.status === 'OK') {
          this.updateProgress(100, 'Başarıyla tamamlandı ve vektör veritabanına indekslendi!');
          setTimeout(() => {
            if (DOM.docProgressContainer) DOM.docProgressContainer.style.display = 'none';
            this.clearSelectedFile();
            this.loadDocuments();
          }, 1500);
        } else {
          throw new Error(result.message || 'Yükleme başarısız oldu.');
        }
      } catch (err) {
        if (ticker) clearInterval(ticker);
        console.error('Document processing error:', err);
        this.updateProgress(0, 'Hata: ' + err.message);
        alert('Doküman işlenirken hata oluştu: ' + err.message);
      } finally {
        if (DOM.btnProcessDocument) {
          DOM.btnProcessDocument.disabled = !this.selectedFile;
        }
      }
    },

    updateProgress(pct, text) {
      if (DOM.docProgressBar) DOM.docProgressBar.style.width = pct + '%';
      if (DOM.docProgressPercent) DOM.docProgressPercent.textContent = '%' + pct;
      if (DOM.docProgressText) DOM.docProgressText.textContent = text;
    },

    readFileAsBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          const commaIdx = res.indexOf(',');
          resolve(commaIdx >= 0 ? res.substring(commaIdx + 1) : res);
        };
        reader.onerror = (e) => reject(e);
        reader.readAsDataURL(file);
      });
    },

    async loadDocuments() {
      if (!DOM.documentsTableBody) return;
      DOM.documentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Yükleniyor...</td></tr>';

      try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        if (data.status === 'OK' && Array.isArray(data.documents)) {
          this.documentsList = data.documents;
          this.renderTable();
        } else {
          DOM.documentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Henüz doküman bulunamadı.</td></tr>';
        }
      } catch (err) {
        console.error('Error loading documents:', err);
        DOM.documentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center error">Belgeler yüklenemedi: ' + err.message + '</td></tr>';
      }
    },

    renderTable() {
      if (!DOM.documentsTableBody) return;
      const search = (DOM.docSearchInput?.value || '').toLowerCase().trim();

      let filtered = this.documentsList;
      if (search) {
        filtered = filtered.filter(d =>
          (d.title && d.title.toLowerCase().includes(search)) ||
          (d.filename && d.filename.toLowerCase().includes(search)) ||
          (d.project_code && d.project_code.toLowerCase().includes(search)) ||
          (d.category && d.category.toLowerCase().includes(search))
        );
      }

      if (filtered.length === 0) {
        DOM.documentsTableBody.innerHTML = '<tr><td colspan="7" class="text-center">Hiç kayıtlı doküman bulunamadı.</td></tr>';
        return;
      }

      DOM.documentsTableBody.innerHTML = filtered.map(doc => {
        const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
        const methodBadge = doc.extraction_method === 'PDF_PARSER'
          ? '<span class="status-badge badge-ontime">PDF Metin</span>'
          : '<span class="status-badge badge-late">OCR (Tesseract)</span>';

        const categoryBadge = `<span class="cat-badge">${escapeHtml(doc.category || 'GENEL')}</span>`;
        const projectBadge = doc.project_code
          ? `<span class="project-pill">${escapeHtml(doc.project_code)}</span>`
          : '<span class="text-muted">-</span>';

        return `
          <tr data-doc-id="${doc.id}">
            <td>
              <div class="doc-title-cell">
                <strong>${escapeHtml(doc.title || doc.filename)}</strong>
                <small class="doc-file-sub">${escapeHtml(doc.filename)}</small>
              </div>
            </td>
            <td>${categoryBadge}</td>
            <td>${projectBadge}</td>
            <td>${methodBadge}</td>
            <td><span class="chunk-badge">${doc.chunk_count || 1} parça</span></td>
            <td><small>${dateStr}</small></td>
            <td>
              <button type="button" class="btn-delete-doc" onclick="deleteDocument('${doc.id}')" title="Belgeyi ve Vektörlerini Sil">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    },

    async deleteDoc(id) {
      if (!confirm('Bu belgeyi ve hafızadaki tüm vektör parçalarını silmek istediğinizden emin misiniz?')) {
        return;
      }

      try {
        const res = await fetch(`/api/documents/delete?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.status === 'OK') {
          await this.loadDocuments();
        } else {
          alert('Silme başarısız: ' + data.message);
        }
      } catch (err) {
        alert('Hata: ' + err.message);
      }
    }
  };

  window.deleteDocument = (id) => DocumentsManager.deleteDoc(id);

  // =========================================================================
  // Application Bootstrap
  // =========================================================================
  I18n.apply();
  UserStatus.init();
  Sidebar.init();
  ChatWelcome.showWelcome();
  ChatInput.init();
  SuggestionCards.init();
  AttendanceManager.init();
  DocumentsManager.init();
});
