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
        history: 'Sohbet Geçmişi',
        system_info: 'Sistem Bilgisi',
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
        suggestion_1: 'TEMSA projesinde son durum',
        suggestion_2: 'Bugün kimler geç kaldı?',
        suggestion_3: 'Çalışma saatleri nelerdir?',
        footer_note: 'Yanıtlar şirket içi kaynaklardan (İK, Puantaj SQL ve Proje RAG) oluşturulur.',
        step_1: 'Soru analiz ediliyor ve sınıflandırılıyor...',
        step_2: 'Veritabanı ve dokümanlar taranıyor...',
        step_3: 'Yanıt güvenli şekilde sentezleniyor...',
        copy: '📋 Kopyala',
        copied: '✅ Kopyalandı',
        helpful: '👍 Yararlı',
        not_helpful: '👎 Yararlı Değil',
        sources_title: 'Doğrulanmış Kaynaklar',
        badge_demo: 'Sentetik Demo',
        badge_live_test: 'Canlı Test',
        badge_live: 'Canlı Kaynak',
        history_title: 'Sohbet Geçmişi',
        clear_history: 'Geçmişi Temizle',
        no_history: 'Henüz kaydedilmiş sohbet geçmişi bulunmuyor.',
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
        live_test_notice: 'Bu cevap canlı test verilerine dayanmaktadır.'
      },
      en: {
        page_title: 'NISO Management Assistant',
        new_chat: 'New Chat',
        history: 'Chat History',
        system_info: 'System Info',
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
        suggestion_1: 'Latest status on TEMSA project',
        suggestion_2: 'Who is late today?',
        suggestion_3: 'What are the working hours?',
        footer_note: 'Answers are generated from internal company sources (HR, Attendance SQL, Project RAG).',
        step_1: 'Analyzing and classifying query...',
        step_2: 'Scanning database and documents...',
        step_3: 'Synthesizing secure response...',
        copy: '📋 Copy',
        copied: '✅ Copied',
        helpful: '👍 Helpful',
        not_helpful: '👎 Not Helpful',
        sources_title: 'Verified Sources',
        badge_demo: 'Synthetic Demo',
        badge_live_test: 'Live Test',
        badge_live: 'Live Source',
        history_title: 'Chat History',
        clear_history: 'Clear History',
        no_history: 'No saved chat history yet.',
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
        live_test_notice: 'This response is based on live test data.'
      },
      it: {
        page_title: 'NISO Assistente di Direzione',
        new_chat: 'Nuova Chat',
        history: 'Cronologia Chat',
        system_info: 'Info Sistema',
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
        suggestion_1: 'Ultimo stato sul progetto TEMSA',
        suggestion_2: 'Chi è in ritardo oggi?',
        suggestion_3: 'Quali sono gli orari di lavoro?',
        footer_note: 'Le risposte sono generate da fonti interne aziendali (HR, Presenze SQL, RAG Progetti).',
        step_1: 'Analisi e classificazione della richiesta...',
        step_2: 'Scansione del database e dei documenti...',
        step_3: 'Sintesi sicura della risposta...',
        copy: '📋 Copia',
        copied: '✅ Copiato',
        helpful: '👍 Utile',
        not_helpful: '👎 Non Utile',
        sources_title: 'Fonti Verificate',
        badge_demo: 'Demo Sintetica',
        badge_live_test: 'Test dal Vivo',
        badge_live: 'Fonte dal Vivo',
        history_title: 'Cronologia Chat',
        clear_history: 'Cancella Cronologia',
        no_history: 'Nessuna cronologia chat salvata.',
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
        live_test_notice: 'Questa risposta si basa su dati di test dal vivo.'
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
    newChatBtn: document.getElementById('newChatBtn'),
    historyBtn: document.getElementById('historyBtn'),
    infoBtn: document.getElementById('infoBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),

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

      row.innerHTML = `
        <div class="msg-bubble">
          <span class="route-badge ${routeClass}">${routeLabel}</span>
          <div class="msg-content">${contentHtml}${noticeHtml}${sourcesHtml}</div>
          <div class="msg-actions">
            ${!isSmallOrHelp ? `<span>Ref: <code>${auditId.substring(0, 8)}</code></span>` : '<span></span>'}
            <button class="action-btn copy-btn" title="${I18n.t('copy')}" aria-label="${I18n.t('copy')}">
              ${I18n.t('copy')}
            </button>
            <button class="action-btn feedback-btn" data-val="helpful" title="${I18n.t('helpful')}" aria-label="${I18n.t('helpful')}">
              ${I18n.t('helpful')}
            </button>
            <button class="action-btn feedback-btn" data-val="not_helpful" title="${I18n.t('not_helpful')}" aria-label="${I18n.t('not_helpful')}">
              ${I18n.t('not_helpful')}
            </button>
          </div>
        </div>
      `;

      // Copy Handler
      const copyBtn = row.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(data.answer || data.user_message || '');
        copyBtn.textContent = I18n.t('copied');
        setTimeout(() => { copyBtn.textContent = I18n.t('copy'); }, 2000);
      });

      // Feedback Handlers
      const feedbackBtns = row.querySelectorAll('.feedback-btn');
      feedbackBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const val = btn.getAttribute('data-val');
          feedbackBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              request_id: data.request_id || auditId,
              feedback: val
            })
          }).catch(() => {});
        });
      });

      DOM.conversationStream.appendChild(row);
      this.scrollToBottom();

      State.conversation.push({ role: 'assistant', data, timestamp: new Date().toISOString() });
      HistoryManager.saveCurrentSession();
    },

    scrollToBottom() {
      DOM.chatViewport.scrollTo({
        top: DOM.chatViewport.scrollHeight,
        behavior: 'smooth'
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

      // Voice dictation button (Web Speech API with graceful fallback)
      if (voiceBtn) {
        voiceBtn.addEventListener('click', () => {
          if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            const recognition = new SpeechRecognition();
            const langMap = { tr: 'tr-TR', en: 'en-US', it: 'it-IT' };
            recognition.lang = langMap[I18n.current] || 'tr-TR';
            recognition.interimResults = false;
            voiceBtn.style.color = '#ef4444';
            recognition.onresult = (event) => {
              const transcript = event.results[0][0].transcript;
              textarea.value = transcript;
              voiceBtn.style.color = '';
              this.submitQuery(textarea);
            };
            recognition.onerror = () => {
              voiceBtn.style.color = '';
            };
            recognition.onend = () => {
              voiceBtn.style.color = '';
            };
            recognition.start();
          } else {
            textarea.placeholder = I18n.t('voice') + ' error...';
            setTimeout(() => {
              textarea.placeholder = I18n.t('hero_placeholder');
            }, 3000);
          }
        });
      }
    },

    async submitQuery(textarea) {
      const text = textarea.value.trim();
      if (!text || State.isLoading) return;

      textarea.value = '';
      textarea.style.height = 'auto';

      ConversationStream.appendUserMessage(text);
      await this.executeChatRequest(text);
    },

    async executeChatRequest(text) {
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
      } catch (err) {
        ConversationStream.appendAssistantMessage({
          status: 'ERROR',
          intent: 'UNKNOWN',
          user_message: 'Sunucuya bağlanırken bir hata oluştu. Lütfen yerel servislerin aktif olduğunu kontrol edin.'
        });
      } finally {
        clearTimeout(stepTimer1);
        clearTimeout(stepTimer2);
        DOM.streamLoadingBar.style.display = 'none';
        State.isLoading = false;
        this.setInputsDisabled(false);
      }
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
    init() {
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
        });
      }

      // Mobile Menu Toggle
      if (DOM.mobileMenuBtn && DOM.sidebarRail) {
        DOM.mobileMenuBtn.addEventListener('click', () => {
          DOM.sidebarRail.classList.toggle('open');
        });
      }

      // History Modal
      if (DOM.historyBtn && DOM.historyModal) {
        DOM.historyBtn.addEventListener('click', () => {
          HistoryManager.renderHistoryList();
          DOM.historyModal.style.display = 'grid';
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
    },

    renderHistoryList() {
      if (!DOM.historyList) return;
      DOM.historyList.innerHTML = '';

      if (State.history.length === 0) {
        DOM.historyList.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px 0;">${I18n.t('no_history')}</p>`;
        return;
      }

      State.history.forEach((h) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-item-q">${escapeHtml(h.title)}</div>
          <div class="history-item-time">${h.timestamp} • ${h.conversation.length} ${I18n.current === 'tr' ? 'mesaj' : (I18n.current === 'it' ? 'messaggi' : 'messages')}</div>
        `;
        item.addEventListener('click', () => {
          DOM.historyModal.style.display = 'none';
          this.restoreSession(h);
        });
        DOM.historyList.appendChild(item);
      });
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
  // Application Bootstrap
  // =========================================================================
  I18n.apply();
  UserStatus.init();
  Sidebar.init();
  ChatWelcome.showWelcome();
  ChatInput.init();
  SuggestionCards.init();
});
