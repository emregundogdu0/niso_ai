document.addEventListener('DOMContentLoaded', () => {
  const chatMessages = document.getElementById('chatMessages');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const charCounter = document.getElementById('charCounter');
  const loadingBar = document.getElementById('loadingBar');
  const loadingStep = document.getElementById('loadingStep');
  const welcomeCard = document.getElementById('welcomeCard');
  const sessionDisplay = document.getElementById('sessionDisplay');

  // Generate or retrieve Session ID
  let sessionId = 'session_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
  sessionDisplay.textContent = sessionId.substring(0, 16) + '...';

  // Starter Chip Buttons
  document.querySelectorAll('.chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const query = btn.getAttribute('data-query');
      userInput.value = query;
      userInput.focus();
      sendMessage(query);
    });
  });

  // Textarea input auto-grow and counter
  userInput.addEventListener('input', () => {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
    charCounter.textContent = `${userInput.value.length} / 4000`;
  });

  // Enter to send, Shift+Enter for new line
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = userInput.value.trim();
      if (text) {
        sendMessage(text);
      }
    }
  });

  sendBtn.addEventListener('click', () => {
    const text = userInput.value.trim();
    if (text) {
      sendMessage(text);
    }
  });

  // Escape HTML to prevent XSS
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Safe Markdown to HTML parser
  function parseMarkdown(mdText) {
    if (!mdText) return '';
    let html = escapeHtml(mdText);

    // Code blocks
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
    // Alert blockquotes
    html = html.replace(/&gt; \[!NOTE\]\s*\n&gt; (.*$)/gim, '<blockquote><strong>NOT:</strong> $1</blockquote>');
    // Lists
    html = html.replace(/^\- (.*$)/gim, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/gim, '<ul>$1</ul>');
    // Paragraphs / line breaks
    html = html.replace(/\n\n/g, '<br><br>');

    return html;
  }

  function appendUserMessage(text) {
    if (welcomeCard) {
      welcomeCard.style.display = 'none';
    }
    const row = document.createElement('div');
    row.className = 'msg-row user-msg';
    row.innerHTML = `
      <div class="msg-bubble">
        <p>${escapeHtml(text)}</p>
      </div>
    `;
    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function appendAssistantMessage(data) {
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
    const auditId = data.audit_id || data.request_id || 'N/A';
    const isSmallOrHelp = ['SMALL_TALK', 'HELP', 'UNKNOWN', 'SECURITY_REJECTED'].includes(data.intent);

    const syntheticNoticeHtml = data.is_synthetic ? '<div style="margin-top:8px;font-size:0.8rem;color:#e67e22;">⚠️ <em>Bu cevap sentetik demo verileri içermektedir.</em></div>' : '';

    row.innerHTML = `
      <div class="msg-bubble">
        <span class="route-badge ${routeClass}">${routeLabel}</span>
        <div class="msg-content">${contentHtml}${syntheticNoticeHtml}</div>
        <div class="msg-actions">
          ${!isSmallOrHelp ? `<span>Ref: <code>${auditId.substring(0, 8)}</code></span>` : ''}
          <button class="action-btn copy-btn" title="Yanıtı Kopyala">
            📋 Kopyala
          </button>
          <button class="action-btn feedback-btn" data-val="helpful" title="Yararlı">
            👍 Yararlı
          </button>
          <button class="action-btn feedback-btn" data-val="not_helpful" title="Yararlı Değil">
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

    chatMessages.appendChild(row);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  async function sendMessage(text) {
    appendUserMessage(text);
    userInput.value = '';
    userInput.style.height = 'auto';
    charCounter.textContent = '0 / 4000';
    userInput.disabled = true;
    sendBtn.disabled = true;
    loadingBar.style.display = 'flex';

    // Step animation
    loadingStep.textContent = 'Soru sınıflandırılıyor...';
    setTimeout(() => { loadingStep.textContent = 'Kaynaklar aranıyor...'; }, 200);
    setTimeout(() => { loadingStep.textContent = 'Veriler analiz ediliyor...'; }, 400);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionId
        })
      });

      const data = await response.json();
      appendAssistantMessage(data);
    } catch (err) {
      appendAssistantMessage({
        status: 'ERROR',
        intent: 'UNKNOWN',
        user_message: 'Sunucuya bağlanırken bir hata oluştu. Lütfen servislerin çalıştığını kontrol edin.'
      });
    } finally {
      loadingBar.style.display = 'none';
      userInput.disabled = false;
      sendBtn.disabled = false;
      userInput.focus();
    }
  }
});
