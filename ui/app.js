/**
 * NISO Management Assistant — Frontend Application Architecture
 * Modular Components: Sidebar, UserStatus, ChatWelcome, ChatInput, SuggestionCards, ConversationStream, HistoryManager
 */

document.addEventListener('DOMContentLoaded', () => {
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
    if (!str) return '';
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
        DOM.userNameDisplay.textContent = State.user.name || 'Merhaba';
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
      let routeLabel = data.title || 'İK Bilgisi';

      if (data.intent === 'SMALL_TALK') {
        routeClass = 'smalltalk';
        routeLabel = 'Asistan';
      } else if (data.intent === 'HELP') {
        routeClass = 'help';
        routeLabel = 'Yardım';
      } else if (data.intent === 'UNKNOWN') {
        routeClass = 'unknown';
        routeLabel = 'Açıklama Gerekli';
      } else if (data.intent === 'SECURITY_REJECTED') {
        routeClass = 'security';
        routeLabel = 'Güvenli Ret';
      } else if (data.intent === 'ATTENDANCE_SQL') {
        routeClass = 'sql';
        routeLabel = 'Devam Bilgisi';
      } else if (data.intent === 'COMPANY_KNOWLEDGE') {
        routeClass = 'company';
        routeLabel = 'Şirket Bilgisi';
      } else if (data.intent === 'PROJECT_MAIL') {
        routeClass = 'mail';
        routeLabel = 'Proje E-postası (RAG)';
      } else if (data.intent === 'HYBRID') {
        routeClass = 'hybrid';
        routeLabel = 'Hibrit Analiz';
      } else if (data.status === 'ERROR') {
        routeClass = 'error';
        routeLabel = 'Sistem Uyarısı';
      }

      const contentHtml = parseMarkdown(data.answer || data.user_message || 'Yanıt alınamadı.');
      const auditId = data.audit_id || data.request_id || ('req_' + Date.now().toString(36));
      const isSmallOrHelp = ['SMALL_TALK', 'HELP', 'UNKNOWN', 'SECURITY_REJECTED'].includes(data.intent);

      const syntheticNoticeHtml = data.is_synthetic 
        ? '<div class="synthetic-banner">⚠️ <em>Bu cevap sentetik demo verileri içermektedir.</em></div>' 
        : '';

      // Sources HTML
      let sourcesHtml = '';
      if (data.sources && data.sources.length > 0) {
        sourcesHtml = '<div style="margin-top:10px;font-size:12px;color:var(--muted);"><strong>Kaynaklar:</strong> ' + 
          data.sources.map(s => `<code>${s.policy_code || s.code || s.title}</code>`).join(', ') + '</div>';
      }

      row.innerHTML = `
        <div class="msg-bubble">
          <span class="route-badge ${routeClass}">${routeLabel}</span>
          <div class="msg-content">${contentHtml}${syntheticNoticeHtml}${sourcesHtml}</div>
          <div class="msg-actions">
            ${!isSmallOrHelp ? `<span>Ref: <code>${auditId.substring(0, 8)}</code></span>` : '<span></span>'}
            <button class="action-btn copy-btn" title="Yanıtı Kopyala" aria-label="Yanıtı Kopyala">
              📋 Kopyala
            </button>
            <button class="action-btn feedback-btn" data-val="helpful" title="Yararlı" aria-label="Yararlı">
              👍 Yararlı
            </button>
            <button class="action-btn feedback-btn" data-val="not_helpful" title="Yararlı Değil" aria-label="Yararlı Değil">
              👎 Yararlı Değil
            </button>
          </div>
        </div>
      `;

      // Copy Handler
      const copyBtn = row.querySelector('.copy-btn');
      copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(data.answer || data.user_message || '');
        copyBtn.textContent = '✅ Kopyalandı';
        setTimeout(() => { copyBtn.textContent = '📋 Kopyala'; }, 2000);
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
            currentInput.value = `[Eklenen Dosya: ${fileNames}] ` + currentInput.value;
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
            recognition.lang = 'tr-TR';
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
            textarea.placeholder = 'Sesli giriş bu tarayıcıda desteklenmiyor, lütfen yazın...';
            setTimeout(() => {
              textarea.placeholder = 'NISO hakkında bir şey sorun...';
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
      DOM.loadingStepLabel.textContent = 'Soru analiz ediliyor ve sınıflandırılıyor...';
      const stepTimer1 = setTimeout(() => { DOM.loadingStepLabel.textContent = 'Veritabanı ve dokümanlar taranıyor...'; }, 300);
      const stepTimer2 = setTimeout(() => { DOM.loadingStepLabel.textContent = 'Yanıt güvenli şekilde sentezleniyor...'; }, 600);

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
      const title = firstUserMsg ? firstUserMsg.text : 'Yeni Sohbet';

      const existingIndex = State.history.findIndex(h => h.sessionId === State.sessionId);
      const sessionData = {
        sessionId: State.sessionId,
        title: title.length > 50 ? title.substring(0, 48) + '...' : title,
        timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
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
        DOM.historyList.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px 0;">Henüz kaydedilmiş sohbet geçmişi bulunmuyor.</p>';
        return;
      }

      State.history.forEach((h) => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
          <div class="history-item-q">${escapeHtml(h.title)}</div>
          <div class="history-item-time">${h.timestamp} • ${h.conversation.length} mesaj</div>
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
  UserStatus.init();
  Sidebar.init();
  ChatWelcome.showWelcome();
  ChatInput.init();
  SuggestionCards.init();
});
