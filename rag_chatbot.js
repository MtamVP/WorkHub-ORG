// updateRAGServerUrl() (bên dưới) đã lưu localStorage['rag_server_url'] mỗi khi người dùng
// đổi URL server RAG tuỳ chỉnh, nhưng trước đây KHÔNG đọc lại giá trị này lúc khởi tạo --
// mỗi lần tải lại trang, RAG_API_BASE luôn quay về mặc định cứng, âm thầm "quên" cấu hình
// người dùng vừa đặt. Đọc lại ở đây để khớp đúng hành vi updateRAGServerUrl() đã hứa.
// (api.js:1009/1063 đọc cùng key này nhưng fallback về 1 URL mặc định khác --
// 'https://workhub-org.onrender.com' -- lệch với mặc định ở đây; chưa rõ URL nào đang
// thật sự chạy nên không tự đổi, chỉ ghi chú lại để xem xét riêng.)
let RAG_API_BASE = localStorage.getItem('rag_server_url') || 'https://workhub-org-git-825025516269.us-central1.run.app';
let isRAGConnected = false;
let isGenerating = false;
let ragChatHistory = [];
let savedMessages = [];

document.addEventListener('DOMContentLoaded', () => {
  initRAGChatbot();
});

function initRAGChatbot() {
  const checkStatusBtn = document.getElementById('rag-check-status-btn');
  const syncStorageBtn = document.getElementById('rag-sync-storage-btn');
  const sendBtn = document.getElementById('rag-send-btn');
  const inputEl = document.getElementById('rag-input');
  const clearChatBtn = document.getElementById('rag-clear-chat-btn');

  if (checkStatusBtn) checkStatusBtn.addEventListener('click', checkRAGServerStatus);
  if (syncStorageBtn) syncStorageBtn.addEventListener('click', syncBronzeStorage);
  if (sendBtn) sendBtn.addEventListener('click', handleSendRAGQuery);
  if (clearChatBtn) clearChatBtn.addEventListener('click', clearRAGChat);

  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendRAGQuery();
      }
    });

    inputEl.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }

  loadSavedRAGChat();
  checkRAGServerStatus();
  
  setTimeout(() => {
    syncBronzeStorage({ silent: true });
  }, 1000);

  window.addEventListener('workhub_files_changed', () => {
    syncBronzeStorage({ silent: true });
  });
}

function saveChatToLocalStorage() {
  try {
    localStorage.setItem('workhub_rag_messages_v1', JSON.stringify(savedMessages));
    localStorage.setItem('workhub_rag_history_v1', JSON.stringify(ragChatHistory));
  } catch (e) {}
}

function loadSavedRAGChat() {
  const area = document.getElementById('rag-messages-area');
  if (!area) return;

  try {
    const rawMsgs = localStorage.getItem('workhub_rag_messages_v1');
    const rawHist = localStorage.getItem('workhub_rag_history_v1');
    
    if (rawHist) {
      ragChatHistory = JSON.parse(rawHist) || [];
    }

    if (rawMsgs) {
      const msgs = JSON.parse(rawMsgs);
      if (Array.isArray(msgs) && msgs.length > 0) {
        savedMessages = msgs;
        area.innerHTML = '';
        msgs.forEach(m => {
          if (m.type === 'user') {
            appendUserMessage(m.text, false);
          } else if (m.type === 'assistant') {
            appendAssistantMessage(m.text, m.sources || [], m.retrievedDocs || [], m.suggestions || [], false);
          }
        });
        area.scrollTop = area.scrollHeight;
      }
    }
  } catch (e) {}
}

function cleanDocumentTitle(rawName) {
  if (!rawName) return '';
  let name = rawName.split('#')[0];
  name = name.replace(/^(?:F_)?\d{10,20}_?/i, '');
  const dict = [
    [/N_I_DUNG|NOI_DUNG/gi, 'Nội dung'],
    [/KH_A_H_C|KHOA_HOC/gi, 'Khóa học'],
    [/C_A|\bCUA\b/gi, 'của'],
    [/B_O_C_O|BAO_CAO/gi, 'Báo cáo'],
    [/QUY__NH|QUY_DINH/gi, 'Quy định'],
    [/T_I_LI_U|TAI_LIEU/gi, 'Tài liệu'],
    [/T_I_CH_NH|TAI_CHINH/gi, 'Tài chính'],
    [/H_P___NG|HOP_DONG/gi, 'Hợp đồng'],
    [/K_HO_CH|KE_HOACH/gi, 'Kế hoạch'],
    [/TH_NG_B_O|THONG_BAO/gi, 'Thông báo'],
    [/H__NG_D_N|HUONG_DAN/gi, 'Hướng dẫn'],
    [/QUY_TR_NH|QUY_TRINH/gi, 'Quy trình'],
    [/CH_NH_S_CH|CHINH_SACH/gi, 'Chính sách'],
    [/DOANH_NGHIEP/gi, 'Doanh nghiệp'],
    [/PHAN_TICH/gi, 'Phân tích'],
  ];

  dict.forEach(([regex, repl]) => {
    name = name.replace(regex, repl);
  });
  
  name = name.replace(/\.(pdf|docx?|xlsx?|csv|txt|json)$/i, '');
  name = name.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  
  return name || rawName;
}

async function checkRAGServerStatus() {
  const statusDot = document.getElementById('rag-status-dot');
  const statusText = document.getElementById('rag-status-text');
  const docsCountBadge = document.getElementById('rag-docs-count-badge');
  const serverUrlInput = document.getElementById('rag-server-url-input');

  if (serverUrlInput) serverUrlInput.value = RAG_API_BASE;

  try {
    const res = await fetch(`${RAG_API_BASE}/api/status`, { method: 'GET', cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    isRAGConnected = true;

    if (statusDot) statusDot.className = 'rag-status-dot online';
    if (statusText) statusText.innerHTML = `<span class="text-success fw-bold">Online</span>`;
    if (docsCountBadge) {
      const docCount = data.documents_indexed || 0;
      docsCountBadge.textContent = `${docCount} tài liệu`;
    }

    loadRAGDocumentsList();
  } catch (err) {
    isRAGConnected = false;
    if (statusDot) statusDot.className = 'rag-status-dot offline';
    if (statusText) statusText.innerHTML = `<span class="text-danger fw-bold">Offline</span>`;
    if (docsCountBadge) docsCountBadge.textContent = `0 tài liệu`;
  }
}

function updateRAGServerUrl() {
  const input = document.getElementById('rag-server-url-input');
  if (input && input.value.trim()) {
    RAG_API_BASE = input.value.trim().replace(/\/+$/, '');
    localStorage.setItem('rag_server_url', RAG_API_BASE);
    checkRAGServerStatus();
  }
}

async function syncBronzeStorage(options = {}) {
  const isSilent = Boolean(options && options.silent);
  const syncBtn = document.getElementById('rag-sync-storage-btn');
  const originalText = syncBtn ? syncBtn.innerHTML : '';
  
  if (syncBtn && !isSilent) {
    syncBtn.disabled = true;
    syncBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin me-1"></i> Đang tải...`;
  }

  try {
    const res = await fetch(`${RAG_API_BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bucket_name: 'general_bucket' })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || data.detail || 'Lỗi không xác định');

    if (!isSilent && typeof showToast === 'function') {
      showToast(data.message || 'Đã đồng bộ dữ liệu Bronze Storage', 'success');
    }
    
    await checkRAGServerStatus();
  } catch (err) {
    if (!isSilent && typeof showToast === 'function') {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  } finally {
    if (syncBtn && !isSilent) {
      syncBtn.disabled = false;
      syncBtn.innerHTML = originalText;
    }
  }
}

async function loadRAGDocumentsList() {
  const container = document.getElementById('rag-documents-list-container');

  try {
    const res = await fetch(`${RAG_API_BASE}/api/documents`);
    if (!res.ok) throw new Error('Không thể tải tài liệu');
    const data = await res.json();

    const items = data.items || [];
    renderDynamicPrompts(items);

    const focusSelect = document.getElementById('rag-focus-doc-select');
    if (focusSelect) {
      const currentVal = focusSelect.value;
      focusSelect.innerHTML = `<option value="all">📁 Tất cả tài liệu</option>`;
      items.forEach(doc => {
        const displayName = doc.display_name || cleanDocumentTitle(doc.file_name || doc.doc_id);
        const opt = document.createElement('option');
        opt.value = doc.file_name || doc.doc_id || displayName;
        opt.textContent = `📄 ${displayName}`;
        if (opt.value === currentVal) opt.selected = true;
        focusSelect.appendChild(opt);
      });
    }

    if (!container) return;

    if (items.length === 0) {
      container.innerHTML = `<div class="text-muted small text-center py-3">Chưa có tài liệu trong Bronze Storage.<br>Nhấn <b>"Đồng bộ dữ liệu"</b> để tải.</div>`;
      return;
    }

    let html = '';
    items.forEach(doc => {
      const displayName = doc.display_name || cleanDocumentTitle(doc.file_name || doc.doc_id);
      const metaInfo = [
        doc.total_pages ? `${doc.total_pages} trang` : '',
        doc.file_size ? `${doc.file_size}` : ''
      ].filter(Boolean).join(' • ');

      // encodeURIComponent() KHÔNG mã hoá dấu nháy đơn (') -- đúng theo spec, nó nằm trong
      // nhóm ký tự "unreserved" -- nên tên tài liệu có dấu ' vẫn phá vỡ được chuỗi JS literal
      // trong thuộc tính onclick=' ' bên dưới dù đã encodeURIComponent. .replace(/'/g,'%27')
      // thêm vào để chặn đúng lỗ hổng này, decodeURIComponent() ở viewRAGDocumentDetail() vẫn
      // giải mã đúng vì %27 là 1 chuỗi hex hợp lệ như mọi ký tự khác.
      html += `
        <div class="rag-doc-item" onclick="viewRAGDocumentDetail('${encodeURIComponent(displayName).replace(/'/g, '%27')}', '${encodeURIComponent(doc.preview || '').replace(/'/g, '%27')}')">
          <div class="rag-doc-item-title d-flex justify-content-between align-items-center">
            <span class="text-truncate"><i class="fa-solid fa-file-lines text-primary me-1"></i> ${escapeHTML(displayName)}</span>
            ${metaInfo ? `<span class="badge bg-light text-secondary border font-monospace" style="font-size: 10px;">${escapeHTML(metaInfo)}</span>` : ''}
          </div>
          <div class="rag-doc-item-preview">${escapeHTML(doc.preview || 'Tài liệu văn bản đã được lập chỉ mục')}</div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    renderDynamicPrompts([]);
    if (container) container.innerHTML = `<div class="text-muted small text-center py-3">Không thể kết nối danh sách tài liệu.</div>`;
  }
}

function renderDynamicPrompts(items) {
  const container = document.getElementById('rag-quick-prompts-container');
  if (!container) return;

  if (!items || items.length === 0) {
    container.innerHTML = `
      <span class="text-muted small align-self-center me-1"><i class="fa-solid fa-lightbulb text-warning"></i> Gợi ý chung:</span>
      <button type="button" class="rag-prompt-pill" onclick="sendQuickPrompt('Ciel là ai và có thể giúp gì cho tôi trong WorkHub?')">
        <i class="fa-solid fa-sparkles text-primary me-1"></i> Ciel có thể giúp gì?
      </button>
      <button type="button" class="rag-prompt-pill" onclick="sendQuickPrompt('Hướng dẫn cách tải tài liệu lên Bronze Storage để Ciel phân tích dữ liệu')">
        <i class="fa-solid fa-cloud-arrow-up text-primary me-1"></i> Tải tài liệu lên Storage
      </button>
      <button type="button" class="rag-prompt-pill" onclick="sendQuickPrompt('Lập kế hoạch công việc và quản lý thời gian hiệu quả trong tuần')">
        <i class="fa-solid fa-calendar-check text-primary me-1"></i> Lập kế hoạch tuần
      </button>
    `;
    return;
  }

  const promptList = [];

  items.forEach(doc => {
    const cleanName = doc.clean_name || cleanDocumentTitle(doc.display_name || doc.file_name || doc.doc_id);
    if (!cleanName) return;

    promptList.push({
      label: `Tóm tắt ${cleanName}`,
      question: `Tóm tắt nội dung chính và các điểm cốt lõi trong tài liệu ${cleanName}?`
    });

    promptList.push({
      label: `Lộ trình & Module ${cleanName}`,
      question: `Liệt kê chi tiết lộ trình các module, bài học và kiến thức trong tài liệu ${cleanName}?`
    });

    promptList.push({
      label: `Mục tiêu & Yêu cầu ${cleanName}`,
      question: `Mục tiêu đầu ra, yêu cầu và bài tập thực hành được nêu trong tài liệu ${cleanName} là gì?`
    });
  });

  let html = `<span class="text-muted small align-self-center me-1"><i class="fa-solid fa-lightbulb text-warning"></i> Gợi ý theo tài liệu:</span>`;

  promptList.slice(0, 4).forEach((p) => {
    html += `
      <button type="button" class="rag-prompt-pill" onclick="sendQuickPrompt('${escapeHTML(p.question)}')">
        ${escapeHTML(p.label)}
      </button>
    `;
  });

  container.innerHTML = html;
}

async function handleSendRAGQuery() {
  if (isGenerating) return;

  const inputEl = document.getElementById('rag-input');
  const question = inputEl ? inputEl.value.trim() : '';
  if (!question) return;

  const topDocsSelect = document.getElementById('rag-top-docs-select');
  const useLlmCheckbox = document.getElementById('rag-use-llm-toggle');
  const focusDocSelect = document.getElementById('rag-focus-doc-select');

  const topDocs = topDocsSelect ? parseInt(topDocsSelect.value, 10) : 5;
  const useLLM = useLlmCheckbox ? useLlmCheckbox.checked : true;
  const focusDocId = focusDocSelect ? focusDocSelect.value : 'all';

  appendUserMessage(question, true);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  const loadingMsgId = appendAssistantLoadingMessage();
  isGenerating = true;
  updateSendBtnState(true);

  try {
    const geminiApiKey = localStorage.getItem('rag_gemini_api_key') || '';
    const res = await fetch(`${RAG_API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        top_docs: topDocs,
        use_llm: useLLM,
        gemini_api_key: geminiApiKey || undefined,
        history: ragChatHistory.slice(-6),
        focus_doc_id: focusDocId !== 'all' ? focusDocId : undefined
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Lỗi ${res.status}`);
    }

    const data = await res.json();
    const result = data.data;

    ragChatHistory.push({ role: 'user', content: question });
    ragChatHistory.push({ role: 'assistant', content: result.answer });
    if (ragChatHistory.length > 10) {
      ragChatHistory = ragChatHistory.slice(-10);
    }

    removeLoadingMessage(loadingMsgId);
    await streamAssistantMessage(result.answer, result.sources, result.retrieved_docs, result.suggestions, true);
    saveChatToLocalStorage();

    renderQueryInspector(question, result);
  } catch (err) {
    removeLoadingMessage(loadingMsgId);
    appendAssistantMessage(`Không thể kết nối đến máy chủ (${err.message}). Vui lòng kiểm tra lại RAG Server.`, [], [], [], true);
  } finally {
    isGenerating = false;
    updateSendBtnState(false);
  }
}

function sendQuickPrompt(promptText) {
  const inputEl = document.getElementById('rag-input');
  if (inputEl) {
    inputEl.value = promptText;
    handleSendRAGQuery();
  }
}

function appendUserMessage(text, shouldSave = true) {
  const area = document.getElementById('rag-messages-area');
  if (!area) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'rag-message user';
  msgDiv.innerHTML = `
    <div class="rag-msg-avatar"><i class="fa-solid fa-user"></i></div>
    <div class="rag-msg-bubble">${escapeHTML(text)}</div>
  `;
  area.appendChild(msgDiv);
  area.scrollTop = area.scrollHeight;

  if (shouldSave) {
    savedMessages.push({ type: 'user', text });
    saveChatToLocalStorage();
  }
}

function buildAssistantHTML(msgUniqueId, formattedContent, sourcesHtml, suggestionsHtml) {
  return `
    <div class="rag-msg-avatar"><i class="fa-brands fa-google"></i></div>
    <div class="rag-msg-bubble position-relative">
      <div class="d-flex justify-content-between align-items-center mb-1 pb-1 border-bottom border-light-subtle">
        <span class="small fw-bold text-primary" style="font-size: 11px;"><i class="fa-solid fa-brain me-1"></i> Ciel</span>
        <button type="button" class="btn btn-sm text-muted p-0 border-0" title="Sao chép câu trả lời" onclick="copyMessageText('${msgUniqueId}', this)">
          <i class="fa-regular fa-copy" style="font-size: 12px;"></i>
        </button>
      </div>
      <div id="${msgUniqueId}" class="rag-msg-text mb-2">${formattedContent}</div>
      ${sourcesHtml}
      ${suggestionsHtml}
    </div>
  `;
}

function appendAssistantMessage(markdownText, sources = [], retrievedDocs = [], suggestions = [], shouldSave = true) {
  const area = document.getElementById('rag-messages-area');
  if (!area) return;

  const msgDiv = document.createElement('div');
  msgDiv.className = 'rag-message assistant';

  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    sourcesHtml = `
      <div class="rag-citation-box">
        <div class="rag-citation-header"><i class="fa-solid fa-bookmark text-primary"></i> Trích dẫn từ Bronze Storage:</div>
        <div>
          ${sources.map(s => `<span class="rag-source-tag" onclick="showSourceSnippet('${escapeHTML(s)}')"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(s)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  let suggestionsHtml = '';
  if (suggestions && suggestions.length > 0) {
    suggestionsHtml = `
      <div class="rag-suggestions-box mt-3 pt-2 border-top border-light-subtle">
        <div class="small fw-semibold text-primary mb-2" style="font-size: 11px;">
          <i class="fa-solid fa-wand-magic-sparkles me-1"></i> Câu hỏi gợi ý tiếp theo:
        </div>
        <div class="d-flex flex-wrap gap-2">
          ${suggestions.map(sugg => `
            <button type="button" class="btn btn-sm btn-light border rounded-pill text-start py-1 px-2 shadow-sm text-secondary" style="font-size: 11px; transition: all 0.2s;" onmouseover="this.classList.add('border-primary', 'text-primary')" onmouseout="this.classList.remove('border-primary', 'text-primary')" onclick="sendQuickPrompt('${escapeHTML(sugg)}')">
              <i class="fa-regular fa-comment-dots text-primary me-1"></i> ${escapeHTML(sugg)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Date.now() (độ chính xác mili-giây) không đủ để đảm bảo duy nhất -- loadSavedRAGChat()
  // gọi appendAssistantMessage() liên tiếp trong 1 vòng forEach đồng bộ, trên máy nhanh 2
  // tin nhắn có thể sinh trong cùng 1 mili-giây, trùng id="msg-..." khiến
  // document.getElementById (copyMessageText) luôn trả về tin nhắn đầu tiên. Thêm hậu tố
  // ngẫu nhiên để chắc chắn duy nhất dù trùng mili-giây.
  const msgUniqueId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  msgDiv.innerHTML = buildAssistantHTML(msgUniqueId, formatMarkdown(markdownText), sourcesHtml, suggestionsHtml);
  area.appendChild(msgDiv);
  area.scrollTop = area.scrollHeight;

  if (shouldSave) {
    savedMessages.push({
      type: 'assistant',
      text: markdownText,
      sources,
      retrievedDocs,
      suggestions
    });
    saveChatToLocalStorage();
  }
}

async function streamAssistantMessage(markdownText, sources = [], retrievedDocs = [], suggestions = [], shouldSave = true) {
  const area = document.getElementById('rag-messages-area');
  if (!area) {
    appendAssistantMessage(markdownText, sources, retrievedDocs, suggestions, shouldSave);
    return;
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = 'rag-message assistant';

  let sourcesHtml = '';
  if (sources && sources.length > 0) {
    sourcesHtml = `
      <div class="rag-citation-box">
        <div class="rag-citation-header"><i class="fa-solid fa-bookmark text-primary"></i> Trích dẫn từ Bronze Storage:</div>
        <div>
          ${sources.map(s => `<span class="rag-source-tag" onclick="showSourceSnippet('${escapeHTML(s)}')"><i class="fa-solid fa-file-lines"></i> ${escapeHTML(s)}</span>`).join('')}
        </div>
      </div>
    `;
  }

  let suggestionsHtml = '';
  if (suggestions && suggestions.length > 0) {
    suggestionsHtml = `
      <div class="rag-suggestions-box mt-3 pt-2 border-top border-light-subtle">
        <div class="small fw-semibold text-primary mb-2" style="font-size: 11px;">
          <i class="fa-solid fa-wand-magic-sparkles me-1"></i> Câu hỏi gợi ý tiếp theo:
        </div>
        <div class="d-flex flex-wrap gap-2">
          ${suggestions.map(sugg => `
            <button type="button" class="btn btn-sm btn-light border rounded-pill text-start py-1 px-2 shadow-sm text-secondary" style="font-size: 11px; transition: all 0.2s;" onmouseover="this.classList.add('border-primary', 'text-primary')" onmouseout="this.classList.remove('border-primary', 'text-primary')" onclick="sendQuickPrompt('${escapeHTML(sugg)}')">
              <i class="fa-regular fa-comment-dots text-primary me-1"></i> ${escapeHTML(sugg)}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  // Date.now() (độ chính xác mili-giây) không đủ để đảm bảo duy nhất -- loadSavedRAGChat()
  // gọi appendAssistantMessage() liên tiếp trong 1 vòng forEach đồng bộ, trên máy nhanh 2
  // tin nhắn có thể sinh trong cùng 1 mili-giây, trùng id="msg-..." khiến
  // document.getElementById (copyMessageText) luôn trả về tin nhắn đầu tiên. Thêm hậu tố
  // ngẫu nhiên để chắc chắn duy nhất dù trùng mili-giây.
  const msgUniqueId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  msgDiv.innerHTML = buildAssistantHTML(msgUniqueId, `<span class="rag-typing-cursor"></span>`, '', '');
  area.appendChild(msgDiv);

  const textEl = msgDiv.querySelector(`#${msgUniqueId}`);
  const totalLength = markdownText.length;
  const chunkSize = totalLength > 1500 ? 12 : (totalLength > 600 ? 6 : 3);
  let currentIndex = 0;

  await new Promise((resolve) => {
    const interval = setInterval(() => {
      currentIndex += chunkSize;
      if (currentIndex >= totalLength) {
        currentIndex = totalLength;
        clearInterval(interval);
        // msgDiv.innerHTML ngay dưới thay THẲNG toàn bộ cây con chứa textEl -- gán
        // textEl.innerHTML riêng ở đây trước đó là công tính vô ích, bị ghi đè ngay lập
        // tức, không có tác dụng quan sát được nào. formatMarkdown(markdownText) chỉ cần
        // gọi 1 lần cho buildAssistantHTML() bên dưới.
        msgDiv.innerHTML = buildAssistantHTML(msgUniqueId, formatMarkdown(markdownText), sourcesHtml, suggestionsHtml);
        area.scrollTop = area.scrollHeight;
        resolve();
      } else {
        const currentSlice = markdownText.slice(0, currentIndex);
        if (textEl) {
          textEl.innerHTML = formatMarkdown(currentSlice) + `<span class="rag-typing-cursor"></span>`;
        }
        area.scrollTop = area.scrollHeight;
      }
    }, 15);
  });

  if (shouldSave) {
    savedMessages.push({
      type: 'assistant',
      text: markdownText,
      sources,
      retrievedDocs,
      suggestions
    });
    saveChatToLocalStorage();
  }
}

function copyMessageText(elementId, btn) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const text = el.innerText || el.textContent;
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      const origHtml = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check text-success" style="font-size: 12px;"></i>`;
      setTimeout(() => { btn.innerHTML = origHtml; }, 2000);
    }
  }).catch(() => {});
}

function appendAssistantLoadingMessage() {
  const area = document.getElementById('rag-messages-area');
  if (!area) return '';

  const id = `rag-loading-${Date.now()}`;
  const msgDiv = document.createElement('div');
  msgDiv.id = id;
  msgDiv.className = 'rag-message assistant';
  msgDiv.innerHTML = `
    <div class="rag-msg-avatar"><i class="fa-brands fa-google"></i></div>
    <div class="rag-msg-bubble">
      <div class="d-flex align-items-center gap-2 mb-1 text-primary small" style="font-size: 11px;">
        <i class="fa-solid fa-wand-magic-sparkles fa-spin"></i> Ciel đang phân tích...
      </div>
      <div class="rag-loading-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;

  area.appendChild(msgDiv);
  area.scrollTop = area.scrollHeight;
  return id;
}

function removeLoadingMessage(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function updateSendBtnState(loading) {
  const btn = document.getElementById('rag-send-btn');
  if (!btn) return;

  if (loading) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;
  } else {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-paper-plane"></i>`;
  }
}

function clearRAGChat() {
  ragChatHistory = [];
  savedMessages = [];
  try {
    localStorage.removeItem('workhub_rag_messages_v1');
    localStorage.removeItem('workhub_rag_history_v1');
  } catch (e) {}

  const area = document.getElementById('rag-messages-area');
  if (area) {
    area.innerHTML = `
      <div class="rag-message assistant">
        <div class="rag-msg-avatar"><i class="fa-brands fa-google"></i></div>
        <div class="rag-msg-bubble">
          Đã xóa lịch sử trò chuyện. Bạn có thể đặt câu hỏi mới về các tài liệu trong hệ thống!
        </div>
      </div>
    `;
  }
}

function renderQueryInspector(query, result) {
  const container = document.getElementById('rag-inspector-container');
  if (!container) return;

  const docs = result.retrieved_docs || [];
  if (docs.length === 0) {
    container.innerHTML = `<div class="text-muted small">Chưa có thông tin truy xuất.</div>`;
    return;
  }

  let html = `<div class="small fw-bold mb-2 text-secondary"><i class="fa-solid fa-magnifying-glass me-1"></i> Kết quả xếp hạng (${docs.length}):</div>`;

  docs.forEach((doc, idx) => {
    html += `
      <div class="rag-inspector-item">
        <div class="d-flex justify-content-between align-items-center mb-1">
          <span class="rag-inspector-doc-name text-truncate">#${idx + 1} ${escapeHTML(doc.display_name || doc.doc_id)}</span>
          <span class="badge bg-primary-subtle text-primary border" style="font-size: 10px;">${typeof doc.score === 'number' ? (doc.score * 100).toFixed(2) + ' pts' : 'N/A'}</span>
        </div>
        <div class="text-muted small" style="font-size: 11px; line-height: 1.4;">${escapeHTML(doc.text)}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

async function showSourceSnippet(docId) {
  if (typeof Swal === 'undefined') {
    alert(`Nguồn trích dẫn: ${docId}`);
    return;
  }

  Swal.fire({
    title: `<i class="fa-solid fa-file-lines text-primary me-2"></i> ${escapeHTML(docId)}`,
    html: `<div class="d-flex align-items-center justify-content-center p-4"><i class="fa-solid fa-spinner fa-spin fa-2x text-primary"></i> <span class="ms-2">Đang nạp toàn văn trang tài liệu...</span></div>`,
    showConfirmButton: false,
    width: '680px'
  });

  try {
    const res = await fetch(`${RAG_API_BASE}/api/documents/page?doc_id=${encodeURIComponent(docId)}`);
    if (!res.ok) throw new Error('Không thể nạp nội dung chi tiết');
    const data = await res.json();
    
    let contentText = data.text || 'Không có nội dung văn bản.';
    let highlightedHtml = escapeHTML(contentText);

    const activeQuestion = ragChatHistory && ragChatHistory.length > 0 
      ? ragChatHistory[ragChatHistory.length - (ragChatHistory[ragChatHistory.length - 1].role === 'user' ? 1 : 2)]?.content || ''
      : '';

    if (activeQuestion) {
      const words = activeQuestion.toLowerCase().split(/\s+/).filter(w => w.length > 2);
      words.forEach(w => {
        try {
          const reg = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          highlightedHtml = highlightedHtml.replace(reg, '<mark class="bg-warning-subtle text-dark px-1 rounded fw-semibold">$1</mark>');
        } catch (e) {}
      });
    }

    Swal.fire({
      title: `<div class="d-flex align-items-center gap-2"><i class="fa-solid fa-file-shield text-primary"></i> <span>${escapeHTML(data.display_name || docId)}</span></div>`,
      html: `
        <div class="text-start mb-2 small text-muted">
          <i class="fa-solid fa-circle-info text-info me-1"></i> Nội dung thực tế được trích từ tài liệu Bronze Storage:
        </div>
        <div class="text-start p-3 bg-light rounded font-monospace border" style="max-height: 420px; overflow-y: auto; font-size: 13px; line-height: 1.6; white-space: pre-wrap; word-break: break-word;">
          ${highlightedHtml}
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'Đóng',
      confirmButtonColor: '#2563eb',
      width: '720px'
    });
  } catch (err) {
    Swal.fire({
      title: `<i class="fa-solid fa-file-lines text-primary me-2"></i> ${escapeHTML(docId)}`,
      html: `<div class="text-start text-muted p-2">Trích xuất từ kho dữ liệu Bronze Storage.<br><small class="text-secondary fst-italic">(${escapeHTML(err.message)})</small></div>`,
      icon: 'info',
      confirmButtonText: 'Đóng'
    });
  }
}

function viewRAGDocumentDetail(docTitleEncoded, previewEncoded) {
  const title = decodeURIComponent(docTitleEncoded);
  const preview = decodeURIComponent(previewEncoded);

  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: `<i class="fa-solid fa-file-lines text-primary me-2"></i> ${escapeHTML(title)}`,
      html: `<div class="text-start p-3 bg-light rounded font-monospace" style="max-height: 300px; overflow-y: auto; font-size: 13px; white-space: pre-wrap;">${escapeHTML(preview)}</div>`,
      confirmButtonText: 'Đóng',
      width: '600px'
    });
  }
}

function formatMarkdown(text) {
  if (!text) return '';
  let escaped = escapeHTML(text);

  // Trích xuất khối code (```...```) ra TRƯỚC khi áp header/bold/italic/list bên dưới --
  // nếu không, ký tự markdown bên trong khối code (vd. 1 câu trả lời ghi ví dụ chứa
  // "**bold**" hay "# heading" ngay trong ```...```) bị các regex này "sửa" nhầm trước khi
  // khối code kịp được bọc <pre><code> nguyên vẹn. Thay tạm bằng placeholder, chèn lại
  // nguyên bản đã escapeHTML (từ dòng escaped = escapeHTML(text) ở trên) sau cùng.
  const codeBlocks = [];
  escaped = escaped.replace(/```([\s\S]*?)```/g, (match, code) => {
    codeBlocks.push(code);
    return ` CODEBLOCK${codeBlocks.length - 1} `;
  });

  escaped = escaped.replace(/^#### (.*$)/gim, '<h6 class="fw-bold mt-2 mb-1 text-primary">$1</h6>');
  escaped = escaped.replace(/^### (.*$)/gim, '<h5 class="fw-bold mt-3 mb-2 text-dark">$1</h5>');
  escaped = escaped.replace(/^## (.*$)/gim, '<h4 class="fw-bold mt-3 mb-2 text-dark">$1</h4>');

  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');

  escaped = escaped.replace(/`([^`]+)`/g, '<code class="p-1 rounded bg-secondary bg-opacity-10 text-danger font-monospace" style="font-size: 0.9em;">$1</code>');

  escaped = escaped.replace(/^---$/gim, '<hr class="my-2 border-secondary opacity-25">');

  escaped = escaped.replace(/^\s*[\-\*]\s+(.*)$/gm, '<li style="margin-left: 18px; margin-bottom: 4px;">$1</li>');
  escaped = escaped.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<li style="margin-left: 18px; margin-bottom: 4px;" value="$1">$2</li>');

  escaped = escaped.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

  escaped = escaped.replace(/ CODEBLOCK(\d+) /g, (match, idx) =>
    `<pre class="p-2 bg-dark text-light rounded font-monospace my-2" style="font-size: 12px; overflow-x: auto;"><code>${codeBlocks[Number(idx)]}</code></pre>`
  );

  return escaped;
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportRAGChat(format = 'markdown') {
  if (!savedMessages || savedMessages.length === 0) {
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        title: 'Chưa có nội dung',
        text: 'Lịch sử hội thoại hiện đang trống để có thể xuất file.',
        icon: 'warning',
        confirmButtonText: 'Đã hiểu'
      });
    } else {
      alert('Lịch sử hội thoại hiện đang trống.');
    }
    return;
  }

  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filenameBase = `WorkHub_RAG_Chat_${timestamp}`;

  if (format === 'markdown') {
    let mdContent = `# Báo Cáo Hội Thoại Tri Thức - WorkHub RAG (Ciel AI)\n`;
    mdContent += `*Thời gian xuất:* ${new Date().toLocaleString('vi-VN')}\n\n---\n\n`;

    savedMessages.forEach((msg, idx) => {
      if (msg.type === 'user') {
        mdContent += `### 👤 Người dùng:\n${msg.text}\n\n`;
      } else {
        mdContent += `### 🧠 Ciel (AI Assistant):\n${msg.text}\n\n`;
        if (msg.sources && msg.sources.length > 0) {
          mdContent += `> **Trích dẫn nguồn:** ${msg.sources.join(', ')}\n\n`;
        }
        if (msg.suggestions && msg.suggestions.length > 0) {
          mdContent += `*Câu hỏi gợi ý:* ${msg.suggestions.join(' | ')}\n\n`;
        }
      }
      mdContent += `---\n\n`;
    });

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filenameBase}.md`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else if (format === 'txt') {
    let txtContent = `========================================================\nBÁO CÁO HỘI THOẠI TRI THỨC WORKHUB (CIEL AI)\nThời gian xuất: ${new Date().toLocaleString('vi-VN')}\n========================================================\n\n`;

    savedMessages.forEach((msg) => {
      if (msg.type === 'user') {
        txtContent += `[NGƯỜI DÙNG]:\n${msg.text}\n\n`;
      } else {
        txtContent += `[CIEL AI]:\n${msg.text}\n`;
        if (msg.sources && msg.sources.length > 0) {
          txtContent += `[NGUỒN TRÍCH DẪN]: ${msg.sources.join(', ')}\n`;
        }
        txtContent += `\n--------------------------------------------------------\n\n`;
      }
    });

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filenameBase}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else if (format === 'print') {
    let existingPrintDiv = document.getElementById('rag-print-container');
    if (!existingPrintDiv) {
      existingPrintDiv = document.createElement('div');
      existingPrintDiv.id = 'rag-print-container';
      document.body.appendChild(existingPrintDiv);
    }

    let printHtml = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
        <h2 style="color: #b45309; border-bottom: 2px solid #b45309; padding-bottom: 8px;">WorkHub - Báo Cáo Truy Xuất Tri Thức (Ciel AI)</h2>
        <p style="font-size: 12px; color: #666;">Ngày in: ${new Date().toLocaleString('vi-VN')}</p>
        <hr style="margin-bottom: 20px;">
    `;

    savedMessages.forEach((msg) => {
      if (msg.type === 'user') {
        printHtml += `
          <div style="margin-bottom: 14px; background: #fef3c7; padding: 10px 14px; border-radius: 6px; border-left: 4px solid #d97706;">
            <strong>👤 Người dùng:</strong>
            <p style="margin: 4px 0 0 0; white-space: pre-wrap;">${escapeHTML(msg.text)}</p>
          </div>
        `;
      } else {
        printHtml += `
          <div style="margin-bottom: 18px; background: #f8fafc; padding: 12px 14px; border-radius: 6px; border-left: 4px solid #2563eb; border: 1px solid #e2e8f0;">
            <strong style="color: #1d4ed8;">🧠 Ciel (AI):</strong>
            <div style="margin-top: 6px;">${formatMarkdown(msg.text)}</div>
            ${msg.sources && msg.sources.length > 0 ? `<div style="font-size: 11px; color: #475569; margin-top: 8px;"><b>Nguồn trích dẫn:</b> ${escapeHTML(msg.sources.join(', '))}</div>` : ''}
          </div>
        `;
      }
    });

    printHtml += `</div>`;
    existingPrintDiv.innerHTML = printHtml;

    const cleanupPrint = () => {
      if (existingPrintDiv && existingPrintDiv.parentNode) {
        existingPrintDiv.parentNode.removeChild(existingPrintDiv);
      }
      window.removeEventListener('afterprint', cleanupPrint);
    };

    window.addEventListener('afterprint', cleanupPrint);
    setTimeout(() => { cleanupPrint(); }, 3000);

    window.print();
  }
}
