// =============================================
// NeoChat AI — Main Application
// =============================================

const App = (() => {
    // State
    let state = {
      currentConvId: null,
      conversations: [],
      messages: [],
      isLoading: false,
      mode: 'normal',
      initialized: false,
      systemPrompts: {
        normal: '',
        code: 'You are an expert software engineer. Format all code responses with proper syntax highlighting. Explain your code clearly.',
        creative: 'You are a creative writing expert. Be imaginative, descriptive, and engaging in your responses.',
        analytics: 'You are a data analyst expert. Provide structured, data-driven insights. Use tables and bullet points when helpful.'
      },
      settings: {
        systemPrompt: '',
        theme: 'dark'
      }
    };
  
    // DOM refs
    const $ = id => document.getElementById(id);
    const chatArea = $('chatArea');
    const messagesContainer = $('messagesContainer');
    const welcomeScreen = $('welcomeScreen');
    const messageInput = $('messageInput');
    const sendBtn = $('sendBtn');
    const historyList = $('historyList');
    const convTitle = $('convTitle');
    const charCount = $('charCount');
    const modeIndicator = $('modeIndicator');
    const sidebar = $('sidebar');
  
    const modeNames = {
      normal: 'Normal Mode',
      code: 'Code Mode 👨‍💻',
      creative: 'Creative Mode 🎨',
      analytics: 'Analytics Mode 📊'
    };
  
    // ─────────────────────────────────────────────
    // INIT
    // ─────────────────────────────────────────────
    function init() {
      if (state.initialized) return;
      state.initialized = true;
      loadSettings();
      loadHistory();
      bindEvents();
      startNewConversation();
    }
  
    function loadSettings() {
      const saved = localStorage.getItem('neochat_settings');
      if (saved) {
        try { state.settings = { ...state.settings, ...JSON.parse(saved) }; } catch(e) {}
      }
      applyTheme(state.settings.theme);
      if ($('systemPromptInput')) $('systemPromptInput').value = state.settings.systemPrompt || '';
      if ($('apiKeyInput') && state.settings.apiKey) {
        $('apiKeyInput').value = state.settings.apiKey;
      }
    }
  
    function saveSettings() {
      localStorage.setItem('neochat_settings', JSON.stringify(state.settings));
    }
  
    // ─────────────────────────────────────────────
    // CONVERSATION MANAGEMENT
    // ─────────────────────────────────────────────
    function startNewConversation() {
      state.currentConvId = 'conv_' + Date.now();
      state.messages = [];
      messagesContainer.innerHTML = '';
      welcomeScreen.style.display = '';
      convTitle.textContent = 'New Conversation';
      // Deselect history items
      document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    }
  
    async function loadConversation(convId) {
      try {
        const res = await fetch(`/api/conversation/${convId}`);
        const history = await res.json();
  
        state.currentConvId = convId;
        state.messages = history;
  
        messagesContainer.innerHTML = '';
        welcomeScreen.style.display = 'none';
  
        history.forEach(msg => {
          appendMessage(msg.role, msg.content, msg.time, false);
        });
  
        scrollToBottom();
  
        // Update title
        const conv = state.conversations.find(c => c.id === convId);
        convTitle.textContent = conv ? conv.title : 'Conversation';
  
        // Update active state
        document.querySelectorAll('.history-item').forEach(el => {
          el.classList.toggle('active', el.dataset.id === convId);
        });
      } catch(err) {
        showToast('Failed to load conversation');
      }
    }
  
    // ─────────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────────
    async function sendMessage() {
      const text = messageInput.value.trim();
      if (!text || state.isLoading) return;
      if (text.length > 4000) { showToast('Message too long (max 4000 chars)'); return; }
  
      // Hide welcome
      welcomeScreen.style.display = 'none';
  
      messageInput.value = '';
      messageInput.style.height = 'auto';
      charCount.textContent = '0 / 4000';
      sendBtn.disabled = true;
      state.isLoading = true;
  
      // Add user message
      const time = new Date().toISOString();
      appendMessage('user', text, time);
      state.messages.push({ role: 'user', content: text, time });
  
      // Show typing
      const typingEl = showTyping();
  
      // Build system prompt
      let systemPrompt = state.systemPrompts[state.mode];
      if (state.settings.systemPrompt) {
        systemPrompt = state.settings.systemPrompt + '\n' + systemPrompt;
      }
  
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            conversation_id: state.currentConvId,
            system_prompt: systemPrompt
          })
        });
  
        const data = await res.json();
        typingEl.remove();
  
        if (data.error) {
          showToast('Error: ' + data.error);
          if (data.error.includes('API_KEY') || data.error.includes('api key')) {
            showToast('⚠️ Set your Gemini API key in Settings');
          }
        } else {
          const aiTime = new Date().toISOString();
          appendMessage('ai', data.reply, aiTime);
          state.messages.push({ role: 'assistant', content: data.reply, time: aiTime });
          loadHistory();
        }
      } catch(err) {
        typingEl.remove();
        showToast('Network error. Check your connection.');
      }
  
      state.isLoading = false;
      sendBtn.disabled = false;
      messageInput.focus();
      scrollToBottom();
    }
  
    // ─────────────────────────────────────────────
    // RENDER MESSAGE
    // ─────────────────────────────────────────────
    function appendMessage(role, content, time, animate = true) {
      const isUser = role === 'user';
      const timeStr = formatTime(time);
  
      const msgEl = document.createElement('div');
      msgEl.className = `message ${isUser ? 'user' : 'ai'}`;
      if (!animate) msgEl.style.animation = 'none';
  
      const rendered = isUser ? escapeHtml(content) : renderMarkdown(content);
  
      msgEl.innerHTML = `
        <div class="msg-avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="msg-content">
          <div class="msg-bubble">${rendered}</div>
          <div class="msg-meta">
            <span class="msg-time">${timeStr}</span>
            <div class="msg-actions">
              <button class="msg-action-btn" onclick="App.copyMsg(this)" title="Copy">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                Copy
              </button>
              ${!isUser ? `<button class="msg-action-btn" title="Speak" onclick="App.speakMsg(this)">🔊</button>` : ''}
            </div>
          </div>
        </div>
      `;
  
      // Add copy buttons to code blocks
      msgEl.querySelectorAll('pre').forEach(pre => {
        const btn = document.createElement('button');
        btn.className = 'code-copy';
        btn.textContent = 'Copy';
        btn.onclick = () => {
          navigator.clipboard.writeText(pre.querySelector('code')?.textContent || pre.textContent);
          btn.textContent = 'Copied!';
          setTimeout(() => btn.textContent = 'Copy', 2000);
        };
        pre.style.position = 'relative';
        pre.appendChild(btn);
      });
  
      messagesContainer.appendChild(msgEl);
      scrollToBottom();
      return msgEl;
    }
  
    function renderMarkdown(text) {
      try {
        if (typeof marked !== 'undefined') {
          // marked v9+ uses marked.parse()
          return marked.parse(text);
        }
      } catch(e) {}
      // Fallback: basic formatting
      return text
        .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g,'<br>');
    }
  
    function escapeHtml(text) {
      return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
    }
  
    function showTyping() {
      const el = document.createElement('div');
      el.className = 'typing-indicator';
      el.innerHTML = `
        <div class="msg-avatar">🤖</div>
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      `;
      messagesContainer.appendChild(el);
      scrollToBottom();
      return el;
    }
  
    // ─────────────────────────────────────────────
    // HISTORY
    // ─────────────────────────────────────────────
    async function loadHistory() {
      try {
        const res = await fetch('/api/conversations');
        const convs = await res.json();
        state.conversations = convs;
        renderHistory(convs);
      } catch(e) {}
    }
  
    function renderHistory(convs) {
      if (!convs.length) {
        historyList.innerHTML = '<div class="history-empty">Start a conversation</div>';
        return;
      }
  
      historyList.innerHTML = convs.map(c => `
        <div class="history-item ${c.id === state.currentConvId ? 'active' : ''}" data-id="${c.id}">
          <span class="history-item-icon">💬</span>
          <div class="history-item-text">
            <div class="history-item-title">${escapeHtml(c.title)}</div>
            <div class="history-item-meta">${c.message_count} msgs · ${formatTime(c.time)}</div>
          </div>
          <button class="history-item-delete" onclick="App.deleteConv('${c.id}', event)" title="Delete">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      `).join('');
  
      // Click handlers
      historyList.querySelectorAll('.history-item').forEach(el => {
        el.addEventListener('click', (e) => {
          if (e.target.closest('.history-item-delete')) return;
          const id = el.dataset.id;
          loadConversation(id);
          // Close sidebar on mobile
          if (window.innerWidth <= 768) sidebar.classList.remove('open');
        });
      });
  
      // Search filter
      const searchVal = $('historySearch').value.toLowerCase();
      if (searchVal) {
        historyList.querySelectorAll('.history-item').forEach(el => {
          const title = el.querySelector('.history-item-title').textContent.toLowerCase();
          el.style.display = title.includes(searchVal) ? '' : 'none';
        });
      }
    }
  
    // ─────────────────────────────────────────────
    // ACTIONS
    // ─────────────────────────────────────────────
    async function deleteConv(id, e) {
      e.stopPropagation();
      if (!confirm('Delete this conversation?')) return;
      await fetch(`/api/conversation/${id}`, { method: 'DELETE' });
      if (state.currentConvId === id) startNewConversation();
      loadHistory();
    }
  
    function copyMsg(btn) {
      const bubble = btn.closest('.msg-content').querySelector('.msg-bubble');
      navigator.clipboard.writeText(bubble.textContent);
      btn.innerHTML = '✓ Copied';
      setTimeout(() => {
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy`;
      }, 2000);
    }
  
    function speakMsg(btn) {
      const bubble = btn.closest('.msg-content').querySelector('.msg-bubble');
      const text = bubble.textContent;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = 'en-US';
        window.speechSynthesis.speak(utt);
        btn.textContent = '🔇';
        utt.onend = () => btn.textContent = '🔊';
      }
    }
  
    function exportChat() {
      if (!state.messages.length) { showToast('No messages to export'); return; }
  
      let content = `# NeoChat Export\n\n`;
      state.messages.forEach(m => {
        const role = m.role === 'user' ? '**You**' : '**NeoChat AI**';
        content += `${role} (${formatTime(m.time)}):\n${m.content}\n\n---\n\n`;
      });
  
      const blob = new Blob([content], { type: 'text/markdown' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `neochat_${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      showToast('Chat exported!');
    }
  
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === theme);
      });
    }
  
    function setMode(mode) {
      state.mode = mode;
      modeIndicator.textContent = modeNames[mode];
      document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
      $(`${mode}ModeBtn`).classList.add('active');
    }
  
    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────
    function scrollToBottom() {
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }
  
    function formatTime(iso) {
      if (!iso) return '';
      try {
        const d = new Date(iso);
        const now = new Date();
        const diffMs = now - d;
        if (diffMs < 60000) return 'Just now';
        if (diffMs < 3600000) return Math.floor(diffMs / 60000) + 'm ago';
        if (diffMs < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      } catch(e) { return ''; }
    }
  
    function showToast(msg) {
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.textContent = msg;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }
  
    // ─────────────────────────────────────────────
    // EVENT BINDING
    // ─────────────────────────────────────────────
    function bindEvents() {
      // Send
      sendBtn.addEventListener('click', sendMessage);
  
      messageInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });
  
      messageInput.addEventListener('input', () => {
        // Auto-resize
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
        // Char count
        const len = messageInput.value.length;
        charCount.textContent = `${len} / 4000`;
        charCount.style.color = len > 3800 ? '#ff4757' : '';
      });
  
      // New chat
      $('newChatBtn').addEventListener('click', startNewConversation);
  
      // Mode buttons
      $('normalModeBtn').addEventListener('click', () => setMode('normal'));
      $('codeModeBtn').addEventListener('click', () => setMode('code'));
      $('creativeModeBtn').addEventListener('click', () => setMode('creative'));
      $('analyticsModeBtn').addEventListener('click', () => setMode('analytics'));
  
      // Sidebar toggle
      $('sidebarToggle').addEventListener('click', () => sidebar.classList.toggle('open'));
  
      // Close sidebar on outside click (mobile)
      document.addEventListener('click', e => {
        if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
          if (!sidebar.contains(e.target) && !$('sidebarToggle').contains(e.target)) {
            sidebar.classList.remove('open');
          }
        }
      });
  
      // History search
      $('historySearch').addEventListener('input', () => renderHistory(state.conversations));
  
      // Clear all
      $('clearAllBtn').addEventListener('click', async () => {
        if (!confirm('Delete all conversations?')) return;
        await fetch('/api/clear-all', { method: 'DELETE' });
        startNewConversation();
        loadHistory();
        showToast('All conversations deleted');
      });
  
      // Settings
      $('settingsBtn').addEventListener('click', () => $('settingsModal').classList.add('open'));
      $('closeSettings').addEventListener('click', () => $('settingsModal').classList.remove('open'));
      $('settingsModal').addEventListener('click', e => {
        if (e.target === $('settingsModal')) $('settingsModal').classList.remove('open');
      });
  
      $('saveKeyBtn').addEventListener('click', () => {
        state.settings.apiKey = $('apiKeyInput').value;
        saveSettings();
        showToast('API key saved! Restart server to apply.');
      });
  
      $('systemPromptInput').addEventListener('input', () => {
        state.settings.systemPrompt = $('systemPromptInput').value;
        saveSettings();
      });
  
      document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.settings.theme = btn.dataset.theme;
          applyTheme(btn.dataset.theme);
          saveSettings();
        });
      });
  
      // Export
      $('exportBtn').addEventListener('click', exportChat);
  
      // Suggestion cards
      document.querySelectorAll('.suggestion-card').forEach(card => {
        card.addEventListener('click', () => {
          messageInput.value = card.dataset.prompt;
          messageInput.dispatchEvent(new Event('input'));
          messageInput.focus();
          sendMessage();
        });
      });
  
      // Highlight.js after render
      document.addEventListener('DOMContentLoaded', () => {
        if (typeof hljs !== 'undefined') hljs.highlightAll();
      });
    }
  
    // ─────────────────────────────────────────────
    // RETURN PUBLIC API
    // ─────────────────────────────────────────────
    return { init, copyMsg, speakMsg, deleteConv };
  })();
  
  // Init when DOM ready
  window.addEventListener('DOMContentLoaded', () => {
    // Setup marked with highlight.js
    if (typeof marked !== 'undefined') {
      const renderer = new marked.Renderer();
      marked.use({
        breaks: true,
        gfm: true,
        renderer
      });
    }
    App.init();
  });
  
  // Fallback if DOMContentLoaded already fired
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    if (typeof marked !== 'undefined') {
      marked.use({ breaks: true, gfm: true });
    }
    App.init();
  }