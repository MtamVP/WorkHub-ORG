let RAG_API_BASE = 'https://workhub-org.onrender.com';
let isRAGConnected = false;
let isGenerating = false;

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

  checkRAGServerStatus();
}

function cleanDocumentTitle(rawName) {
  if (!rawName) return '';
  // 1. Tách phần chunk/page nếu có (ví dụ: doc.pdf#Trang_1)
  let name = rawName.split('#')[0];
  // 2. Cắt bỏ mã số ngẫu nhiên đằng trước do Supabase gắn (ví dụ: F_1786160737664260_ hoặc 1786160737664260_)
  name = name.replace(/^(?:F_)?\d{10,20}_?/i, '');
  // 3. Xử lý các từ tiếng Việt (cả dạng bị sanitize _ và dạng không dấu)
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
  
  // 4. Xóa đuôi file nếu cần lấy tên thuần
  name = name.replace(/\.(pdf|docx?|xlsx?|csv|txt|json)$/i, '');
  // 5. Thay thế các dấu gạch dưới còn lại thành khoảng trắng và xóa khoảng trắng thừa
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

async function syncBronzeStorage() {
  const syncBtn = document.getElementById('rag-sync-storage-btn');
  const originalText = syncBtn ? syncBtn.innerHTML : '';
  
  if (syncBtn) {
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

    if (typeof showToast === 'function') {
      showToast(data.message || 'Đã đồng bộ dữ liệu Bronze Storage', 'success');
    }
    
    checkRAGServerStatus();
  } catch (err) {
    if (typeof showToast === 'function') {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  } finally {
    if (syncBtn) {
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

      html += `
        <div class="rag-doc-item" onclick="viewRAGDocumentDetail('${encodeURIComponent(displayName)}', '${encodeURIComponent(doc.preview || '')}')">
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
      <span class="text-muted small align-self-center me-1"><i class="fa-solid fa-lightbulb text-warning"></i> Gợi ý:</span>
      <span class="text-muted small align-self-center fst-italic">Chưa có tài liệu. Nhấn <b>"Đồng bộ dữ liệu"</b> để tạo câu hỏi gợi ý.</span>
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

  const topDocs = topDocsSelect ? parseInt(topDocsSelect.value, 10) : 3;
  const useLLM = useLlmCheckbox ? useLlmCheckbox.checked : false;

  appendUserMessage(question);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  const loadingMsgId = appendAssistantLoadingMessage();
  isGenerating = true;
  updateSendBtnState(true);

  try {
    const res = await fetch(`${RAG_API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: question,
        top_docs: topDocs,
        use_llm: useLLM
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.detail || `Lỗi ${res.status}`);
    }

    const data = await res.json();
    const result = data.data;

    removeLoadingMessage(loadingMsgId);
    appendAssistantMessage(result.answer, result.sources, result.retrieved_docs);

    renderQueryInspector(question, result);
  } catch (err) {
    removeLoadingMessage(loadingMsgId);
    appendAssistantMessage(`Không thể kết nối đến máy chủ (${err.message}). Vui lòng kiểm tra lại RAG Server.`);
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

function appendUserMessage(text) {
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
}

function appendAssistantMessage(markdownText, sources = [], retrievedDocs = []) {
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

  msgDiv.innerHTML = `
    <div class="rag-msg-avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="rag-msg-bubble">
      <div class="rag-markdown-content">${formatMarkdown(markdownText)}</div>
      ${sourcesHtml}
    </div>
  `;
  area.appendChild(msgDiv);
  area.scrollTop = area.scrollHeight;
}

function appendAssistantLoadingMessage() {
  const area = document.getElementById('rag-messages-area');
  if (!area) return null;

  const loadingId = 'rag-loading-' + Date.now();
  const msgDiv = document.createElement('div');
  msgDiv.className = 'rag-message assistant';
  msgDiv.id = loadingId;
  msgDiv.innerHTML = `
    <div class="rag-msg-avatar"><i class="fa-solid fa-robot"></i></div>
    <div class="rag-msg-bubble text-muted">
      <i class="fa-solid fa-spinner fa-spin me-2 text-primary"></i> Đang tìm kiếm thông tin...
    </div>
  `;
  area.appendChild(msgDiv);
  area.scrollTop = area.scrollHeight;
  return loadingId;
}

function removeLoadingMessage(id) {
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

function updateSendBtnState(loading) {
  const btn = document.getElementById('rag-send-btn');
  if (!btn) return;
  btn.disabled = loading;
  btn.innerHTML = loading ? `<i class="fa-solid fa-spinner fa-spin"></i>` : `<i class="fa-solid fa-paper-plane"></i>`;
}

function clearRAGChat() {
  const area = document.getElementById('rag-messages-area');
  if (!area) return;
  area.innerHTML = `
    <div class="rag-message assistant">
      <div class="rag-msg-avatar"><i class="fa-solid fa-robot"></i></div>
      <div class="rag-msg-bubble">
        Xin chào! Tôi là Trợ lý AI WorkHub.<br>
        Tôi có thể hỗ trợ bạn tra cứu, tóm tắt và phân tích dữ liệu từ tài liệu lưu trữ nội bộ một cách nhanh chóng và chính xác.
      </div>
    </div>
  `;
}

function renderQueryInspector(question, result) {
  const container = document.getElementById('rag-inspector-container');
  if (!container) return;

  if (!result || !result.retrieved_docs || result.retrieved_docs.length === 0) {
    container.innerHTML = `<div class="text-muted small">Chưa có dữ liệu truy vấn.</div>`;
    return;
  }

  let html = `
    <div class="small mb-2"><b>Câu hỏi:</b> <span class="text-primary">${escapeHTML(question)}</span></div>
    <div class="small mb-2"><b>Tài liệu ưu tiên:</b> <span class="badge bg-success">${escapeHTML(result.best_doc_id || 'N/A')}</span></div>
    <hr style="margin: 8px 0; border-color: var(--border-light);">
    <div class="fw-bold small mb-2"><i class="fa-solid fa-chart-simple text-primary me-1"></i> Kết quả:</div>
  `;

  result.retrieved_docs.forEach((doc, idx) => {
    const docName = doc.display_name || cleanDocumentTitle(doc.doc_id);
    html += `
      <div class="p-2 mb-2 rounded" style="background: var(--hover-bg); border: 1px solid var(--border-light); font-size: 11px;">
        <div class="d-flex justify-content-between font-monospace fw-bold text-primary mb-1">
          <span>#${idx + 1} ${escapeHTML(docName)}</span>
          <span class="text-success">${Math.round((doc.score || 0) * 1000) / 10}%</span>
        </div>
        <div class="text-muted text-truncate" title="${escapeHTML(doc.text || '')}">${escapeHTML(doc.text || '')}</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function showSourceSnippet(docId) {
  if (typeof Swal !== 'undefined') {
    Swal.fire({
      title: `<i class="fa-solid fa-file-lines text-primary me-2"></i> ${escapeHTML(docId)}`,
      text: `Trích xuất từ kho dữ liệu Bronze Storage.`,
      icon: 'info',
      confirmButtonText: 'Đóng'
    });
  } else {
    alert(`Nguồn: ${docId}`);
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

  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/\*(.*?)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/`([^`]+)`/g, '<code class="p-1 rounded bg-secondary bg-opacity-10 text-danger font-monospace" style="font-size: 0.9em;">$1</code>');
  escaped = escaped.replace(/^\s*-\s+(.*)$/gm, '<li style="margin-left: 18px;">$1</li>');
  escaped = escaped.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

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
