/**
 * 1.Configuration for GAS API Calls
 */
//  CẤU HÌNH ĐƯỜNG DẪN (CLOUDFLARE PAGES) 
const BASE_URL = window.location.origin;
const URL_DASHBOARD = BASE_URL + "/";              // Trang chủ
const URL_FINANCE = BASE_URL + "/finance/";      // Vào thư mục finance (tự chạy index.html)
const URL_SCIENCE = BASE_URL + "/science/";      // Vào thư mục science (tự chạy index.html)

function goToLogin() {
    window.location.href = BASE_URL + "/";
}

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCCCIzKdnvslSrvknrl0eQH1cL8_upv1PI",
    authDomain: "workhub-ai-2d5aa.firebaseapp.com",
    projectId: "workhub-ai-2d5aa",
    storageBucket: "workhub-ai-2d5aa.firebasestorage.app",
    messagingSenderId: "703705936779",
    appId: "1:703705936779:web:b800246feea1f3e3cf358e",
    measurementId: "G-BH6MVD3TLV"
};

//  Global Variables 
let currentView = 'dashboard';

let activeGroup = (typeof CURRENT_GROUP_KEY !== 'undefined') ? CURRENT_GROUP_KEY : 'all';

// Firebase Init
let app = null;
let auth = null;
let db = null;

if (typeof firebase !== 'undefined') {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
}

//  Calendar Global Variables 
let currentCalendarType = 'group';
let selectedDate = new Date();
let todayEventList;
let manageEventBtn, deleteEventBtn, addEventBtn, eventForm;
let eventModalDefaultTitleHTML = null;
let eventModalDefaultSubmitHTML = null;
let selectedEventId = null;
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();

//  Progress & Task Global Variables 
let updateBtn, barsContainer, msgDiv, progressListDisplay;
let projectSelect, progressNameInput, progressNoteInput, progressSearchInput;
let progressSortSelect, progressTableBody, progressProjectFilter;
let taskProjectSelect, taskForm;

/**
 * 2. HÀM CHUNG DÙNG CHO NHIỀU MODULE
 */

function switchGroup(groupName) {
    if (groupName === 'finance') window.location.href = URL_FINANCE;
    else if (groupName === 'science') window.location.href = URL_SCIENCE;
    else window.location.href = URL_DASHBOARD;
}

//  2.1 Hàm tải dữ liệu Dashboard
async function loadDashboardDataSecurely() {
    if (!chatUser) return;
    console.log("Đang tải dữ liệu cho nhóm:", activeGroup);

    try {
        const response = await callGAS("getRecentFilesForDashboard", { groupKey: activeGroup });

        if (response.status === "success") {
            const files = response.data;
            if (typeof renderFileStats === 'function') renderFileStats(files);
            if (typeof renderRecentFiles === 'function') renderRecentFiles(files.slice(0, 9));
        } else {
            console.error("Lỗi tải file dashboard:", response.message);
        }
    } catch (error) {
        console.error("Lỗi mạng khi tải dashboard:", error);
    }

    if (typeof loadCalendarData === 'function') loadCalendarData();
    if (typeof loadDashboardTopProgress === 'function') loadDashboardTopProgress();
}

//  2.2 Hàm Online Status 
function setupPresenceSystem(user) {
    if (!user) return;
    if (window.onlineInterval) clearInterval(window.onlineInterval);
    window.onlineInterval = setInterval(() => {
    }, 120000);
}

//  2.3 Hàm dọn dẹp dữ liệu Dashboard khi logout
function clearDashboardData() {
    console.log("Đang dọn dẹp dữ liệu Dashboard...");

    const loginMsg = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted p-4">
            <i class="fa-solid fa-lock fa-2x mb-2"></i>
            <small>Vui lòng đăng nhập</small>
        </div>`;

    const calendarWidget = document.getElementById('today-calendar-view');
    if (calendarWidget) {
        calendarWidget.innerHTML = loginMsg;
        calendarWidget.removeAttribute('data-loaded');
    }

    const progressWidget = document.getElementById('project-progress-view');
    if (progressWidget) {
        progressWidget.innerHTML = loginMsg;
    }

    const pinWidget = document.getElementById('chat-pin-view');
    if (pinWidget) pinWidget.innerHTML = loginMsg;

    const fileWidget = document.getElementById('myfiles-list-view');
    if (fileWidget) fileWidget.innerHTML = loginMsg;

    const statsIds = ['word-cnt', 'excel-cnt', 'pdf-cnt', 'image-cnt', 'pptx-cnt', 'zip-cnt', 'total-cnt'];
    statsIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = '0';
    });
}


function showToast(message, type = 'success') {
    alert(message);
    if (type === 'error') {
        console.error("TOAST ERROR:", message);
    }
}

function showModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show-modal');
    }
}

function hideModal(id) {
    const modal = document.getElementById(id);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show-modal');
    }
}
/**
 * GIAO DIỆN SÁNG/TỐI TỰ ĐỘNG
 */

const ICON_SUN = 'fa-sun';
const ICON_MOON = 'fa-moon';

// Cấu hình giờ: Tối từ 18h chiều đến 6h sáng
const START_NIGHT_HOUR = 18;
const END_NIGHT_HOUR = 6;

// Hàm kiểm tra xem bây giờ có phải ban đêm không
function isNightTime() {
    const hour = new Date().getHours();
    return (hour >= START_NIGHT_HOUR || hour < END_NIGHT_HOUR);
}

// Hàm cập nhật giao diện 
function updateThemeUI(isDark) {
    const toggleBtn = document.getElementById('theme-toggle-btn');
    const autoBtn = document.getElementById('auto-theme-btn');

    if (toggleBtn) {
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            if (isDark) {
                icon.classList.remove(ICON_MOON);
                icon.classList.add(ICON_SUN);
            } else {
                icon.classList.remove(ICON_SUN);
                icon.classList.add(ICON_MOON);
            }
        }
    }

    if (autoBtn) {
        const currentSetting = localStorage.getItem('user-theme');
        if (currentSetting === 'auto' || !currentSetting) {
            autoBtn.classList.remove('btn-outline-primary');
            autoBtn.classList.add('btn-primary');
            if (toggleBtn) toggleBtn.style.opacity = '0.6';
        } else {
            autoBtn.classList.remove('btn-primary');
            autoBtn.classList.add('btn-outline-primary');
            if (toggleBtn) toggleBtn.style.opacity = '1';
        }
    }
}
// Hàm Áp dụng Theme 
function applyTheme() {
    const savedTheme = localStorage.getItem('user-theme');
    let themeToApply = 'light'; // Mặc định

    // Case 1: Chế độ Auto 
    if (savedTheme === 'auto' || !savedTheme) {
        themeToApply = isNightTime() ? 'dark' : 'light';
        if (!savedTheme) localStorage.setItem('user-theme', 'auto');
    }
    // Case 2: Chế độ Thủ công 
    else {
        themeToApply = savedTheme;
    }

    // Thực hiện đổi attribute trên HTML
    document.documentElement.setAttribute('data-theme', themeToApply);
    updateThemeUI(themeToApply === 'dark');
}

// Hàm khi bấm nút 
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = (currentTheme === 'dark') ? 'light' : 'dark';

    localStorage.setItem('user-theme', newTheme);
    applyTheme();
}

// Hàm khi bấm nút Auto
function setAutoMode() {
    localStorage.setItem('user-theme', 'auto');
    applyTheme();

    showToast('Đã bật Auto Mode', 'success');
}

(function initTheme() {
    applyTheme();
})();


/**
 * Background changer functions
 */

// Hàm xử lý khi người dùng chọn ảnh từ máy
function handleBackgroundUpload(input) {
    if (input.files && input.files[0]) {
        var file = input.files[0];

        // An toàn ở mức 800KB cho base64
        if (file.size > 800 * 1024) {
            showToast("Ảnh quá nặng (>800KB)! Vui lòng nén ảnh hoặc chọn ảnh nhẹ hơn.", "error");
            return;
        }

        var reader = new FileReader();
        reader.onload = async function (e) {
            var imageData = e.target.result;
            try {
                const userEmail = localStorage.getItem('userEmail') || "Admin";
                await API.settings.updateSetting('global_theme', imageData, userEmail);
                showToast("Đã đổi hình nền cho tất cả thành viên!");
                applyCustomBackground(imageData);
            } catch (error) {
                console.error("Lỗi khi lưu ảnh:", error);
                showToast("Lỗi: " + error.message, "error");
            }
        }
        reader.readAsDataURL(file);
    }
}

// Hàm áp dụng hình nền vào CSS Variable
function applyCustomBackground(imageUrl) {
    var finalValue = imageUrl.startsWith('url') ? imageUrl : "url('" + imageUrl + "')";
    document.documentElement.style.setProperty('--main-bg-image', finalValue);
}

// Hàm Reset về mặc định 
function resetBackground() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const popupBg = isDark ? '#1e1e1e' : '#fff';
    const popupColor = isDark ? '#e0e0e0' : '#545454';

    Swal.fire({
        title: 'Khôi phục nền mặc định?',
        text: "Hành động này sẽ xóa hình nền của tất cả thành viên!",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa đi!',
        cancelButtonText: 'Hủy bỏ',
        background: popupBg,
        color: popupColor
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang xử lý...',
                allowOutsideClick: false,
                background: popupBg,
                color: popupColor,
                didOpen: () => Swal.showLoading()
            });

            try {
                const userEmail = localStorage.getItem('userEmail') || "Admin";
                await API.settings.updateSetting('global_theme', '', userEmail);
                document.documentElement.style.removeProperty('--main-bg-image');
                
                Swal.fire({
                    title: 'Đã xóa!',
                    text: 'Giao diện đã trở về mặc định.',
                    icon: 'success',
                    background: popupBg,
                    color: popupColor
                });
            } catch (error) {
                Swal.fire({
                    title: 'Lỗi!',
                    text: error.message,
                    icon: 'error',
                    background: popupBg,
                    color: popupColor
                });
            }
        }
    });
}

async function initGlobalBackgroundListener() {
    try {
        const imageUrl = await API.settings.getSetting('global_theme');
        if (imageUrl) applyCustomBackground(imageUrl);
        else document.documentElement.style.removeProperty('--main-bg-image');
    } catch(e) {
        console.warn("Chưa tải được hình nền", e);
    }
}
/**
 * 3. DRIVE FILE MANAGEMENT FUNCTIONS
 */

function handleUploadSuccess(message) {
    const uploadStatus = document.getElementById('upload-status');
    const submitUploadBtn = document.getElementById('submit-upload-btn');
    const fileNameDisplay = document.getElementById('file-name-display');
    const descriptionTextarea = document.querySelector('#upload-file-form textarea[name="description"]');

    uploadStatus.className = 'status-message success-message';

    let content = message;
    if (typeof message === 'object' && message !== null) {
        content = message.message || message.data || JSON.stringify(message);
    }
    uploadStatus.textContent = content;

    submitUploadBtn.disabled = false;
    submitUploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Tải Lên Drive';

    if (descriptionTextarea) descriptionTextarea.value = '';

    const fileInput = document.getElementById('file-input');
    if (fileInput) fileInput.value = '';
    if (fileNameDisplay) fileNameDisplay.textContent = ' (Chưa có file nào)';

    loadFileList(false);
}

function handleUploadFailure(error) {
    const uploadStatus = document.getElementById('upload-status');
    const submitUploadBtn = document.getElementById('submit-upload-btn');

    uploadStatus.className = 'status-message error-message';

    let errorMsg = error;
    if (typeof error === 'object' && error !== null) {
        errorMsg = error.message || error.error || error.data || JSON.stringify(error);
    }

    uploadStatus.textContent = 'Lỗi tải lên: ' + errorMsg;

    submitUploadBtn.disabled = false;
    submitUploadBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Tải Lên Drive';
}

function populateUploaderFilter(fileData) {
    const filterUploader = document.getElementById('filter-uploader');
    if (!filterUploader) return;

    const uploaderEmails = new Set();
    if (Array.isArray(fileData)) {
        fileData.forEach(file => {
            if (file.uploader) uploaderEmails.add(file.uploader);
        });
    }

    filterUploader.innerHTML = '<option value="">Tất cả Người Tải</option>';
    uploaderEmails.forEach(email => {
        const option = document.createElement('option');
        option.value = email;
        option.textContent = email.split('@')[0];
        filterUploader.appendChild(option);
    });
}

async function loadFileList(isFiltering = false) {
    const fileTableBody = document.querySelector('#file-table tbody');
    if (!fileTableBody) return;

    const searchInput = document.getElementById('search-name');
    const filterSelect = document.getElementById('filter-type');
    const filterUploaderSelect = document.getElementById('filter-uploader');
    const filterDateInput = document.getElementById('filter-date');
    const filterSortSelect = document.getElementById('filter-sort');

    const filters = {
        searchName: searchInput ? searchInput.value : '',
        mimeType: filterSelect ? filterSelect.value : '',
        uploader: filterUploaderSelect ? filterUploaderSelect.value : '',
        date: filterDateInput ? filterDateInput.value : '',
        sortBy: filterSortSelect ? filterSortSelect.value : 'date_desc'
    };

    console.log("Đang gửi bộ lọc:", filters);

    fileTableBody.innerHTML = '<tr><td class="text-center" colspan="7"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</td></tr>';

    try {
        const response = await callGAS("getFileList", {
            ...filters,
            groupKey: activeGroup
        });

        if (response.status === "success") {
            const fileData = response.data;

            if (!isFiltering) {
                populateUploaderFilter(fileData);
            }

            // Render bảng
            if (typeof renderFileTable === 'function') {
                renderFileTable(fileData);
            }

            if (typeof renderFileStats === 'function') {
                renderFileStats(fileData);
            }

        } else {
            if (typeof handleFileLoadFailure === 'function') {
                handleFileLoadFailure(response.message);
            } else {
                fileTableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Lỗi: ${response.message}</td></tr>`;
            }
        }
    } catch (error) {
        console.error("Lỗi tải file:", error);
        fileTableBody.innerHTML = `<tr><td colspan="7" class="text-danger text-center">Lỗi kết nối server!</td></tr>`;
    }
}

function renderFileTable(fileData) {
    const fileTableBody = document.querySelector('#file-table tbody');
    const fileTableHeadRow = document.querySelector('#file-table thead tr');

    if (!fileTableBody || !fileTableHeadRow) return;

    fileTableBody.innerHTML = '';

    let headerHTML = '<th>Tên File</th><th>Đường dẫn</th><th>Mô tả</th>';

    if (typeof activeGroup !== 'undefined' && activeGroup === 'all') {
        headerHTML += '<th class="text-center">Nhóm</th>';
    }

    headerHTML += '<th>Người Tải</th><th>Ngày Tải</th><th class="text-center">Xem</th>';

    if (typeof activeGroup !== 'undefined' && activeGroup !== 'all') {
        headerHTML += '<th class="text-center">Share</th>';
    }

    headerHTML += '<th class="text-center">Xóa</th>';

    fileTableHeadRow.innerHTML = headerHTML;

    if (fileData.length === 0) {
        const colCount = fileTableHeadRow.children.length;
        fileTableBody.innerHTML = `<tr><td colspan="${colCount}" class="text-center text-muted">Không tìm thấy tài liệu nào phù hợp.</td></tr>`;
        return;
    }

    fileData.forEach(file => {
        const row = fileTableBody.insertRow();

        // Cột 1: Tên
        row.insertCell().textContent = file.name;
        
        // Cột mới: Đường dẫn
        row.insertCell().textContent = file.folderPath || '/';

        // Cột 2: Mô tả
        row.insertCell().textContent = file.description;

        // Cột 3: Cột nhóm chỉ ở dashboard chung
        if (typeof activeGroup !== 'undefined' && activeGroup === 'all') {
            const groupCell = row.insertCell();
            groupCell.className = 'text-center';

            // Tạo màu sắc cho bagde dễ nhìn
            let badgeClass = 'bg-secondary'; // xám 
            let groupLabel = 'General';

            if (file.groupKey === 'finance') {
                badgeClass = 'bg-warning text-dark'; // Vàng
                groupLabel = 'Finance';
            } else if (file.groupKey === 'science') {
                badgeClass = 'bg-info text-dark'; // Xanh Cyan
                groupLabel = 'Science';
            }

            groupCell.innerHTML = `<span class="badge ${badgeClass}" style="font-size: 0.8em;">${groupLabel}</span>`;
        }

        // Cột 4: Người tải
        row.insertCell().textContent = file.uploader.split('@')[0];

        // Cột 5: Ngày tải
        row.insertCell().textContent = file.date;

        // Cột 6: Xem
        const viewCell = row.insertCell();
        viewCell.classList.add('action-cell', 'text-center');
        const viewLink = document.createElement('a');
        viewLink.href = file.url;
        viewLink.target = '_blank';
        viewLink.title = 'Xem file';
        viewLink.innerHTML = '<i class="fa-solid fa-eye action-view"></i>';
        viewCell.appendChild(viewLink);

        // Cột 7: cột share chỉ ở trang nhóm
        if (typeof activeGroup !== 'undefined' && activeGroup !== 'all') {
            const shareCell = row.insertCell();
            shareCell.classList.add('action-cell', 'text-center');

            const shareBtn = document.createElement('button');
            shareBtn.style.border = 'none';
            shareBtn.style.background = 'none';
            shareBtn.style.cursor = 'pointer';

            shareBtn.onclick = () => shareFileAction(file.id, file.name);

            if (file.isShared) {
                shareBtn.innerHTML = '<i class="fa-solid fa-circle-check text-success" style="font-size: 1.2em;"></i>';
                shareBtn.title = 'Đã chia sẻ. Bấm để Tải Lên Lại (Tạo bản sao mới)';
            } else {
                shareBtn.innerHTML = '<i class="fa-solid fa-share-from-square text-primary" style="font-size: 1.1em;"></i>';
                shareBtn.title = 'Tải lên Drive Chung';
            }

            shareCell.appendChild(shareBtn);
        }

        // Cột 8: Xóa
        const deleteCell = row.insertCell();
        deleteCell.classList.add('action-cell', 'text-center');
        const deleteBtn = document.createElement('button');
        deleteBtn.title = 'Xóa file';
        deleteBtn.style.border = 'none';
        deleteBtn.style.background = 'none';
        deleteBtn.style.cursor = 'pointer';
        deleteBtn.innerHTML = '<i class="fa-solid fa-trash action-delete text-danger"></i>';
        deleteBtn.onclick = () => deleteFileAction(file.id, file.name);
        deleteCell.appendChild(deleteBtn);
    });
}
function handleFileLoadFailure(error) {
    const fileTableBody = document.querySelector('#file-table tbody');
    if (fileTableBody) {
        let msg = error;
        if (typeof error === 'object' && error !== null) {
            msg = error.message || error.data || JSON.stringify(error);
        }

        fileTableBody.innerHTML = `<tr><td colspan="8" style="color: var(--danger-color); text-align: center;">Lỗi tải dữ liệu: ${msg}</td></tr>`;
    }
    console.error('Lỗi Drive API:', error);
}

function handleDeleteSuccess(message) {
    console.log(message);
    if (typeof loadFileList === 'function') loadFileList(false);
    showToast(message);
}

function handleDeleteFailure(error) {
    console.error("Lỗi xóa file:", error);

    let msg = error;
    if (typeof error === 'object' && error !== null) {
        msg = error.message || error.data || JSON.stringify(error);
    }

    showToast("Lỗi xóa file: " + msg, 'error');
}
function deleteFileAction(fileId, fileName) {
    Swal.fire({
        title: 'Xóa File?',
        text: `Bạn có chắc muốn xóa file "${fileName}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa đi người ae',
        cancelButtonText: 'Nghĩ lại òi!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang xóa...',
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS("deleteFile", {
                    fileId: fileId,
                    groupKey: activeGroup
                });

                Swal.close();

                if (response.status === "success") {
                    handleDeleteSuccess(response.data);
                } else {
                    handleDeleteFailure({ message: response.message || response.data });
                }
            } catch (err) {
                Swal.close();
                handleDeleteFailure(err);
            }
        }
    });
}
function renderRecentFiles(fileData) {
    const fileView = document.getElementById('myfiles-list-view');
    if (!fileView) return;

    if (!fileData || fileData.length === 0) {
        fileView.innerHTML = '<p class="text-secondary">Chưa có tài liệu nào được tải lên.</p>';
        return;
    }

    let html = '<ul style="list-style: none; padding: 0;">';
    fileData.forEach(file => {
        const fileNameLower = (file.name || '').toLowerCase();

        let icon = 'fa-file';
        if (fileNameLower.endsWith('.pdf')) icon = 'fa-file-pdf';
        else if (fileNameLower.endsWith('.docx')) icon = 'fa-file-word';
        else if (fileNameLower.endsWith('.xlsx')) icon = 'fa-file-excel';
        else if (fileNameLower.endsWith('.pptx')) icon = 'fa-file-powerpoint';
        else if (file.mimeType && file.mimeType.includes('image/')) icon = 'fa-file-image';
        else if (fileNameLower.endsWith('.zip') || fileNameLower.endsWith('.rar')) icon = 'fa-file-zipper';

        html += `
            <li style="display: flex; align-items: center; margin-bottom: 8px;">
                <i class="fa-solid ${icon} me-2" style="color: var(--info-color);"></i>
                <a href="${file.url}" target="_blank" title="${file.name}">
                    ${file.name}
                </a>
            </li>`;
    });
    html += '</ul>';
    fileView.innerHTML = html;
}

function renderFileStats(fileData) {
    if (!Array.isArray(fileData)) {
        console.error("Dữ liệu không phải là mảng:", fileData);
        return;
    }
    const totalFiles = fileData.length;
    console.log(`Tổng số file nhận được: ${totalFiles}`);

    const stats = fileData.reduce((acc, file, index) => {
        if (!file) {
            console.warn(`File ${index} là null hoặc undefined, bỏ qua.`);
            return acc;
        }

        // Chuẩn hóa dữ liệu đầu vào để tránh lỗi undefined
        const mime = file.mimeType || file.mime_type || file.type || file.fileType || '';
        const fileName = file.name || file.title || 'Không rõ tên';
        const fileNameLower = fileName.toLowerCase();

        if (mime.includes('pdf') || fileNameLower.endsWith('.pdf')) {
            acc.pdf++;
        }
        else if (
            mime.includes('word') ||
            mime.includes('google-apps.document') ||
            fileNameLower.endsWith('.doc') ||
            fileNameLower.endsWith('.docx')
        ) {
            acc.word++;
        }
        else if (
            mime.includes('spreadsheet') ||
            mime.includes('excel') ||
            mime.includes('google-apps.spreadsheet') ||
            fileNameLower.endsWith('.xls') ||
            fileNameLower.endsWith('.xlsx')
        ) {
            acc.excel++;
        }
        else if (
            mime.includes('image/') ||
            /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(fileNameLower)
        ) {
            acc.image++;
        }
        else if (
            mime.includes('presentation') ||
            mime.includes('powerpoint') ||
            mime.includes('google-apps.presentation') ||
            fileNameLower.endsWith('.ppt') ||
            fileNameLower.endsWith('.pptx')
        ) {
            acc.pptx++;
        }
        else if (
            mime.includes('zip') ||
            mime.includes('rar') ||
            fileNameLower.endsWith('.zip') ||
            fileNameLower.endsWith('.rar')
        ) {
            acc.zip++;
        }

        return acc;
    }, { pdf: 0, word: 0, excel: 0, image: 0, pptx: 0, zip: 0 });

    console.log("Kết quả thống kê:", stats);

    const setContent = (id, count) => {
        const el = document.getElementById(id);
        if (el) el.textContent = count;
    };

    setContent('word-cnt', stats.word);
    setContent('excel-cnt', stats.excel);
    setContent('pdf-cnt', stats.pdf);
    setContent('image-cnt', stats.image);
    setContent('pptx-cnt', stats.pptx);
    setContent('zip-cnt', stats.zip);
    setContent('total-cnt', totalFiles);
}

function resetAndLoadDrive() {
    const inputs = [
        'search-name',
        'filter-type',
        'filter-uploader',
        'filter-date'
    ];

    inputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = ''; // Reset về rỗng
    });

    const sortEl = document.getElementById('filter-sort');
    if (sortEl) sortEl.value = 'date_desc';

    loadFileList(false);
}

function shareFileAction(fileId, fileName) {
    Swal.fire({
        title: 'Chia sẻ file?',
        html: `Bạn muốn tải file <b>"${fileName}"</b> lên Drive Chung?<br>
                <small class="text-muted">Tất cả thành viên sẽ nhìn thấy file này.</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6', // Màu xanh
        cancelButtonColor: '#d33',
        confirmButtonText: 'Chia sẻ cho thầyy đi!',
        cancelButtonText: 'Nghĩ lại òi!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Loading
            Swal.fire({
                title: 'Đang xử lý...',
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS("shareFile", {
                    fileId: fileId,
                    groupKey: activeGroup
                });

                if (response.status === "success") {
                    Swal.fire('Thành công!', response.data, 'success');
                    loadFileList(false);
                } else {
                    Swal.fire('Lỗi!', response.message || "Lỗi không xác định", 'error');
                }
            } catch (err) {
                Swal.fire('Lỗi kết nối!', err.message || err, 'error');
            }
        }
    });
}

/**
 * 4. CALENDAR MANAGEMENT FUNCTIONS
 */
let currentCalendarDate = new Date(); // Tháng đang hiển thị
let currentMonthEvents = []; // Cache sự kiện của cả tháng để vẽ chấm

// hàm load data cho lịch
async function loadCalendarData() {
    const calendarToggle = document.getElementById('calendar-toggle');
    if (calendarToggle) currentCalendarType = calendarToggle.value;

    // 1. Vẽ khung lịch 
    renderCalendarGrid(currentCalendarDate);

    // 2. Cập nhật tiêu đề ngày đang chọn bên sidebar
    updateSelectedDateHeader();

    // 3. Hiển thị loading bên sidebar
    const listContainer = document.getElementById('today-event-list');
    if (listContainer) listContainer.innerHTML = '<div class="text-center text-muted mt-4"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</div>';

    // 4. Tính toán khoảng thời gian tới thời điểm hiện tại
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0, 23, 59, 59);

    try {
        const response = await callGAS('getEvents', {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            calendarType: currentCalendarType,
            groupKey: activeGroup,
            email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
        });

        if (response.status === 'success') {
            const events = response.data;
            currentMonthEvents = events; // Lưu vào biến toàn cục            
            // Vẽ các chấm sự kiện lên lịch
            renderEventDots();

            // Hiển thị danh sách sự kiện của ngày đang chọn
            renderEventsForSelectedDate();

            // Cập nhật Dashboard tới hôm nay
            renderDashboardCalendar(events);

        } else {
            handleCalendarError(response.message);
        }
    } catch (error) {
        handleCalendarError(error);
    }
}

// hàm vẽ khung lịch
function renderCalendarGrid(date) {
    const container = document.getElementById('full-calendar-display');
    if (!container) return;

    const year = date.getFullYear();
    const month = date.getMonth();
    const monthNames = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];

    let html = `
        <div class="calendar-header">
            <button class="btn-nav-month" onclick="changeMonth(-1)"><i class="fa-solid fa-chevron-left"></i></button>
            <h2>${monthNames[month]} ${year}</h2>
            <button class="btn-nav-month" onclick="changeMonth(1)"><i class="fa-solid fa-chevron-right"></i></button>
        </div>
        <div class="calendar-grid">
            <div class="calendar-day-name">CN</div>
            <div class="calendar-day-name">T2</div>
            <div class="calendar-day-name">T3</div>
            <div class="calendar-day-name">T4</div>
            <div class="calendar-day-name">T5</div>
            <div class="calendar-day-name">T6</div>
            <div class="calendar-day-name">T7</div>
    `;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
        html += `<div class="calendar-day other-month"></div>`;
    }

    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        let isToday = (day === today.getDate() && month === today.getMonth() && year === today.getFullYear()) ? 'today' : '';
        let isSelected = (day === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear()) ? 'selected' : '';
        let dateId = `day-${year}-${month}-${day}`;

        html += `
            <div class="calendar-day ${isToday} ${isSelected}" id="${dateId}" onclick="selectDate(${year}, ${month}, ${day})">
                <span>${day}</span>
                <div class="event-dot"></div>
            </div>
        `;
    }
    html += `</div>`;
    container.innerHTML = html;
}

// hàm vẽ chấm đỏ thông báo ngày đó có sự kiện
function renderEventDots() {
    if (!currentMonthEvents || currentMonthEvents.length === 0) return;

    currentMonthEvents.forEach(event => {
        const d = new Date(event.startTime);
        // Chỉ vẽ chấm nếu sự kiện thuộc tháng đang hiển thị
        if (d.getMonth() === currentCalendarDate.getMonth() && d.getFullYear() === currentCalendarDate.getFullYear()) {
            const dayId = `day-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            const dayEl = document.getElementById(dayId);
            if (dayEl) dayEl.classList.add('has-event');
        }
    });
}

//  hàm click chọn ngày
window.selectDate = function (year, month, day) {
    selectedDate = new Date(year, month, day);

    const oldSelected = document.querySelector('.calendar-day.selected');
    if (oldSelected) oldSelected.classList.remove('selected');

    const newSelected = document.getElementById(`day-${year}-${month}-${day}`);
    if (newSelected) newSelected.classList.add('selected');

    updateSelectedDateHeader();
    renderEventsForSelectedDate();
};

window.changeMonth = function (step) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + step);
    loadCalendarData();
};

//  hàm hiển thị sự kiện bên sidebar
function updateSelectedDateHeader() {
    const widgetTitle = document.querySelector('.today-events-widget h3');
    if (widgetTitle) {
        const dateStr = selectedDate.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' });
        widgetTitle.innerHTML = `${dateStr}`;
    }
}

function renderEventsForSelectedDate() {
    const listContainer = document.getElementById('today-event-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    selectedEventId = null; // Reset selection

    // Lọc sự kiện của ngày được chọn
    const dailyEvents = currentMonthEvents.filter(e => {
        const d = new Date(e.startTime);
        return d.getDate() === selectedDate.getDate() &&
            d.getMonth() === selectedDate.getMonth() &&
            d.getFullYear() === selectedDate.getFullYear();
    });

    // Sắp xếp theo giờ
    dailyEvents.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    if (dailyEvents.length === 0) {
        listContainer.innerHTML = '<p class="text-muted text-center mt-3">Không có sự kiện nào.</p>';
        if (manageEventBtn) manageEventBtn.disabled = true;
        return;
    }

    dailyEvents.forEach(event => {
        // Task có due_date được gộp vào lịch dưới dạng mục riêng — render khác hẳn sự kiện thật
        if (event.type === 'task') {
            const taskDiv = document.createElement('div');
            taskDiv.className = 'event-item task-event-item';
            taskDiv.innerHTML =
                '<div class="event-title"><i class="fa-solid fa-list-check me-1"></i>' + escapeHtml(event.title) + '</div>' +
                '<div class="small text-muted mb-1"><i class="fa-solid fa-diagram-project me-1"></i>' + escapeHtml(event.projectName || '') + '</div>' +
                '<div class="event-meta">' + (typeof renderBadge === 'function' ? renderBadge('status', event.status) : escapeHtml(event.status || '')) + '</div>';
            taskDiv.addEventListener('click', () => {
                if (typeof goToTaskInProject === 'function') goToTaskInProject(event.projectId);
            });
            listContainer.appendChild(taskDiv);
            return;
        }

        const timeStr = new Date(event.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const endTimeStr = new Date(event.endTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const isImportant = event.isImportant ? 'important' : '';

        const div = document.createElement('div');
        div.className = `event-item ${isImportant}`;
        div.setAttribute('data-id', event.id);
        div.setAttribute('data-important', event.isImportant);

        const recurrenceLabel = { daily: 'Lặp hằng ngày', weekly: 'Lặp hằng tuần', monthly: 'Lặp hằng tháng' }[event.recurrence];
        const attendeeCount = (event.attendees || '').split(',').map(x => x.trim()).filter(Boolean).length;

        div.innerHTML =
            '<div class="event-time">' + timeStr + ' - ' + endTimeStr + '</div>' +

            '<div class="event-title">' + event.title + (recurrenceLabel ? ' <i class="fa-solid fa-rotate text-muted" style="font-size:0.75em;" title="' + recurrenceLabel + '"></i>' : '') + '</div>' +

            (event.description ? '<div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 5px; font-style: italic;">' + event.description + '</div>' : '') +

            '<div class="event-meta">' +
            (event.location ? '<span><i class="fa-solid fa-location-dot"></i> ' + event.location + '</span>' : '') +
            (attendeeCount > 0 ? '<span><i class="fa-solid fa-user-group"></i> ' + attendeeCount + '</span>' : '') +
            '</div>' +

            '<button class="btn-edit-event-mini" title="Sửa" onclick="openEditEvent(\'' + event.id + '\', event)">' +
            '<i class="fa-solid fa-pen"></i>' +
            '</button>' +

            '<button class="btn-delete-event-mini" title="Xóa" onclick="quickDeleteEvent(\'' + event.id + '\', \'' + event.title + '\', event)">' +
            '<i class="fa-solid fa-trash"></i>' +
            '</button>';

        div.addEventListener('click', () => {
            document.querySelectorAll('.event-item').forEach(el => el.style.borderRight = 'none');
            div.style.borderRight = '4px solid #333';
            selectedEventId = event.id;

            if (manageEventBtn) {
                manageEventBtn.disabled = false;
                manageEventBtn.innerHTML = event.isImportant
                    ? '<i class="fa-solid fa-star-half"></i> Bỏ quan trọng'
                    : '<i class="fa-solid fa-star"></i> Đánh dấu quan trọng';
            }
        });

        listContainer.appendChild(div);
    });
}

// hàm ẩn/hiện ô "Lặp đến ngày" theo lựa chọn lặp lại
function toggleRecurrenceEndVisibility() {
    const sel = document.getElementById('event-recurrence');
    const group = document.getElementById('recurrence-end-group');
    if (!sel || !group) return;
    group.style.display = sel.value === 'none' ? 'none' : 'block';
}

// hàm toggle danh sách checkbox mời thành viên
let eventAttendeesExpanded = false;
function showEventAttendeeCheckboxes() {
    const box = document.getElementById('event-attendee-checkboxes');
    if (!box) return;
    eventAttendeesExpanded = !eventAttendeesExpanded;
    box.style.display = eventAttendeesExpanded ? 'block' : 'none';
}

// hàm tải danh sách checkbox thành viên để mời vào sự kiện
async function loadEventAttendeeCheckboxes() {
    const container = document.getElementById('event-attendee-checkboxes');
    if (!container) return;
    container.innerHTML = '<div class="p-2 small text-muted">Đang tải...</div>';

    try {
        const response = await callGAS("getAllUsers", { groupKey: activeGroup });
        if (response.status === 'success') {
            const users = response.data;
            container.innerHTML = '';

            if (!users || users.length === 0) {
                container.innerHTML = '<div class="p-2 small text-muted">Chưa có thành viên.</div>';
                return;
            }

            users.forEach(u => {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.padding = '5px 10px';
                label.style.cursor = 'pointer';
                label.onmouseover = function () { this.style.backgroundColor = '#f1f1f1'; };
                label.onmouseout = function () { this.style.backgroundColor = 'transparent'; };

                label.innerHTML = `<input type="checkbox" name="event-attendees" value="${escapeHtml(u.email)}" style="margin-right:8px;" /> ${escapeHtml(u.name)}`;
                container.appendChild(label);
            });
        } else {
            container.innerHTML = `<div class="text-danger p-2 small">Lỗi: ${response.message}</div>`;
        }
    } catch (err) {
        console.error("Lỗi tải danh sách mời:", err);
        container.innerHTML = `<div class="text-danger p-2 small">Lỗi kết nối server!</div>`;
    }
}

// hàm khôi phục modal về trạng thái "Tạo mới" (xóa dấu vết lần sửa trước đó)
function resetEventModalUI() {
    document.getElementById('event-id').value = '';

    const modalTitle = document.getElementById('event-modal-title');
    if (modalTitle && eventModalDefaultTitleHTML !== null) modalTitle.innerHTML = eventModalDefaultTitleHTML;

    const submitBtn = eventForm ? eventForm.querySelector('button[type="submit"]') : null;
    if (submitBtn && eventModalDefaultSubmitHTML !== null) submitBtn.innerHTML = eventModalDefaultSubmitHTML;

    document.querySelectorAll('input[name="event-attendees"]').forEach(cb => cb.checked = false);
    toggleRecurrenceEndVisibility();
}

// hàm mở modal ở chế độ sửa sự kiện đã có
window.openEditEvent = function (id, e) {
    if (e && e.stopPropagation) e.stopPropagation();

    const event = (currentMonthEvents || []).find(ev => ev.id === id);
    if (!event) return;

    const start = new Date(event.startTime);
    const end = new Date(event.endTime);
    const pad = n => String(n).padStart(2, '0');
    const toDateStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const toTimeStr = d => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

    document.getElementById('event-id').value = event.id;
    document.getElementById('event-title').value = event.title || '';
    document.getElementById('start-date').value = toDateStr(start);
    document.getElementById('start-time').value = toTimeStr(start);
    document.getElementById('end-date').value = toDateStr(end);
    document.getElementById('end-time').value = toTimeStr(end);
    document.getElementById('location').value = event.location || '';
    document.getElementById('description').value = event.description || '';

    const recurrenceSel = document.getElementById('event-recurrence');
    if (recurrenceSel) recurrenceSel.value = event.recurrence || 'none';
    const recurrenceEndInput = document.getElementById('event-recurrence-end');
    if (recurrenceEndInput) recurrenceEndInput.value = event.recurrenceEnd || '';
    toggleRecurrenceEndVisibility();

    const attendeeEmails = (event.attendees || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    document.querySelectorAll('input[name="event-attendees"]').forEach(cb => {
        cb.checked = attendeeEmails.includes(cb.value.toLowerCase());
    });

    const modalTitle = document.getElementById('event-modal-title');
    if (modalTitle) modalTitle.innerHTML = '<i class="fa-solid fa-pen me-2"></i> Sửa Sự Kiện';

    const submitBtn = eventForm ? eventForm.querySelector('button[type="submit"]') : null;
    if (submitBtn) submitBtn.innerHTML = 'Cập Nhật';

    showModal('add-event-modal');
};

// hàm xóa sự kiện
window.quickDeleteEvent = function (id, title, e) {
    if (e && e.stopPropagation) e.stopPropagation();

    Swal.fire({
        title: 'Xóa nhanh?',
        text: `Bạn muốn xóa sự kiện "${title}" ngay lập tức?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa đi người ae',
        cancelButtonText: 'Nghĩ lại òi'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang xóa...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS('deleteEvent', {
                    eventId: id,
                    calendarType: currentCalendarType,
                    groupKey: activeGroup,
                    email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
                });

                if (response.status !== 'success') {
                    throw new Error(response.message || "Xóa thất bại từ phía Server");
                }

                Swal.fire({
                    icon: 'success',
                    title: 'Đã xóa!',
                    text: response.message,
                    showConfirmButton: false,
                    timer: 1000
                });

                loadCalendarData();

                if (typeof selectedEventId !== 'undefined' && selectedEventId === id) {
                    selectedEventId = null;
                    const deleteBtn = document.getElementById('delete-event-btn');
                    if (deleteBtn) deleteBtn.disabled = true;
                }

            } catch (err) {
                Swal.fire('Lỗi!', err.message || err, 'error');
            }
        }
    });
};


// hàm thông báo lỗi
function handleCalendarError(error) {
    console.error(error);
    showToast('Lỗi lịch: ' + error.message);
}

// hàm hiển thị sự kiện ở trang dashboard 
function renderDashboardCalendar(events) {
    if (!chatUser) return;

    // Tìm element widget ở trang Dashboard
    const container = document.getElementById('today-calendar-view');
    if (!container) return;
    const today = new Date();
    const todayEvents = events.filter(e => {
        const d = new Date(e.startTime);
        return d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear();
    });

    // Sắp xếp sự kiện quan trọng lên đầu
    todayEvents.sort((a, b) => (b.isImportant === true) - (a.isImportant === true));

    if (todayEvents.length === 0) {
        container.innerHTML = `
            <div class="text-center text-muted py-3">
                    <i class="fa-regular fa-calendar-check fa-2x mb-2"></i>
                    <p class="m-0">Hôm nay không có lịch hehe!</p>
            </div>`;
        return;
    }

    let html = `<ul style="list-style: none; padding: 0; margin: 0;">`;

    const displayLimit = 4;
    const itemsToShow = todayEvents.slice(0, displayLimit);

    itemsToShow.forEach(e => {
        const time = e.type === 'task' ? 'Hạn chót' : new Date(e.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const iconColor = e.isImportant ? 'var(--danger-color)' : 'var(--info-color)';
        const bgColor = e.isImportant ? 'color-mix(in srgb, var(--danger-color) 15%, var(--card-bg))' : 'color-mix(in srgb, var(--info-color) 15%, var(--card-bg))';
        const iconClass = e.type === 'task' ? 'fa-list-check' : (e.isImportant ? 'fa-star' : 'fa-circle');

        html += `
            <li style="background: ${bgColor}; padding: 8px 12px; border-radius: 6px; margin-bottom: 6px; border-left: 3px solid ${iconColor}; display: flex; align-items: center;">
                <i class="fa-solid ${iconClass}" style="color: ${iconColor}; font-size: 0.7em; margin-right: 10px;"></i>
                <div style="flex: 1; overflow: hidden;">
                    <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(e.title)}</div>
                    <div style="font-size: 0.8rem; color: var(--text-secondary);">${time}</div>
                </div>
            </li>
        `;
    });

    if (todayEvents.length > displayLimit) {
        html += `<li class="text-center text-muted small mt-1">+ Còn ${todayEvents.length - displayLimit} sự kiện nữa...</li>`;
    }

    html += `</ul>`;
    container.innerHTML = html;
}
window.showToast = function (message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    let content = message;
    if (typeof message === 'object' && message !== null) {
        content = message.message || message.data || JSON.stringify(message);
    }
    // 

    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;

    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-xmark';
    const iconColor = type === 'success' ? '#2ecc71' : '#dc3545';

    toast.innerHTML = `
        <div style="display:flex; align-items:center;">
            <i class="fa-solid ${icon}" style="color: ${iconColor}"></i>
            <span>${escapeHtml(content)}</span>
        </div>
        <i class="fa-solid fa-xmark close-toast" onclick="this.parentElement.remove()"></i>
    `;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'fadeOutRight 0.5s ease forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
};


/**
 * 5. PROJECT MANAGEMENT FUNCTIONS
 */

let currentTaskProjectID = null;
// Bảng Tiến độ đang xem dự án đang chạy hay dự án đã lưu trữ
let showArchivedProjects = false;
// Cache toàn bộ dự án đã fetch lần gần nhất — để lọc/sắp xếp ở client mà không cần
// gọi lại API mỗi khi đổi dropdown filter/sort (trước đây loadProgressList() tự fetch riêng).
let globalAllProjects = [];

async function loadProjectOverview() {
    const tableBody = document.getElementById('progress-table-body');
    const taskDropdown = document.getElementById('task-project-select');
    const createDropdown = document.getElementById('project-select');
    const filterProjectDropdown = document.getElementById('progress-project-filter');
    const filterOwnerDropdown = document.getElementById('progress-search-input');

    // Biến xác định trang
    const isGeneralPage = (typeof activeGroup !== 'undefined' && activeGroup === 'all');
    const colSpanCount = 7;

    // Nếu là trang riêng -> Đổi "Nhóm" thành "Chia sẻ" ở header bảng
    const tableHead = document.querySelector('#progress-table thead tr');
    if (tableHead && tableHead.cells.length >= 4) {
        tableHead.cells[3].innerHTML = isGeneralPage ? 'Nhóm' : 'Chia sẻ';
    }

    // 2. UI Loading
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="${colSpanCount}" class="text-center" style="padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Đang cập nhật dữ liệu...</td></tr>`;

    // Reset Dropdowns tạm thời
    const loadingOpt = '<option value="">-- Đang tải... --</option>';
    if (taskDropdown) taskDropdown.innerHTML = loadingOpt;
    if (createDropdown) createDropdown.innerHTML = loadingOpt;
    if (filterProjectDropdown) filterProjectDropdown.innerHTML = loadingOpt;
    if (filterOwnerDropdown) filterOwnerDropdown.innerHTML = loadingOpt;

    try {
        const response = await callGAS("getProjectList", {
            filters: {},
            groupKey: activeGroup,
            archiveScope: showArchivedProjects ? 'archived' : 'active'
        });

        if (response.status === 'success') {
            globalAllProjects = response.data || [];

            // Reset UI
            if (taskDropdown) taskDropdown.innerHTML = '<option value="">-- Chọn Dự Án để xem Task --</option>';
            if (createDropdown) createDropdown.innerHTML = '<option value="">-- Chọn Dự án đã có hoặc Nhập mới --</option>';
            if (filterProjectDropdown) filterProjectDropdown.innerHTML = '<option value="">-- Tất cả dự án --</option>';
            if (filterOwnerDropdown) filterOwnerDropdown.innerHTML = '<option value="">-- Tất cả người tạo --</option>';

            if (!globalAllProjects.length) {
                if (tableBody) tableBody.innerHTML = `<tr><td colspan="${colSpanCount}" class="text-center text-muted">Chưa có dự án nào.</td></tr>`;
                if (typeof loadMemberCheckboxes === 'function') loadMemberCheckboxes();
                return;
            }

            // Nạp option cho dropdown lọc theo người tạo / theo dự án
            const uniqueOwners = [...new Set(globalAllProjects.map(p => p.owner))].sort();
            if (filterOwnerDropdown) {
                uniqueOwners.forEach(owner => {
                    const opt = document.createElement('option');
                    opt.value = owner; opt.textContent = owner;
                    filterOwnerDropdown.appendChild(opt);
                });
            }
            const uniqueNames = [...new Set(globalAllProjects.map(p => p.name))].sort();
            if (filterProjectDropdown) {
                uniqueNames.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name; opt.textContent = name;
                    filterProjectDropdown.appendChild(opt);
                });
            }

            // Nạp option cho dropdown chọn dự án (Task / Tạo mới)
            globalAllProjects.forEach(p => {
                if (taskDropdown) { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; taskDropdown.appendChild(opt); }
                if (createDropdown) { const opt = document.createElement('option'); opt.value = p.id; opt.textContent = p.name; createDropdown.appendChild(opt); }
            });

            // Restore selection
            if (currentTaskProjectID && taskDropdown) {
                const exists = Array.from(taskDropdown.options).some(o => o.value === currentTaskProjectID);
                if (exists) taskDropdown.value = currentTaskProjectID;
            }

            // Load danh sách thành viên
            if (typeof loadMemberCheckboxes === 'function') loadMemberCheckboxes();
            else if (typeof loadGroupMembers === 'function') loadGroupMembers();

            // Vẽ bảng theo filter/sort hiện tại của UI
            renderProgressTable();

        } else {
            if (tableBody) tableBody.innerHTML = `<tr><td colspan="${colSpanCount}" class="text-danger text-center">Lỗi Server: ${response.message}</td></tr>`;
        }

    } catch (err) {
        console.error("Lỗi tải dự án:", err);
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="${colSpanCount}" class="text-danger text-center">Lỗi kết nối: ${err.message}</td></tr>`;
    }
}

// Vẽ lại bảng Tiến độ từ cache (globalAllProjects) theo filter/sort đang chọn trên UI —
// KHÔNG gọi API, dùng cho các sự kiện đổi filter/sort để tránh fetch lại toàn bộ mỗi lần bấm.
function renderProgressTable() {
    const tableBody = document.getElementById('progress-table-body');
    if (!tableBody) return;

    const isGeneralPage = (typeof activeGroup !== 'undefined' && activeGroup === 'all');
    const colSpanCount = 7;

    const filterOwnerDropdown = document.getElementById('progress-search-input');
    const filterProjectDropdown = document.getElementById('progress-project-filter');
    const sortSelect = document.getElementById('progress-sort-select');

    const filterOwner = filterOwnerDropdown ? filterOwnerDropdown.value : "";
    const filterProject = filterProjectDropdown ? filterProjectDropdown.value : "";
    const sortVal = sortSelect ? sortSelect.value : "date_desc";

    let projects = (globalAllProjects || []).filter(p => {
        const matchOwner = !filterOwner || p.owner === filterOwner;
        const matchProject = !filterProject || p.name === filterProject;
        return matchOwner && matchProject;
    });

    if (sortVal === 'percent_desc') {
        projects.sort((a, b) => (b.percent || 0) - (a.percent || 0));
    } else if (sortVal === 'percent_asc') {
        projects.sort((a, b) => (a.percent || 0) - (b.percent || 0));
    } else if (sortVal === 'date_asc') {
        projects.sort((a, b) => new Date(a.created_at || a.lastUpdated || 0) - new Date(b.created_at || b.lastUpdated || 0));
    } else {
        projects.sort((a, b) => new Date(b.created_at || b.lastUpdated || 0) - new Date(a.created_at || a.lastUpdated || 0));
    }

    if (!projects.length) {
        tableBody.innerHTML = `<tr><td colspan="${colSpanCount}" class="text-center text-muted">Không tìm thấy kết quả phù hợp.</td></tr>`;
        return;
    }

    tableBody.innerHTML = '';
    projects.forEach(p => {
        const row = tableBody.insertRow();
        let centerColContent = '';

        const safeName = escapeHtml(p.name);
        const safeNameArg = escapeHtml(escapeJs(p.name));
        const safeIdArg = escapeHtml(escapeJs(p.id));

        if (isGeneralPage) {
            // Hiện badge nhóm ở trang chung
            let badgeClass = 'bg-secondary';
            let groupLabel = 'General';
            if (p.originGroup === 'finance') { badgeClass = 'bg-warning text-dark'; groupLabel = 'Finance'; }
            else if (p.originGroup === 'science') { badgeClass = 'bg-info text-dark'; groupLabel = 'Science'; }
            centerColContent = `<span class="badge ${badgeClass}">${groupLabel}</span>`;
        } else {
            // Hiện nút chia sẻ ở trang nhóm
            if (p.isShared === true || p.isShared === 'true') {
                centerColContent = `<button class="btn btn-sm border-0" onclick="shareProjectAction('${safeIdArg}', '${safeNameArg}')" title="Đã chia sẻ. Bấm để share lại."><i class="fa-solid fa-circle-check text-success" style="font-size: 1.2em;"></i></button>`;
            } else {
                centerColContent = `<button class="btn btn-sm border-0" onclick="shareProjectAction('${safeIdArg}', '${safeNameArg}')" title="Chia sẻ sang Dashboard Chung"><i class="fa-solid fa-share-from-square text-primary" style="font-size: 1.2em;"></i></button>`;
            }
        }

        const statusBadge = p.status
            ? `<span class="badge bg-secondary ms-1" style="font-size: 0.65rem; vertical-align: middle;">${escapeHtml(p.status)}</span>`
            : '';

        let overdueBadge = '';
        if (p.overdueCount > 0) {
            overdueBadge = `<span class="due-badge overdue" title="${p.overdueCount} công việc quá hạn"><i class="fa-solid fa-triangle-exclamation"></i> ${p.overdueCount}</span>`;
        } else if (p.dueSoonCount > 0) {
            overdueBadge = `<span class="due-badge due-soon" title="${p.dueSoonCount} công việc sắp đến hạn"><i class="fa-regular fa-clock"></i> ${p.dueSoonCount}</span>`;
        }

        row.innerHTML = `
            <td class="fw-bold text-primary">${safeName}${statusBadge}${overdueBadge}</td>
            <td>
                <div class="progress" style="height: 20px; background-color: var(--hover-bg);">
                    <div class="progress-bar ${getProgressBarColor(p.percent)}" role="progressbar"
                        style="width: ${p.percent}%;" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100">
                        ${p.percent}%
                    </div>
                </div>
            </td>
            <td class="small text-muted">${escapeHtml(p.description || '')}</td>
            <td class="text-center">${centerColContent}</td>
            <td class="small">${escapeHtml(p.lastUpdated)}</td>
            <td class="small fw-bold">${escapeHtml(p.owner)}</td>
            <td class="text-center text-nowrap">
                <button class="btn btn-sm text-secondary border-0" onclick="toggleProjectArchive('${safeIdArg}', '${safeNameArg}', ${p.archivedAt ? 'false' : 'true'})" title="${p.archivedAt ? 'Đưa trở lại danh sách đang chạy' : 'Lưu trữ dự án'}">
                    <i class="fa-solid ${p.archivedAt ? 'fa-box-open' : 'fa-box-archive'}"></i>
                </button>
                <button class="btn btn-sm text-warning border-0" onclick="openMilestonesModal('${safeIdArg}', '${safeNameArg}')" title="Cột mốc dự án">
                    <i class="fa-solid fa-flag-checkered"></i>
                </button>
                <button class="btn btn-sm text-info border-0" onclick="openBurndownModal('${safeIdArg}', '${safeNameArg}')" title="Biểu đồ tiến độ">
                    <i class="fa-solid fa-chart-line"></i>
                </button>
                <button class="btn btn-sm text-danger border-0" onclick="deleteProjectAction('${safeIdArg}', '${safeNameArg}')" title="Xóa Dự Án">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
    });
}

// Alias: dùng sau khi dữ liệu đã đổi ở server (xóa/share/tạo/cập nhật) — fetch lại từ đầu
// rồi vẽ lại. Giữ tên cũ để không phải sửa mọi nơi đang gọi loadProgressList().
async function loadProgressList() {
    return loadProjectOverview();
}

//  XUẤT CSV
// Bọc ô theo chuẩn RFC 4180: nếu chứa dấu phẩy, nháy kép hay xuống dòng thì bao trong nháy
// kép và nhân đôi nháy kép bên trong. Không làm vậy thì mô tả có dấu phẩy sẽ vỡ cả cột.
function csvCell(value) {
    const s = String(value === null || value === undefined ? '' : value);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadCsv(filename, rows) {
    const body = rows.map(r => r.map(csvCell).join(',')).join('\r\n');
    // BOM UTF-8: thiếu nó thì Excel trên Windows đọc tiếng Việt thành ký tự lạ
    const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function stamp() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function exportProjectsCsv() {
    const projects = globalAllProjects || [];
    if (projects.length === 0) { showToast('Không có dự án nào để xuất.', 'error'); return; }

    const rows = [['Tên dự án', 'Trạng thái', 'Tiến độ (%)', 'Mô tả', 'Chủ dự án', 'Quá hạn', 'Sắp đến hạn', 'Cập nhật lần cuối', 'Lưu trữ']];
    projects.forEach(p => rows.push([
        p.name, p.status || '', p.percent || 0, p.description || '', p.owner || '',
        p.overdueCount || 0, p.dueSoonCount || 0, p.lastUpdated || '', p.archivedAt ? 'Có' : ''
    ]));

    downloadCsv(`du-an-${stamp()}.csv`, rows);
    showToast(`Đã xuất ${projects.length} dự án.`, 'success');
}

function exportTasksCsv() {
    const tasks = globalAllTasks || [];
    if (tasks.length === 0) { showToast('Không có công việc nào để xuất.', 'error'); return; }

    const nameById = {};
    (globalAllTasks || []).forEach(t => { nameById[t.id] = t.name; });

    const rows = [['Tên công việc', 'Trạng thái', 'Ưu tiên', 'Hạn chót', 'Người thực hiện', 'Nhãn', 'Mô tả', 'Thuộc việc cha', 'Bị chặn bởi', 'Danh sách kiểm']];
    tasks.forEach(t => {
        const list = Array.isArray(t.checklist) ? t.checklist : [];
        const blockerNames = String(t.blocked_by || '').split(',').map(x => x.trim()).filter(Boolean)
            .map(id => nameById[id] || id).join('; ');
        rows.push([
            t.name, t.status || '', t.priority || '', t.dueDate || '',
            (t.assigneeNames || []).join('; ') || t.assignees || '',
            t.labels || '', t.description || '',
            t.parent_task_id ? (nameById[t.parent_task_id] || t.parent_task_id) : '',
            blockerNames,
            list.length ? `${list.filter(x => x.done).length}/${list.length}` : ''
        ]);
    });

    downloadCsv(`cong-viec-${stamp()}.csv`, rows);
    showToast(`Đã xuất ${tasks.length} công việc.`, 'success');
}

//  LƯU TRỮ DỰ ÁN
async function toggleProjectArchive(projectId, projectName, archive) {
    try {
        const response = await callGAS('setProjectArchived', { projectId, archived: archive, groupKey: activeGroup });
        if (response.status !== 'success') throw new Error(response.message);
        showToast(response.data || response.message, 'success');
        if (typeof loadProjectOverview === 'function') loadProjectOverview();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

function toggleArchivedProjectsView() {
    showArchivedProjects = !showArchivedProjects;
    const btn = document.getElementById('toggle-archived-btn');
    if (btn) {
        btn.classList.toggle('active', showArchivedProjects);
        btn.innerHTML = showArchivedProjects
            ? '<i class="fa-solid fa-box-open me-1"></i> Đang xem: Kho lưu trữ'
            : '<i class="fa-solid fa-box-archive me-1"></i> Xem kho lưu trữ';
    }
    if (typeof loadProjectOverview === 'function') loadProjectOverview();
}

//  CỘT MỐC DỰ ÁN (MILESTONES)
let currentMilestoneProjectId = null;

function openMilestonesModal(projectId, projectName) {
    currentMilestoneProjectId = projectId;
    const nameEl = document.getElementById('milestones-project-name');
    if (nameEl) nameEl.textContent = projectName;
    showModal('milestones-modal');
    loadMilestones(projectId);
}

async function loadMilestones(projectId) {
    const list = document.getElementById('milestone-list');
    if (!list) return;
    list.innerHTML = '<div class="p-2 text-muted small">Đang tải...</div>';
    try {
        const response = await callGAS('getMilestones', { projectId });
        if (response.status !== 'success') throw new Error(response.message);
        const milestones = response.data || [];
        if (milestones.length === 0) {
            list.innerHTML = '<div class="p-2 text-muted small">Chưa có cột mốc nào.</div>';
            return;
        }
        list.innerHTML = milestones.map(m => {
            const dateStr = m.target_date ? new Date(m.target_date + 'T00:00:00').toLocaleDateString('vi-VN') : '';
            return `<div class="milestone-item ${m.is_done ? 'milestone-done' : ''}">
                <label class="d-flex align-items-center gap-2 flex-grow-1" style="cursor:pointer; margin:0;">
                    <input type="checkbox" ${m.is_done ? 'checked' : ''} onchange="toggleMilestoneStatus('${m.id}', this.checked)">
                    <span class="milestone-title">${escapeHtml(m.title)}</span>
                    ${dateStr ? `<span class="text-muted small ms-auto">${dateStr}</span>` : ''}
                </label>
                <button class="btn btn-sm text-danger border-0" onclick="deleteMilestoneAction('${m.id}')" title="Xóa">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>`;
        }).join('');
    } catch (err) {
        list.innerHTML = `<div class="text-danger small p-2">Lỗi: ${err.message}</div>`;
    }
}

async function toggleMilestoneStatus(milestoneId, isDone) {
    try {
        const response = await callGAS('toggleMilestone', { milestoneId, isDone });
        if (response.status !== 'success') throw new Error(response.message);
        loadMilestones(currentMilestoneProjectId);
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

async function deleteMilestoneAction(milestoneId) {
    try {
        const response = await callGAS('deleteMilestone', { milestoneId });
        if (response.status !== 'success') throw new Error(response.message);
        loadMilestones(currentMilestoneProjectId);
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

//  BIỂU ĐỒ TIẾN ĐỘ (BURNDOWN, xấp xỉ từ updated_at của task Done)
let burndownChartInstance = null;

async function openBurndownModal(projectId, projectName) {
    const nameEl = document.getElementById('burndown-project-name');
    if (nameEl) nameEl.textContent = projectName;
    showModal('burndown-modal');

    const canvas = document.getElementById('burndown-chart-canvas');
    if (!canvas) return;

    try {
        const response = await callGAS('getBurndownData', { projectId });
        if (response.status !== 'success') throw new Error(response.message);
        const tasks = response.data || [];

        if (tasks.length === 0 || typeof Chart === 'undefined') {
            if (burndownChartInstance) { burndownChartInstance.destroy(); burndownChartInstance = null; }
            return;
        }

        // Trục ngày: từ ngày tạo task sớm nhất tới hôm nay
        const allDates = tasks.map(t => new Date(t.created_at));
        let cursor = new Date(Math.min(...allDates));
        cursor.setHours(0, 0, 0, 0);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const labels = [];
        const totalSeries = [];
        const doneSeries = [];

        while (cursor <= today) {
            const dayEnd = new Date(cursor); dayEnd.setHours(23, 59, 59, 999);
            const totalByDay = tasks.filter(t => new Date(t.created_at) <= dayEnd).length;
            const doneByDay = tasks.filter(t => String(t.status).toLowerCase() === 'done' && new Date(t.updated_at) <= dayEnd).length;

            labels.push(cursor.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }));
            totalSeries.push(totalByDay);
            doneSeries.push(doneByDay);

            cursor.setDate(cursor.getDate() + 1);
        }

        if (burndownChartInstance) burndownChartInstance.destroy();
        burndownChartInstance = new Chart(canvas, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Tổng công việc', data: totalSeries, borderColor: '#9A6B0D', backgroundColor: 'transparent', stepped: true },
                    { label: 'Đã hoàn thành', data: doneSeries, borderColor: '#1C8F5A', backgroundColor: 'transparent', stepped: true }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
            }
        });
    } catch (err) {
        showToast('Lỗi tải biểu đồ: ' + err.message, 'error');
    }
}

// hàm xóa dự án
function deleteProjectAction(projectId, projectName) {
    Swal.fire({
        title: 'CẢNH BÁO XÓA DỰ ÁN!',
        html: `Bạn đang chọn xóa dự án: <b>"${projectName}"</b><br><br>
                Hành động này sẽ xóa vĩnh viễn dự án này <br>
                VÀ <b>TẤT CẢ CÁC TASK CON</b> liên quan!<br><br>
                Không thể khôi phục được!`,
        icon: 'error',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'XÓA LÀ MẤT HẾT ĐÓ NHA!',
        cancelButtonText: 'Nghĩ kỹ lại đi ae!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang xóa dữ liệu...',
                text: 'Vui lòng không tắt trình duyệt',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS("deleteProject", {
                    projectId: projectId,
                    groupKey: activeGroup
                });

                if (response.status === 'success') {
                    Swal.fire('Đã xóa!', response.data || response.message, 'success'); // Server trả về message trong data

                    if (typeof currentTaskProjectID !== 'undefined' && currentTaskProjectID === projectId) {
                        currentTaskProjectID = null;
                        const taskBody = document.getElementById('task-table-body');
                        if (taskBody) taskBody.innerHTML = '';
                    }

                    if (typeof loadProgressList === 'function') {
                        loadProgressList();
                    } else if (typeof loadProjectOverview === 'function') {
                        loadProjectOverview();
                    }
                } else {
                    Swal.fire('Lỗi!', "Không thể xóa dự án: " + response.message, 'error');
                }
            } catch (err) {
                console.error("Lỗi xóa dự án:", err);
                Swal.fire('Lỗi!', "Lỗi kết nối: " + (err.message || err), 'error');
            }
        }
    });
}

// HÀM TẠO DỰ ÁN HOẶC CẬP NHẬT NOTE 
async function handleProjectCreationOrUpdate() {
    const btn = document.getElementById('update-progress-btn');
    const nameInput = document.getElementById('progress-project-name');
    const noteInput = document.getElementById('progress-note-input');
    const statusInput = document.getElementById('progress-status-select');
    const selectInput = document.getElementById('project-select'); // Dropdown chọn dự án có sẵn (value = id)

    const newName = nameInput.value.trim();
    const note = noteInput.value.trim();
    const status = statusInput ? statusInput.value : '';
    const selectedProjectId = selectInput.value;

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    btn.disabled = true;

    try {
        if (!selectedProjectId && newName) {
            const response = await callGAS("createProject", {
                name: newName,
                owner: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : "Unknown",
                status: status || "Planning",
                description: note,
                groupKey: activeGroup
            });

            if (response.status === 'success') {
                showToast(response.data || response.message, "success"); // Server trả về message trong data

                nameInput.value = '';
                noteInput.value = '';
                if (statusInput) statusInput.value = 'Planning';
                loadProjectOverview();
            } else {
                showToast("Lỗi: " + response.message, "error");
            }
        }
        else if (selectedProjectId) {
            const response = await callGAS("updateProject", {
                projectId: selectedProjectId,
                status: status,
                description: note,
                groupKey: activeGroup
            });

            if (response.status === 'success') {
                showToast(response.data || response.message, "success");
                loadProjectOverview();
            } else {
                showToast("Lỗi cập nhật: " + response.message, "error");
            }
        }
        else {
            showToast("Vui lòng nhập tên dự án mới hoặc chọn dự án để cập nhật.", "warning");
        }

    } catch (err) {
        console.error("Lỗi xử lý dự án:", err);
        showToast("Lỗi hệ thống: " + (err.message || err), "error");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}


// hàm load progress trên dashboard 
async function loadDashboardTopProgress() {
    if (!chatUser) return;
    const container = document.getElementById('project-progress-view');
    if (!container) return;

    container.innerHTML = `<div class="text-center text-muted py-3"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải dữ liệu...</div>`;

    try {
        // GỌI HÀM MỚI Ở GAS
        const response = await callGAS("getProjectListWithTaskStats", {
            filters: {},
            groupKey: activeGroup
        });

        if (response.status === 'success') {
            const projects = response.data;

            if (!projects || projects.length === 0) {
                container.innerHTML = `<div class="text-center text-muted py-3">Chưa có dự án nào.</div>`;
                return;
            }

            let html = '<div class="d-flex flex-column gap-3">';

            // Biến kiểm tra xem có phải đang ở trang Chung (All) không
            const isGeneralPage = (typeof activeGroup !== 'undefined' && activeGroup === 'all');

            projects.slice(0, 5).forEach(p => {
                const percent = p.percent || 0;
                const stats = p.taskStats; // Lấy object thống kê được trả về từ backend

                // --- THÊM LOGIC XÁC ĐỊNH NHÓM (ORIGIN GROUP) ---
                let groupBadgeHTML = '';
                // Chỉ hiện Tag Nhóm khi đang ở Dashboard Chung (All), ở trang riêng thì ẩn đi cho gọn
                if (isGeneralPage) {
                    let badgeClass = 'bg-secondary';
                    let groupLabel = 'General';
                    if (p.originGroup === 'finance') {
                        badgeClass = 'bg-warning text-dark';
                        groupLabel = 'Finance';
                    } else if (p.originGroup === 'science') {
                        badgeClass = 'bg-info text-dark';
                        groupLabel = 'Science';
                    }
                    // Tạo cục HTML cho cái Badge (thêm ms-2 để cách lề trái 1 xíu)
                    groupBadgeHTML = `<span class="badge ${badgeClass} ms-2" style="font-size: 0.65rem; vertical-align: text-top;">${groupLabel}</span>`;
                }
                // ----------------------------------------------

                html += `
                <div class="project-item-dashboard border-bottom pb-3">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <div>
                            <strong class="text-dark" style="font-size: 0.95rem;">${p.name}</strong>
                            ${groupBadgeHTML} </div>
                        <span class="badge bg-light text-success border border-success">${percent}%</span>
                    </div>
                    <div class="progress mb-2" style="height: 6px; border-radius: 4px; background-color: var(--hover-bg);">
                        <div class="progress-bar ${getProgressBarColor(percent)}" role="progressbar" 
                            style="width: ${percent}%"></div>
                    </div>
                    
                    <div class="d-flex gap-2 flex-wrap" style="font-size: 0.75rem;">
                        <span class="badge rounded-pill bg-success bg-opacity-10 text-success border border-success" title="Done">
                            <i class="fa-solid fa-check"></i> ${stats.done}
                        </span>
                        <span class="badge rounded-pill bg-warning bg-opacity-10 text-warning border border-warning" title="Working on it">
                            <i class="fa-solid fa-spinner"></i> ${stats.working}
                        </span>
                        <span class="badge rounded-pill bg-danger bg-opacity-10 text-danger border border-danger" title="Stuck">
                            <i class="fa-solid fa-triangle-exclamation"></i> ${stats.stuck}
                        </span>
                        <span class="badge rounded-pill bg-secondary bg-opacity-10 text-secondary border border-secondary" title="Not Started">
                            <i class="fa-solid fa-pause"></i> ${stats.notStarted}
                        </span>
                    </div>
                </div>`;
            });

            html += '</div>';
            container.innerHTML = html;

        } else {
            container.innerHTML = `<div class="text-danger small">Lỗi tải: ${response.message}</div>`;
        }

    } catch (err) {
        console.error("Lỗi Dashboard Progress:", err);
        container.innerHTML = `<div class="text-danger small">Lỗi kết nối!</div>`;
    }
}


//  hàm share dự án
function shareProjectAction(projectId, projectName) {
    Swal.fire({
        title: 'Chia sẻ Dự án?',
        html: `Bạn có muốn sao chép dự án <b>"${projectName}"</b> và toàn bộ công việc sang Dashboard Chung không?<br><small class="text-muted">(Sẽ tạo một bản sao mới)</small>`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Chia sẻ cho thầyy đi!',
        cancelButtonText: 'Thồi'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang share...',
                text: 'Vui lòng chờ trong giây lát',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS("shareProject", {
                    projectId: projectId,
                    groupKey: activeGroup
                });

                if (response.status === 'success') {
                    Swal.fire('Thành công!', response.data || response.message, 'success');
                    // Tải lại danh sách để cập nhật icon share
                    if (typeof loadProjectOverview === 'function') loadProjectOverview();
                } else {
                    Swal.fire('Lỗi!', "Không thể share: " + response.message, 'error');
                }

            } catch (err) {
                console.error("Lỗi share dự án:", err);
                Swal.fire('Lỗi!', "Lỗi kết nối: " + (err.message || err), 'error');
            }
        }
    });
}





/**
 * 6.Task Management Functions
 */
// HÀM TẢI TASK CỦA DỰ ÁN ĐANG CHỌN 
async function loadTasksForProject(projectId) {
    const tableBody = document.getElementById('task-table-body');
    const cardContainer = document.getElementById('task-card-container');
    const modalProjectId = document.getElementById('new-task-project-id');

    // Lưu ID dự án hiện tại
    currentTaskProjectID = projectId;

    // Gán ID vào hidden input trong modal
    if (modalProjectId) modalProjectId.value = projectId;

    if (!projectId) {
        if (tableBody) tableBody.innerHTML = '';
        if (cardContainer) cardContainer.innerHTML = '<p class="text-center text-muted w-100 mt-5">Vui lòng chọn dự án để xem công việc.</p>';
        return;
    }

    if (tableBody) tableBody.innerHTML = '<tr><td colspan="8" class="text-center py-5"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải công việc...</td></tr>';
    if (cardContainer) cardContainer.innerHTML = '<div class="text-center w-100 mt-5"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

    try {
        const response = await callGAS("getTaskList", {
            projectId: projectId,
            groupKey: activeGroup
        });

        if (response.status === 'success') {
            // Lấy dữ liệu task từ response.data
            globalAllTasks = response.data || [];

            const taskNameSelect = document.getElementById('filter-task-name');
            if (taskNameSelect) {
                taskNameSelect.innerHTML = '<option value="">-- Tất cả công việc --</option>';
                const uniqueNames = [...new Set(globalAllTasks.map(t => t.name))];
                uniqueNames.forEach(name => {
                    const opt = document.createElement('option');
                    opt.value = name;
                    opt.textContent = name;
                    taskNameSelect.appendChild(opt);
                });
            }

            populateLabelFilter();
            applyTaskFilters();

        } else {
            const errMsg = `<tr><td colspan="8" class="text-center text-danger py-4">Lỗi: ${response.message}</td></tr>`;
            if (tableBody) tableBody.innerHTML = errMsg;
            if (cardContainer) cardContainer.innerHTML = `<div class="text-center text-danger mt-5">${response.message}</div>`;

            if (typeof showToast === 'function') showToast("Lỗi tải task: " + response.message, "error");
        }

    } catch (err) {
        console.error("Lỗi tải task:", err);
        const errMsg = `<tr><td colspan="8" class="text-center text-danger py-4">Lỗi kết nối server!</td></tr>`;
        if (tableBody) tableBody.innerHTML = errMsg;

        if (typeof showToast === 'function') showToast("Lỗi kết nối: " + err.message, "error");
        else alert("Lỗi: " + err.message);
    }
}

//  HÀM CẬP NHẬT GIAO DIỆN 
function renderTasks(tasks) {
    const tableBody = document.getElementById('task-table-body');
    const cardContainer = document.getElementById('task-card-container');

    if (tableBody) tableBody.innerHTML = '';
    if (cardContainer) cardContainer.innerHTML = '';

    if (!tasks || tasks.length === 0) {
        const emptyMsg = '<tr><td colspan="8" class="text-center text-muted py-5">Chưa có công việc nào.</td></tr>'; // Lưu ý colspan=8 vì thêm cột File
        if (tableBody) tableBody.innerHTML = emptyMsg;
        if (cardContainer) cardContainer.innerHTML = '<div class="text-center text-muted w-100 py-5">Chưa có công việc nào.</div>';
        return;
    }

    // Sắp xếp: task cha trước, subtask nằm ngay sau cha của nó (nếu cha cũng đang hiển thị trong danh sách này)
    const idsInView = new Set(tasks.map(x => x.id));
    const topLevel = tasks.filter(x => !x.parent_task_id || !idsInView.has(x.parent_task_id));
    const orderedTasks = [];
    topLevel.forEach(x => {
        orderedTasks.push(x);
        tasks.filter(c => c.parent_task_id === x.id).forEach(c => orderedTasks.push(c));
    });
    tasks.forEach(x => { if (!orderedTasks.includes(x)) orderedTasks.push(x); });

    orderedTasks.forEach(t => {
        // Escape 2 lớp: escapeJs cho chuỗi nằm trong tham số onclick, escapeHtml cho thuộc tính HTML
        const safeName = escapeHtml(escapeJs(t.name));
        const safeDesc = escapeHtml(escapeJs(t.description || '').replace(/\r?\n/g, "\\n"));
        const safeAssignees = escapeHtml(escapeJs(t.assignees || ''));
        const isSubtask = !!t.parent_task_id && idsInView.has(t.parent_task_id);
        const subtaskBtn = t.parent_task_id ? '' : `
                        <button class="btn btn-sm text-secondary border-0" title="Thêm việc con" onclick="openAddSubtask('${t.id}', '${safeName}')">
                            <i class="fa-solid fa-diagram-project"></i>
                        </button>`;

        // XỬ LÝ FILE ATTACHMENTS
        const safeAttachments = escapeHtml(escapeJs(t.attachments || '[]'));
        let fileCount = 0;
        try {
            fileCount = t.attachments ? JSON.parse(t.attachments).length : 0;
        } catch (e) { fileCount = 0; }

        // Tạo nút cho table
        const fileBtnTable = fileCount > 0
            ? `<span class="badge bg-primary rounded-pill"><i class="fa-solid fa-paperclip"></i> ${fileCount}</span>`
            : `<i class="fa-solid fa-paperclip text-muted opacity-25"></i>`;

        // Tạo nút cho card
        const fileBtnCard = fileCount > 0
            ? `<span class="badge bg-primary rounded-pill"><i class="fa-solid fa-paperclip"></i> ${fileCount} files</span>`
            : `<span class="text-muted small"><i class="fa-solid fa-plus"></i> Thêm</span>`;

        //  làm avatar thành viên
        let avatarsHTML = '<div class="avatar-stack">';
        if (t.assigneeNames && t.assigneeNames.length > 0) {
            t.assigneeNames.forEach(name => {
                const short = name.trim().substring(0, 2).toUpperCase();
                const colors = ['#007bff', '#28a745', '#dc3545', '#fd7e14', '#6610f2', '#17a2b8'];
                const colorIndex = short.charCodeAt(0) % colors.length;
                const bg = colors[colorIndex];
                avatarsHTML += `<div class="member-avatar" style="background-color: ${bg};" title="${escapeHtml(name)}">${escapeHtml(short)}</div>`;
            });
        } else {
            avatarsHTML += '<span class="small text-muted ps-2">--</span>';
        }
        avatarsHTML += '</div>';

        const statusColor = typeof getStatusColor === 'function' ? getStatusColor(t.status) : '#6c757d';

        // RENDER TABLE
        if (tableBody) {
            const tr = document.createElement('tr');
            if (!t.parent_task_id) {
                tr.draggable = true;
                tr.classList.add('draggable-row');
                tr.addEventListener('dragstart', (e) => handleTaskDragStart(e, t.id));
                tr.addEventListener('dragover', handleTaskDragOver);
                tr.addEventListener('drop', (e) => handleTaskDrop(e, t.id));
                tr.addEventListener('dragend', handleTaskDragEnd);
            }
            tr.innerHTML = `
                    <td class="bulk-select-col" style="display:none;"><input type="checkbox" class="bulk-select-checkbox" data-task-id="${t.id}" onchange="onBulkCheckboxChange('${t.id}', this.checked)" onclick="event.stopPropagation()"></td>

                    <td style="border-left: 5px solid ${statusColor}; font-weight: 500; ${isSubtask ? 'padding-left: 32px;' : ''}">
                        ${isSubtask ? '<i class="fa-solid fa-turn-up fa-rotate-90 text-muted me-1" style="font-size:0.75em;"></i>' : ''}${escapeHtml(t.name)}${getBlockedBadge(t)}${getChecklistBadge(t)}
                        ${renderLabelChips(t.labels)}
                    </td>

                    <td>${avatarsHTML}</td>

                    <td class="text-center align-middle"> <button class="btn btn-sm btn-light border-0" style="background: transparent;"
                            title="Quản lý tài liệu"
                            onclick="openFileModal('${t.id}', '${safeAttachments}', '${safeName}' )">
                            ${fileBtnTable}
                        </button>
                    </td>

                    <td>
                        <div class="small text-muted text-truncate" style="max-width: 200px;" title="${escapeHtml(t.description || '')}">
                            ${escapeHtml(t.description || '')}
                        </div>
                    </td>

                    <td>${renderBadge('status', t.status)}</td>

                    <td class="small text-muted">${escapeHtml(t.dueDate || '--')}${getDueDateBadge(t.dueDate, t.status)}</td>

                    <td>${renderBadge('priority', t.priority)}</td>

                    <td class="text-nowrap">
                        <button class="btn btn-sm text-primary border-0" title="Sửa"
                            onclick="openEditTask('${t.id}', '${safeName}', '${escapeHtml(escapeJs(t.status))}', '${escapeHtml(escapeJs(t.priority))}', '${escapeHtml(escapeJs(t.dueDate || ''))}', '${safeAssignees}', '${safeDesc}', '${t.parent_task_id || ''}', '${t.blocked_by || ''}')">
                            <i class="fa-solid fa-pen"></i>
                        </button>${subtaskBtn}
                        <button class="btn btn-sm text-secondary border-0" title="Bình luận & Lịch sử" onclick="openTaskActivity('${t.id}', '${safeName}')">
                            <i class="fa-solid fa-comment-dots"></i>
                        </button>
                        <button class="btn btn-sm text-danger border-0" title="Xóa" onclick="deleteTaskAction('${t.id}', '${safeName}')">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </td>
                `;
            tableBody.appendChild(tr);
        }

        // RENDER CARD
        if (cardContainer) {
            const card = document.createElement('div');
            card.className = isSubtask ? 'task-card task-card-subtask' : 'task-card';
            card.style.borderLeftColor = statusColor;
            if (!t.parent_task_id) {
                card.draggable = true;
                card.addEventListener('dragstart', (e) => handleTaskDragStart(e, t.id));
                card.addEventListener('dragover', handleTaskDragOver);
                card.addEventListener('drop', (e) => handleTaskDrop(e, t.id));
                card.addEventListener('dragend', handleTaskDragEnd);
            }

            const descDisplay = t.description
                ? `<div class="text-muted small fst-italic mb-2" style="border-bottom:1px solid #eee; padding-bottom:5px;">${escapeHtml(t.description)}</div>`
                : '';

            card.innerHTML = `
                    <div class="d-flex justify-content-between align-items-start">
                        <span class="fw-bold text-primary" style="font-size: 1.1rem;">
                            <input type="checkbox" class="bulk-select-checkbox bulk-select-col" style="display:none; margin-right:6px;" data-task-id="${t.id}" onchange="onBulkCheckboxChange('${t.id}', this.checked)">
                            ${isSubtask ? '<i class="fa-solid fa-turn-up fa-rotate-90 text-muted me-1" style="font-size:0.75em;"></i>' : ''}${escapeHtml(t.name)}${getBlockedBadge(t)}${getChecklistBadge(t)}${renderLabelChips(t.labels)}</span>

                        <div class="dropdown">
                            <button class="btn btn-sm text-secondary" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                                <i class="fa-solid fa-ellipsis"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <button class="dropdown-item" type="button"
                                        onclick="openEditTask('${t.id}', '${safeName}', '${escapeHtml(escapeJs(t.status))}', '${escapeHtml(escapeJs(t.priority))}', '${escapeHtml(escapeJs(t.dueDate || ''))}', '${safeAssignees}', '${safeDesc}', '${t.parent_task_id || ''}', '${t.blocked_by || ''}')">
                                        <i class="fa-solid fa-pen me-2 text-primary"></i> Sửa
                                    </button>
                                </li>
                                ${t.parent_task_id ? '' : `<li>
                                    <button class="dropdown-item" type="button" onclick="openAddSubtask('${t.id}', '${safeName}')">
                                        <i class="fa-solid fa-diagram-project me-2 text-secondary"></i> Thêm việc con
                                    </button>
                                </li>`}
                                <li>
                                    <button class="dropdown-item" type="button" onclick="openTaskActivity('${t.id}', '${safeName}')">
                                        <i class="fa-solid fa-comment-dots me-2 text-secondary"></i> Bình luận & Lịch sử
                                    </button>
                                </li>
                                <li>
                                    <button class="dropdown-item text-danger" type="button"
                                        onclick="deleteTaskAction('${t.id}', '${safeName}')">
                                        <i class="fa-solid fa-trash me-2"></i> Xóa
                                    </button>
                                </li>
                            </ul>
                        </div>
                    </div>

                    ${descDisplay}

                    <div class="card-row">
                        <span class="card-label"><i class="fa-solid fa-user-group me-1"></i>Team:</span>
                        <div>${avatarsHTML}</div>
                    </div>

                    <div class="card-row">
                        <span class="card-label"><i class="fa-solid fa-spinner me-1"></i>Status:</span>
                        <div style="flex:1; text-align:right;">${renderBadge('status', t.status)}</div>
                    </div>

                    <div class="card-row">
                        <span class="card-label"><i class="fa-solid fa-flag me-1"></i>Priority:</span>
                        <div style="flex:1; text-align:right;">${renderBadge('priority', t.priority).replace('width: 100%', 'width: auto; display:inline-block; padding: 2px 10px;')}</div>
                    </div>

                    <div class="card-row">
                        <span class="card-label"><i class="fa-solid fa-paperclip me-1"></i>Tài liệu:</span>
                        <div style="flex:1; text-align:right;">
                            <button class="btn btn-sm btn-light border" style="font-size: 0.85rem;" 
                                onclick="openFileModal('${t.id}', '${safeAttachments}', '${safeName}' )">
                                ${fileBtnCard}
                            </button>
                        </div>
                    </div>

                    <div class="card-row">
                        <span class="card-label"><i class="fa-regular fa-clock me-1"></i>Due:</span>
                        <span class="fw-bold text-dark">${t.dueDate || '--'}${getDueDateBadge(t.dueDate, t.status)}</span>
                    </div>
                `;
            cardContainer.appendChild(card);
        }
    });
}


//  KÉO-THẢ SẮP XẾP TASK (chỉ áp dụng cho task cấp cao nhất, việc con luôn bám theo cha)
let draggedTaskId = null;

function handleTaskDragStart(e, taskId) {
    draggedTaskId = taskId;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget && e.currentTarget.classList) e.currentTarget.classList.add('dragging-task');
}

function handleTaskDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
}

async function handleTaskDrop(e, targetTaskId) {
    e.preventDefault();
    if (!draggedTaskId || draggedTaskId === targetTaskId || !globalAllTasks) return;

    const fromIdx = globalAllTasks.findIndex(t => t.id === draggedTaskId);
    const toIdx = globalAllTasks.findIndex(t => t.id === targetTaskId);
    if (fromIdx === -1 || toIdx === -1) return;

    const [moved] = globalAllTasks.splice(fromIdx, 1);
    const newToIdx = globalAllTasks.findIndex(t => t.id === targetTaskId);
    globalAllTasks.splice(newToIdx, 0, moved);

    if (typeof applyTaskFilters === 'function') applyTaskFilters(); // vẽ lại ngay (optimistic)

    const orderedIds = globalAllTasks.filter(t => !t.parent_task_id).map(t => t.id);
    try {
        await callGAS('reorderTasks', { orderedIds, groupKey: activeGroup });
    } catch (err) {
        console.error('Lỗi lưu thứ tự task:', err);
        showToast('Lỗi lưu thứ tự, đang tải lại...', 'error');
        if (typeof loadTasksForProject === 'function' && currentTaskProjectID) loadTasksForProject(currentTaskProjectID);
    }
}

function handleTaskDragEnd(e) {
    draggedTaskId = null;
    document.querySelectorAll('.dragging-task').forEach(el => el.classList.remove('dragging-task'));
}

//  BOARD KANBAN (kéo thẻ giữa các cột = đổi status)
const KANBAN_STATUSES = ['Not Started', 'Working on it', 'Stuck', 'Done'];

function renderKanbanBoard(tasks) {
    const container = document.getElementById('kanban-board-container');
    if (!container) return;
    container.innerHTML = '';

    KANBAN_STATUSES.forEach(status => {
        const colTasks = (tasks || []).filter(t => (t.status || 'Not Started') === status);

        const col = document.createElement('div');
        col.className = 'kanban-column';
        col.addEventListener('dragover', (e) => { e.preventDefault(); col.classList.add('kanban-column-dragover'); });
        col.addEventListener('dragleave', () => col.classList.remove('kanban-column-dragover'));
        col.addEventListener('drop', (e) => {
            e.preventDefault();
            col.classList.remove('kanban-column-dragover');
            handleKanbanDrop(status);
        });

        const header = document.createElement('div');
        header.className = 'kanban-column-header';
        header.innerHTML = `<span>${escapeHtml(status)}</span><span class="kanban-count">${colTasks.length}</span>`;
        col.appendChild(header);

        const body = document.createElement('div');
        body.className = 'kanban-column-body';

        colTasks.forEach(t => {
            const safeName = escapeHtml(t.name);
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.draggable = true;
            card.addEventListener('dragstart', () => { draggedTaskId = t.id; card.classList.add('dragging-task'); });
            card.addEventListener('dragend', () => { card.classList.remove('dragging-task'); });
            card.addEventListener('click', () => openTaskActivity(t.id, t.name));

            const parent = t.parent_task_id ? (globalAllTasks || []).find(x => x.id === t.parent_task_id) : null;
            const parentLabel = parent
                ? `<div class="kanban-parent-label"><i class="fa-solid fa-turn-up fa-rotate-90"></i> ${escapeHtml(parent.name)}</div>`
                : '';

            card.innerHTML = `
                ${parentLabel}
                <div class="kanban-card-title">${safeName}${getBlockedBadge(t)}${getChecklistBadge(t)}</div>
                ${renderLabelChips(t.labels) ? `<div class="kanban-card-labels">${renderLabelChips(t.labels)}</div>` : ''}
                <div class="kanban-card-meta">
                    ${renderBadge('priority', t.priority).replace('width: 100%', 'width:auto; display:inline-block; padding:2px 8px;')}
                    ${getDueDateBadge(t.dueDate, t.status)}
                </div>
            `;
            body.appendChild(card);
        });

        col.appendChild(body);
        container.appendChild(col);
    });
}

async function handleKanbanDrop(newStatus) {
    if (!draggedTaskId || !globalAllTasks) return;
    const task = globalAllTasks.find(t => t.id === draggedTaskId);
    draggedTaskId = null;
    if (!task || task.status === newStatus) return;

    const oldStatus = task.status;
    task.status = newStatus; // optimistic
    if (typeof applyTaskFilters === 'function') applyTaskFilters();

    try {
        const response = await callGAS('saveTask', {
            id: task.id,
            projectId: task.project_id,
            name: task.name,
            status: newStatus,
            priority: task.priority,
            dueDate: task.dueDate,
            assignees: task.assignees,
            description: task.description,
            parentTaskId: task.parent_task_id,
            blockedBy: task.blocked_by,
            baseUpdatedAt: task.updated_at,
            groupKey: activeGroup
        });
        if (response.status !== 'success') throw new Error(response.message);
        showToast(response.data || response.message, 'success');
        if (typeof loadProjectOverview === 'function') loadProjectOverview();
    } catch (err) {
        task.status = oldStatus; // revert nếu lỗi (vd bị chặn bởi task chưa Done)
        if (typeof applyTaskFilters === 'function') applyTaskFilters();
        showToast('Lỗi: ' + err.message, 'error');
    }
}

//  CHỌN NHIỀU (BULK ACTION) TASK
let bulkSelectMode = false;
let bulkSelectedIds = new Set();

function toggleBulkSelectMode() {
    bulkSelectMode = !bulkSelectMode;
    if (!bulkSelectMode) bulkSelectedIds.clear();

    document.querySelectorAll('.bulk-select-col').forEach(el => {
        if (!bulkSelectMode) { el.style.display = 'none'; return; }
        el.style.display = (el.tagName === 'TH' || el.tagName === 'TD') ? 'table-cell' : 'inline-block';
    });
    document.querySelectorAll('.bulk-select-checkbox').forEach(cb => { if (!bulkSelectMode) cb.checked = false; });

    const toggleBtn = document.getElementById('bulk-select-toggle');
    if (toggleBtn) toggleBtn.classList.toggle('active', bulkSelectMode);

    refreshBulkSelectionUI();
}

function onBulkCheckboxChange(taskId, checked) {
    if (checked) bulkSelectedIds.add(taskId);
    else bulkSelectedIds.delete(taskId);
    // đồng bộ trạng thái checkbox của cùng 1 task giữa view bảng và view card
    document.querySelectorAll(`.bulk-select-checkbox[data-task-id="${taskId}"]`).forEach(cb => cb.checked = checked);
    refreshBulkSelectionUI();
}

function toggleSelectAllTasks(checked) {
    document.querySelectorAll('.bulk-select-checkbox').forEach(cb => {
        cb.checked = checked;
        const id = cb.dataset.taskId;
        if (checked) bulkSelectedIds.add(id); else bulkSelectedIds.delete(id);
    });
    refreshBulkSelectionUI();
}

function refreshBulkSelectionUI() {
    const bar = document.getElementById('bulk-action-bar');
    const countEl = document.getElementById('bulk-selected-count');
    if (countEl) countEl.textContent = `${bulkSelectedIds.size} đã chọn`;
    if (bar) bar.style.display = (bulkSelectMode && bulkSelectedIds.size > 0) ? 'flex' : 'none';
}

// Hàm dùng chung cho các thao tác hàng loạt mới (gán người/đặt hạn/gắn nhãn):
// gọi API, báo kết quả, tải lại danh sách, bỏ chọn. applyBulkStatusChange/applyBulkDelete
// ở dưới giữ nguyên cách viết cũ, không đổi để tránh phá vỡ hành vi đã chạy ổn.
async function runBulkTaskAction(action, extraParams) {
    const ids = Array.from(bulkSelectedIds);
    if (ids.length === 0) return null;

    try {
        const response = await callGAS(action, { taskIds: ids, projectId: currentTaskProjectID, groupKey: activeGroup, ...extraParams });
        if (response.status !== 'success') throw new Error(response.message);
        showToast(response.data || response.message, 'success');
        bulkSelectedIds.clear();
        if (typeof loadTasksForProject === 'function' && currentTaskProjectID) loadTasksForProject(currentTaskProjectID);
        if (typeof loadProjectOverview === 'function') loadProjectOverview();
        return response;
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
        return null;
    }
}

// Danh sách checkbox thành viên để chọn khi gán hàng loạt
let bulkAssigneeExpanded = false;
function showBulkAssigneeCheckboxes() {
    const box = document.getElementById('bulk-assignee-checkboxes');
    if (!box) return;
    bulkAssigneeExpanded = !bulkAssigneeExpanded;
    box.style.display = bulkAssigneeExpanded ? 'block' : 'none';
    if (bulkAssigneeExpanded && !box.dataset.loaded) {
        box.dataset.loaded = '1';
        loadBulkAssigneeCheckboxes();
    }
}

async function loadBulkAssigneeCheckboxes() {
    const container = document.getElementById('bulk-assignee-checkboxes');
    if (!container) return;
    container.innerHTML = '<div class="p-2 small text-muted">Đang tải...</div>';

    try {
        const response = await callGAS('getAllUsers', { groupKey: activeGroup });
        if (response.status !== 'success') throw new Error(response.message);
        const users = response.data || [];
        if (users.length === 0) {
            container.innerHTML = '<div class="p-2 small text-muted">Chưa có thành viên.</div>';
            return;
        }
        container.innerHTML = users.map(u =>
            `<label>
                <input type="checkbox" name="bulk-assignees" value="${escapeHtml(u.email)}"> ${escapeHtml(u.name || u.email)}
            </label>`
        ).join('');
    } catch (err) {
        container.innerHTML = `<div class="p-2 small text-danger">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

async function applyBulkAssign() {
    const checked = document.querySelectorAll('input[name="bulk-assignees"]:checked');
    const emails = Array.from(checked).map(cb => cb.value).join(', ');
    if (!emails) { showToast('Chưa chọn người thực hiện.', 'error'); return; }
    await runBulkTaskAction('bulkAssignTasks', { assignees: emails });
    document.querySelectorAll('input[name="bulk-assignees"]:checked').forEach(cb => cb.checked = false);
}

async function applyBulkDueDate() {
    const input = document.getElementById('bulk-duedate-input');
    const dueDate = input ? input.value : '';
    if (!dueDate) { showToast('Chưa chọn ngày.', 'error'); return; }
    await runBulkTaskAction('bulkSetTaskDueDate', { dueDate });
}

async function applyBulkClearDueDate() {
    await runBulkTaskAction('bulkSetTaskDueDate', { dueDate: null });
}

async function applyBulkAddLabel() {
    const input = document.getElementById('bulk-label-input');
    const label = input ? input.value.trim() : '';
    if (!label) { showToast('Chưa nhập nhãn.', 'error'); return; }
    const result = await runBulkTaskAction('bulkAddTaskLabel', { label });
    if (result && input) input.value = '';
}

async function applyBulkStatusChange() {
    const statusSel = document.getElementById('bulk-status-select');
    const status = statusSel ? statusSel.value : null;
    const ids = Array.from(bulkSelectedIds);
    if (!status || ids.length === 0) return;

    try {
        const response = await callGAS('bulkUpdateTaskStatus', { taskIds: ids, status, projectId: currentTaskProjectID, groupKey: activeGroup });
        if (response.status !== 'success') throw new Error(response.message);
        showToast(response.data || response.message, 'success');
        bulkSelectedIds.clear();
        if (typeof loadTasksForProject === 'function' && currentTaskProjectID) loadTasksForProject(currentTaskProjectID);
        if (typeof loadProjectOverview === 'function') loadProjectOverview();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

async function applyBulkDelete() {
    const ids = Array.from(bulkSelectedIds);
    if (ids.length === 0) return;

    Swal.fire({
        title: `Xóa ${ids.length} công việc?`,
        text: 'Hành động này sẽ đưa các công việc đã chọn vào thùng rác.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa liền đi người ae!',
        cancelButtonText: 'Nghĩ lại òi!'
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        try {
            const response = await callGAS('bulkDeleteTasks', { taskIds: ids, projectId: currentTaskProjectID, groupKey: activeGroup });
            if (response.status !== 'success') throw new Error(response.message);
            showToast(response.data || response.message, 'success');
            bulkSelectedIds.clear();
            if (typeof loadTasksForProject === 'function' && currentTaskProjectID) loadTasksForProject(currentTaskProjectID);
            if (typeof loadProjectOverview === 'function') loadProjectOverview();
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
        }
    });
}

//  TÌM KIẾM TOÀN CỤC (Ctrl/Cmd + K)
let searchPaletteResults = [];   // danh sách phẳng đang hiển thị, để điều hướng bằng phím
let searchPaletteIndex = -1;     // mục đang được chọn
let searchDebounceTimer = null;
let searchRequestSeq = 0;        // chống kết quả cũ về sau đè kết quả mới

function openSearchPalette() {
    const palette = document.getElementById('search-palette');
    const input = document.getElementById('search-palette-input');
    if (!palette || !input) return;

    palette.style.display = 'flex';
    input.value = '';
    searchPaletteResults = [];
    searchPaletteIndex = -1;
    renderSearchHint('Gõ ít nhất 2 ký tự để tìm.');
    setTimeout(() => input.focus(), 30);
}

function closeSearchPalette() {
    const palette = document.getElementById('search-palette');
    if (palette) palette.style.display = 'none';
    clearTimeout(searchDebounceTimer);
    searchPaletteResults = [];
    searchPaletteIndex = -1;
}

function renderSearchHint(text) {
    const box = document.getElementById('search-palette-results');
    if (box) box.innerHTML = `<div class="search-palette-hint">${escapeHtml(text)}</div>`;
}

function onSearchPaletteInput(value) {
    clearTimeout(searchDebounceTimer);
    const q = String(value || '').trim();

    if (q.length < 2) {
        searchPaletteResults = [];
        searchPaletteIndex = -1;
        renderSearchHint('Gõ ít nhất 2 ký tự để tìm.');
        return;
    }

    renderSearchHint('Đang tìm...');
    searchDebounceTimer = setTimeout(async () => {
        const mySeq = ++searchRequestSeq;
        try {
            const response = await callGAS('globalSearch', { query: q, groupKey: activeGroup });
            if (mySeq !== searchRequestSeq) return; // đã có lượt gõ mới hơn
            if (response.status !== 'success') throw new Error(response.message);
            renderSearchResults(response.data || { projects: [], tasks: [], files: [] });
        } catch (err) {
            if (mySeq !== searchRequestSeq) return;
            renderSearchHint('Lỗi tìm kiếm: ' + err.message);
        }
    }, 250);
}

function renderSearchResults(data) {
    const box = document.getElementById('search-palette-results');
    if (!box) return;

    searchPaletteResults = [
        ...(data.projects || []).map(x => ({ ...x, type: 'project' })),
        ...(data.tasks || []).map(x => ({ ...x, type: 'task' })),
        ...(data.milestones || []).map(x => ({ ...x, type: 'milestone' })),
        ...(data.events || []).map(x => ({ ...x, type: 'event' })),
        ...(data.comments || []).map(x => ({ ...x, type: 'comment' })),
        ...(data.files || []).map(x => ({ ...x, type: 'file' }))
    ];
    searchPaletteIndex = searchPaletteResults.length > 0 ? 0 : -1;

    if (searchPaletteResults.length === 0) {
        renderSearchHint('Không tìm thấy kết quả nào.');
        return;
    }

    const GROUP_META = {
        project: { label: 'Dự án', icon: 'fa-diagram-project' },
        task: { label: 'Công việc', icon: 'fa-list-check' },
        milestone: { label: 'Cột mốc', icon: 'fa-flag-checkered' },
        event: { label: 'Sự kiện', icon: 'fa-calendar-check' },
        comment: { label: 'Bình luận', icon: 'fa-comment-dots' },
        file: { label: 'Tệp', icon: 'fa-file' }
    };

    let html = '';
    let flatIndex = 0;
    ['project', 'task', 'milestone', 'event', 'comment', 'file'].forEach(type => {
        const items = searchPaletteResults.filter(r => r.type === type);
        if (items.length === 0) return;
        html += `<div class="search-palette-group">${GROUP_META[type].label}</div>`;
        items.forEach(item => {
            const idx = flatIndex++;
            const dueBadge = item.type === 'task' ? getDueDateBadge(item.dueDate, item.status) : '';
            html += `
                <div class="search-palette-item${idx === 0 ? ' is-active' : ''}" data-index="${idx}"
                     onclick="activateSearchResult(${idx})" onmouseenter="setSearchActiveIndex(${idx})">
                    <i class="fa-solid ${GROUP_META[type].icon}"></i>
                    <div class="search-palette-item-text">
                        <div class="search-palette-item-title">${escapeHtml(item.title || '')}${dueBadge}</div>
                        ${item.subtitle ? `<div class="search-palette-item-sub">${escapeHtml(item.subtitle)}</div>` : ''}
                    </div>
                </div>`;
        });
    });

    box.innerHTML = html;
}

function setSearchActiveIndex(idx) {
    searchPaletteIndex = idx;
    document.querySelectorAll('.search-palette-item').forEach(el => {
        el.classList.toggle('is-active', Number(el.dataset.index) === idx);
    });
}

function moveSearchSelection(step) {
    if (searchPaletteResults.length === 0) return;
    let next = searchPaletteIndex + step;
    if (next < 0) next = searchPaletteResults.length - 1;
    if (next >= searchPaletteResults.length) next = 0;
    setSearchActiveIndex(next);
    const el = document.querySelector(`.search-palette-item[data-index="${next}"]`);
    if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
}

function activateSearchResult(idx) {
    const item = searchPaletteResults[idx];
    if (!item) return;
    closeSearchPalette();

    if (item.type === 'file') {
        if (item.url) window.open(item.url, '_blank', 'noopener');
        return;
    }
    if (item.type === 'task') {
        if (typeof goToTaskInProject === 'function') goToTaskInProject(item.projectId);
        return;
    }
    if (item.type === 'comment') {
        // Bình luận thuộc về 1 task cụ thể — mở thẳng modal Bình luận & Lịch sử của task đó
        if (typeof openTaskActivity === 'function') openTaskActivity(item.taskId, '');
        return;
    }
    if (item.type === 'milestone' || item.type === 'project') {
        const progressNav = document.querySelector('.nav-item[data-section="progress"]');
        if (progressNav) progressNav.click();
        if (item.type === 'milestone' && typeof openMilestonesModal === 'function') {
            setTimeout(() => openMilestonesModal(item.projectId, ''), 250);
        }
        return;
    }
    if (item.type === 'event') {
        const calendarNav = document.querySelector('.nav-item[data-section="calendar"]');
        if (calendarNav) calendarNav.click();
        if (item.startTime && typeof window.selectDate === 'function') {
            const d = new Date(item.startTime);
            setTimeout(() => window.selectDate(d.getFullYear(), d.getMonth(), d.getDate()), 250);
        }
    }
}

//  ĐỒNG BỘ THỜI GIAN THỰC
// Chỉ tải lại đúng phần đang hiển thị, gom nhiều thay đổi liên tiếp thành 1 lần tải,
// và không báo "vừa cập nhật" cho chính thao tác của mình vừa gây ra.
let realtimePendingTables = new Set();
let realtimeDebounceTimer = null;
window.lastLocalMutationAt = 0; // callGAS cập nhật mốc này mỗi khi chính mình ghi dữ liệu

function initRealtimeSync() {
    if (typeof API === 'undefined' || !API.realtime) return;

    API.realtime.subscribe(
        (change) => {
            realtimePendingTables.add(change.table);
            clearTimeout(realtimeDebounceTimer);
            realtimeDebounceTimer = setTimeout(flushRealtimeChanges, 400);
        },
        (status) => {
            setRealtimeIndicator(status === 'SUBSCRIBED');
        }
    );
}

function stopRealtimeSync() {
    if (typeof API !== 'undefined' && API.realtime) API.realtime.unsubscribe();
    clearTimeout(realtimeDebounceTimer);
    realtimePendingTables.clear();
    setRealtimeIndicator(false);
}

function flushRealtimeChanges() {
    const tables = new Set(realtimePendingTables);
    realtimePendingTables.clear();
    if (tables.size === 0) return;

    // Thay đổi do chính mình vừa gây ra thì các hàm lưu đã tự tải lại rồi — bỏ qua để
    // không tải chồng và không hiện thông báo thừa.
    const isOwnChange = (Date.now() - window.lastLocalMutationAt) < 2500;
    if (isOwnChange) return;

    const activeItem = document.querySelector('.nav-item.active');
    const section = activeItem ? activeItem.getAttribute('data-section') : null;

    const touchedTasks = tables.has('tasks');
    const touchedProjects = tables.has('projects') || tables.has('project_milestones');
    const touchedEvents = tables.has('events');

    if (section === 'task' && touchedTasks) {
        if (typeof loadTasksForProject === 'function' && currentTaskProjectID) loadTasksForProject(currentTaskProjectID);
    } else if (section === 'mytasks' && (touchedTasks || touchedProjects)) {
        if (typeof loadMyTasks === 'function') loadMyTasks();
    } else if (section === 'progress' && (touchedTasks || touchedProjects)) {
        if (typeof loadProjectOverview === 'function') loadProjectOverview();
    } else if (section === 'calendar' && (touchedEvents || touchedTasks)) {
        if (typeof loadCalendarData === 'function') loadCalendarData();
    } else if (section === 'dashboard') {
        if (touchedEvents || touchedTasks) {
            if (typeof loadCalendarData === 'function') loadCalendarData();
        }
        if (touchedProjects || touchedTasks) {
            if (typeof loadDashboardTopProgress === 'function') loadDashboardTopProgress();
        }
    } else {
        return; // phần đang xem không liên quan tới bảng vừa đổi
    }

    if (tables.has('task_comments') && typeof loadNotifications === 'function') loadNotifications();
    showToast('Dữ liệu vừa được người khác cập nhật.', 'info');
}

// Chấm nhỏ cạnh chuông báo: xanh = đang đồng bộ trực tiếp, xám = mất kết nối
function setRealtimeIndicator(isLive) {
    let dot = document.getElementById('realtime-indicator');
    if (!dot) {
        const anchor = document.querySelector('.noti-btn-container');
        if (!anchor) return;
        dot = document.createElement('span');
        dot.id = 'realtime-indicator';
        dot.className = 'realtime-indicator';
        anchor.appendChild(dot);
    }
    dot.classList.toggle('is-live', !!isLive);
    dot.title = isLive ? 'Đang đồng bộ trực tiếp' : 'Mất kết nối đồng bộ';
}

//  VIỆC CỦA TÔI (gom task được giao, xuyên suốt mọi dự án trong nhóm)
async function loadMyTasks() {
    const container = document.getElementById('mytasks-list');
    if (!container) return;
    container.innerHTML = '<div class="text-center text-muted py-5"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</div>';

    const email = (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null;
    if (!email) {
        container.innerHTML = '<div class="text-center text-muted py-5">Chưa đăng nhập.</div>';
        return;
    }

    try {
        const response = await callGAS('listMyTasks', { email, groupKey: activeGroup });
        if (response.status !== 'success') throw new Error(response.message);
        renderMyTasks(response.data || []);
    } catch (err) {
        container.innerHTML = `<div class="text-danger text-center py-5">Lỗi: ${err.message}</div>`;
    }

    loadWorkload();
}

//  KHỐI LƯỢNG CÔNG VIỆC THEO NGƯỜI
async function loadWorkload() {
    const tbody = document.getElementById('workload-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-3"><i class="fa-solid fa-spinner fa-spin"></i></td></tr>';

    try {
        const response = await callGAS('getWorkload', { groupKey: activeGroup });
        if (response.status !== 'success') throw new Error(response.message);
        renderWorkload(response.data || []);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-danger text-center py-3">Lỗi: ${escapeHtml(err.message)}</td></tr>`;
    }
}

function renderWorkload(rows) {
    const tbody = document.getElementById('workload-table-body');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Không có công việc nào đang mở.</td></tr>';
        return;
    }

    const busiest = Math.max(...rows.map(r => r.total), 1);

    tbody.innerHTML = rows.map(r => {
        // Thanh nền thể hiện tương quan với người đang ôm nhiều việc nhất
        const share = Math.round((r.total / busiest) * 100);
        return `<tr>
            <td class="fw-bold">
                ${escapeHtml(r.name)}
                <div class="workload-bar"><span style="width:${share}%"></span></div>
            </td>
            <td class="text-center fw-bold">${r.total}</td>
            <td class="text-center text-muted">${r.notStarted}</td>
            <td class="text-center">${r.working}</td>
            <td class="text-center ${r.stuck > 0 ? 'text-danger fw-bold' : 'text-muted'}">${r.stuck}</td>
            <td class="text-center ${r.overdue > 0 ? 'text-danger fw-bold' : 'text-muted'}">${r.overdue}</td>
            <td class="text-center ${r.highPriority > 0 ? 'text-warning fw-bold' : 'text-muted'}">${r.highPriority}</td>
        </tr>`;
    }).join('');
}

function renderMyTasks(tasks) {
    const container = document.getElementById('mytasks-list');
    if (!container) return;

    if (!tasks || tasks.length === 0) {
        container.innerHTML = '<div class="text-center text-muted w-100 py-5">Bạn không có công việc nào đang được giao.</div>';
        return;
    }

    container.innerHTML = tasks.map(t => {
        const safeName = escapeHtml(t.name);
        const safeProjectId = escapeHtml(escapeJs(t.project_id));
        const statusColor = typeof getStatusColor === 'function' ? getStatusColor(t.status) : '#6c757d';
        return `
            <div class="task-card" style="border-left-color:${statusColor}; cursor:pointer;" onclick="goToTaskInProject('${safeProjectId}')">
                <div class="d-flex justify-content-between align-items-start">
                    <span class="fw-bold text-primary" style="font-size: 1.05rem;">${safeName}${getBlockedBadge(t)}</span>
                    ${renderBadge('priority', t.priority)}
                </div>
                <div class="small text-muted mb-2"><i class="fa-solid fa-diagram-project me-1"></i>${escapeHtml(t.projectName || '')}</div>
                <div class="d-flex align-items-center gap-2 flex-wrap">
                    ${renderBadge('status', t.status)}
                    ${t.dueDate ? `<span class="small text-muted">Hạn: ${escapeHtml(t.dueDate)}</span>` : ''}
                    ${getDueDateBadge(t.dueDate, t.status)}
                </div>
            </div>`;
    }).join('');
}

// Nhảy từ "Việc của tôi" sang màn Task của đúng dự án chứa task đó
function goToTaskInProject(projectId) {
    const taskNavItem = document.querySelector('.nav-item[data-section="task"]');
    if (taskNavItem) taskNavItem.click();

    let attempts = 0;
    const tryPick = () => {
        const select = document.getElementById('task-project-select');
        const hasOption = select && Array.from(select.options).some(o => o.value === projectId);
        if (hasOption) {
            select.value = projectId;
            select.dispatchEvent(new Event('change'));
        } else if (attempts < 20) {
            attempts++;
            setTimeout(tryPick, 200);
        }
    };
    setTimeout(tryPick, 200);
}

//  QUẢN LÝ NGƯỜI DÙNG (ADMIN) — chỉ quản lý hồ sơ quyền (public.users), không tạo/xóa được
// tài khoản đăng nhập Firebase Auth thật. Gate quyền chỉ ở client (cùng mức bảo mật hiện có
// của cả app — chưa có RLS thật sự trên Supabase).
const USER_GROUP_LABELS = { guest: 'Guest', finance: 'Finance', science: 'Science', all: 'All (Toàn quyền)' };

async function loadAdminUsers() {
    const guard = document.getElementById('admin-users-guard');
    const body = document.getElementById('admin-users-body');
    if (!guard || !body) return;

    body.style.display = 'none';
    guard.innerHTML = '<div class="text-center text-muted py-5"><i class="fa-solid fa-spinner fa-spin"></i> Đang kiểm tra quyền...</div>';

    const email = (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null;
    if (!email) {
        guard.innerHTML = '<div class="text-center text-muted py-5">Chưa đăng nhập.</div>';
        return;
    }

    try {
        const groupResp = await callGAS('getUserGroup', { email });
        const myGroup = groupResp.status === 'success' ? groupResp.data : 'guest';
        if (myGroup !== 'all') {
            guard.innerHTML = '<div class="text-center text-danger py-5"><i class="fa-solid fa-lock fa-2x mb-2"></i><br>Bạn không có quyền truy cập trang này.</div>';
            return;
        }
        guard.innerHTML = '';
        body.style.display = 'block';
        loadAdminUsersTable();
    } catch (err) {
        guard.innerHTML = `<div class="text-danger text-center py-5">Lỗi: ${err.message}</div>`;
    }
}

async function loadAdminUsersTable() {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';

    try {
        const response = await callGAS('listAllUsers', {});
        if (response.status !== 'success') throw new Error(response.message);
        renderAdminUsersTable(response.data || []);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-danger text-center py-4">Lỗi: ${err.message}</td></tr>`;
    }
}

function renderAdminUsersTable(users) {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Chưa có hồ sơ người dùng nào.</td></tr>';
        return;
    }

    const myEmail = (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null;

    tbody.innerHTML = users.map(u => {
        const safeEmail = escapeHtml(escapeJs(u.email));
        const groupOptions = Object.keys(USER_GROUP_LABELS).map(g =>
            `<option value="${g}" ${g === u.group_key ? 'selected' : ''}>${USER_GROUP_LABELS[g]}</option>`
        ).join('');
        const createdStr = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '--';
        const isSelf = !!(myEmail && myEmail.toLowerCase() === (u.email || '').toLowerCase());

        return `
            <tr>
                <td>${escapeHtml(u.email)}${isSelf ? ' <span class="badge bg-secondary">Bạn</span>' : ''}</td>
                <td>${escapeHtml(u.nickname || '')}</td>
                <td>
                    <select class="form-select form-select-sm" style="min-width:140px;" onchange="updateUserGroupAction('${safeEmail}', this.value)">
                        ${groupOptions}
                    </select>
                </td>
                <td class="small text-muted">${createdStr}</td>
                <td class="text-center">
                    <button class="btn btn-sm text-danger border-0" title="Thu hồi quyền" onclick="removeUserAction('${safeEmail}', ${isSelf})">
                        <i class="fa-solid fa-user-slash"></i>
                    </button>
                </td>
            </tr>`;
    }).join('');
}

async function updateUserGroupAction(email, newGroup) {
    try {
        const response = await callGAS('updateUserGroup', { email, groupKey: newGroup });
        if (response.status !== 'success') throw new Error(response.message);
        showToast(response.data || response.message, 'success');
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
        loadAdminUsersTable();
    }
}

function removeUserAction(email, isSelf) {
    Swal.fire({
        title: isSelf ? 'Bạn đang tự thu hồi quyền của chính mình?' : `Thu hồi quyền của ${email}?`,
        text: isSelf
            ? 'Bạn sẽ mất quyền truy cập ngay khi hồ sơ bị xóa. Hành động khó hoàn tác nếu không còn ai khác có quyền "all".'
            : 'Người này sẽ không truy cập được app nữa. Tài khoản đăng nhập của họ (nếu có) vẫn còn tồn tại, chỉ mất hồ sơ quyền.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Thu hồi',
        cancelButtonText: 'Hủy'
    }).then(async (result) => {
        if (!result.isConfirmed) return;
        try {
            const response = await callGAS('removeUser', { email });
            if (response.status !== 'success') throw new Error(response.message);
            showToast(response.data || response.message, 'success');
            loadAdminUsersTable();
        } catch (err) {
            showToast('Lỗi: ' + err.message, 'error');
        }
    });
}

//  CHỌN CÔNG VIỆC CHẶN (DEPENDENCY)
let blockersExpanded = false;
function showBlockerCheckboxes() {
    const box = document.getElementById('blocker-checkboxes');
    if (!box) return;
    blockersExpanded = !blockersExpanded;
    box.style.display = blockersExpanded ? 'block' : 'none';
}

// hàm tải danh sách checkbox công việc trong cùng dự án để chọn làm "chặn bởi" (loại trừ chính task đang sửa)
function loadBlockerCheckboxes(excludeTaskId) {
    const container = document.getElementById('blocker-checkboxes');
    if (!container) return;
    const tasks = (globalAllTasks || []).filter(t => t.id !== excludeTaskId);

    if (tasks.length === 0) {
        container.innerHTML = '<div class="p-2 text-muted small">Chưa có công việc nào khác trong dự án.</div>';
        return;
    }

    container.innerHTML = '';
    tasks.forEach(t => {
        const label = document.createElement('label');
        label.style.display = 'block';
        label.style.padding = '5px 10px';
        label.style.cursor = 'pointer';
        label.onmouseover = function () { this.style.backgroundColor = '#f1f1f1'; };
        label.onmouseout = function () { this.style.backgroundColor = 'transparent'; };
        label.innerHTML = `<input type="checkbox" name="task-blockers" value="${escapeHtml(t.id)}" style="margin-right:8px;" /> ${escapeHtml(t.name)}`;
        container.appendChild(label);
    });
}

//  BÌNH LUẬN & LỊCH SỬ TASK
let currentActivityTaskId = null;
let taskActivityUserMap = {};
const TASK_ACTION_LABELS = {
    saveTask: 'Đã lưu / cập nhật công việc',
    deleteTask: 'Đã xóa công việc',
    addTaskComment: 'Đã thêm bình luận',
    uploadFileToTask: 'Đã tải tệp lên',
    deleteFileFromTask: 'Đã xóa tệp'
};

async function openTaskActivity(taskId, taskName) {
    currentActivityTaskId = taskId;
    const nameEl = document.getElementById('task-activity-name');
    if (nameEl) nameEl.textContent = taskName;
    switchTaskActivityTab('comments');
    showModal('task-activity-modal');

    const mentionContainer = document.getElementById('comment-mention-checkboxes');
    if (mentionContainer) mentionContainer.innerHTML = '<div class="p-2 text-muted small">Đang tải...</div>';

    try {
        const userResp = await callGAS('getAllUsers', { groupKey: activeGroup });
        taskActivityUserMap = {};
        if (userResp.status === 'success' && Array.isArray(userResp.data)) {
            userResp.data.forEach(u => { taskActivityUserMap[u.email] = u.name; });

            if (mentionContainer) {
                mentionContainer.innerHTML = '';
                userResp.data.forEach(u => {
                    const label = document.createElement('label');
                    label.style.display = 'block';
                    label.style.padding = '5px 10px';
                    label.style.cursor = 'pointer';
                    label.onmouseover = function () { this.style.backgroundColor = '#f1f1f1'; };
                    label.onmouseout = function () { this.style.backgroundColor = 'transparent'; };
                    label.innerHTML = `<input type="checkbox" name="comment-mentions" value="${escapeHtml(u.email)}" style="margin-right:8px;" /> ${escapeHtml(u.name)}`;
                    mentionContainer.appendChild(label);
                });
            }
        }
    } catch (err) { taskActivityUserMap = {}; }

    loadTaskComments(taskId);
    loadTaskHistory(taskId);
    loadTaskChecklist(taskId);
}

let mentionCheckboxesExpanded = false;
function showMentionCheckboxes() {
    const box = document.getElementById('comment-mention-checkboxes');
    if (!box) return;
    mentionCheckboxesExpanded = !mentionCheckboxesExpanded;
    box.style.display = mentionCheckboxesExpanded ? 'block' : 'none';
}

function switchTaskActivityTab(tab) {
    document.querySelectorAll('.task-activity-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tab));
    const commentsPanel = document.getElementById('task-activity-comments-panel');
    const historyPanel = document.getElementById('task-activity-history-panel');
    const checklistPanel = document.getElementById('task-activity-checklist-panel');
    if (commentsPanel) commentsPanel.style.display = tab === 'comments' ? 'block' : 'none';
    if (historyPanel) historyPanel.style.display = tab === 'history' ? 'block' : 'none';
    if (checklistPanel) checklistPanel.style.display = tab === 'checklist' ? 'block' : 'none';
}

//  DANH SÁCH KIỂM TRONG TASK
async function loadTaskChecklist(taskId) {
    const list = document.getElementById('task-checklist-list');
    if (!list) return;
    list.innerHTML = '<div class="p-2 text-muted small">Đang tải...</div>';
    try {
        const response = await callGAS('getChecklist', { taskId });
        if (response.status !== 'success') throw new Error(response.message);
        renderTaskChecklist(response.data || []);
    } catch (err) {
        list.innerHTML = `<div class="text-danger small p-2">Lỗi: ${escapeHtml(err.message)}</div>`;
    }
}

function renderTaskChecklist(items) {
    const list = document.getElementById('task-checklist-list');
    if (!list) return;

    if (!items || items.length === 0) {
        list.innerHTML = '<div class="p-2 text-muted small">Chưa có mục nào.</div>';
        return;
    }

    const doneCount = items.filter(x => x.done).length;
    const header = `<div class="checklist-progress small text-muted mb-2">${doneCount}/${items.length} đã xong</div>`;

    list.innerHTML = header + items.map(it => {
        const safeId = escapeHtml(escapeJs(it.id));
        return `<div class="checklist-item${it.done ? ' is-done' : ''}">
            <label class="d-flex align-items-center gap-2 flex-grow-1" style="cursor:pointer; margin:0;">
                <input type="checkbox" ${it.done ? 'checked' : ''} onchange="toggleChecklistItemAction('${safeId}', this.checked)">
                <span class="checklist-item-text">${escapeHtml(it.text)}</span>
            </label>
            <button class="btn btn-sm text-danger border-0" title="Xóa" onclick="deleteChecklistItemAction('${safeId}')">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>`;
    }).join('');
}

async function toggleChecklistItemAction(itemId, done) {
    if (!currentActivityTaskId) return;
    try {
        const response = await callGAS('toggleChecklistItem', { taskId: currentActivityTaskId, itemId, done });
        if (response.status !== 'success') throw new Error(response.message);
        renderTaskChecklist(response.data || []);
        refreshTaskListAfterChecklistChange();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
        loadTaskChecklist(currentActivityTaskId);
    }
}

async function deleteChecklistItemAction(itemId) {
    if (!currentActivityTaskId) return;
    try {
        const response = await callGAS('deleteChecklistItem', { taskId: currentActivityTaskId, itemId });
        if (response.status !== 'success') throw new Error(response.message);
        renderTaskChecklist(response.data || []);
        refreshTaskListAfterChecklistChange();
    } catch (err) {
        showToast('Lỗi: ' + err.message, 'error');
    }
}

// Cập nhật badge "x/y" trên danh sách task mà không phải tải lại cả trang
function refreshTaskListAfterChecklistChange() {
    if (typeof loadTasksForProject === 'function' && currentTaskProjectID) {
        loadTasksForProject(currentTaskProjectID);
    }
}

async function loadTaskComments(taskId) {
    const list = document.getElementById('task-comment-list');
    if (!list) return;
    list.innerHTML = '<div class="p-2 text-muted small">Đang tải...</div>';
    try {
        const response = await callGAS('getTaskComments', { taskId });
        if (response.status !== 'success') throw new Error(response.message);
        const comments = response.data || [];
        if (comments.length === 0) {
            list.innerHTML = '<div class="p-2 text-muted small">Chưa có bình luận nào.</div>';
            return;
        }
        list.innerHTML = comments.map(c => {
            const authorName = taskActivityUserMap[c.author_email] || c.author_email;
            const time = new Date(c.created_at).toLocaleString('vi-VN');
            return `<div class="task-comment-item">
                <div class="task-comment-meta"><span class="fw-bold">${escapeHtml(authorName)}</span><span class="text-muted small ms-2">${time}</span></div>
                <div class="task-comment-content">${escapeHtml(c.content)}</div>
            </div>`;
        }).join('');
        list.scrollTop = list.scrollHeight;
    } catch (err) {
        list.innerHTML = `<div class="text-danger small p-2">Lỗi: ${err.message}</div>`;
    }
}

async function loadTaskHistory(taskId) {
    const list = document.getElementById('task-history-list');
    if (!list) return;
    list.innerHTML = '<div class="p-2 text-muted small">Đang tải...</div>';
    try {
        const response = await callGAS('getTaskHistory', { taskId });
        if (response.status !== 'success') throw new Error(response.message);
        const logs = response.data || [];
        if (logs.length === 0) {
            list.innerHTML = '<div class="p-2 text-muted small">Chưa có lịch sử.</div>';
            return;
        }
        list.innerHTML = logs.map(l => {
            const authorName = taskActivityUserMap[l.user_email] || l.user_email || 'unknown';
            const time = new Date(l.created_at).toLocaleString('vi-VN');
            const actionLabel = TASK_ACTION_LABELS[l.action] || l.action;
            return `<div class="task-history-item">
                <div class="task-history-meta"><span class="fw-bold">${escapeHtml(authorName)}</span><span class="text-muted small ms-2">${time}</span></div>
                <div class="task-history-content small">${escapeHtml(actionLabel)}</div>
            </div>`;
        }).join('');
    } catch (err) {
        list.innerHTML = `<div class="text-danger small p-2">Lỗi: ${err.message}</div>`;
    }
}

// hàm reset modal task về trạng thái sạch (không còn dấu vết sửa/thêm-việc-con trước đó)
// updated_at của bản task đang mở trong modal sửa — gửi kèm khi lưu để phát hiện
// trường hợp người khác đã sửa trong lúc mình đang mở form (xem API.task.save).
let editingTaskBaseUpdatedAt = null;

function resetTaskModalUI() {
    const form = document.getElementById('task-form');
    if (form) form.reset();
    editingTaskBaseUpdatedAt = null;
    document.getElementById('task-id').value = '';
    document.getElementById('new-task-parent-id').value = '';
    document.querySelectorAll('input[name="task-assignees"]').forEach(cb => cb.checked = false);
    document.querySelectorAll('input[name="task-blockers"]').forEach(cb => cb.checked = false);

    const subtaskLabel = document.getElementById('subtask-of-label');
    if (subtaskLabel) subtaskLabel.style.display = 'none';

    const submitBtn = document.querySelector('#task-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = "Lưu Công Việc";
}

// hàm mở modal để thêm task mới (top-level)
function openAddTask() {
    resetTaskModalUI();
    if (typeof currentTaskProjectID !== 'undefined' && currentTaskProjectID) {
        document.getElementById('new-task-project-id').value = currentTaskProjectID;
    }
    loadBlockerCheckboxes('');
    showModal('add-task-modal');
}

// hàm mở modal để thêm việc con cho 1 task cha
function openAddSubtask(parentId, parentName) {
    resetTaskModalUI();
    if (typeof currentTaskProjectID !== 'undefined' && currentTaskProjectID) {
        document.getElementById('new-task-project-id').value = currentTaskProjectID;
    }
    document.getElementById('new-task-parent-id').value = parentId;
    const subtaskLabel = document.getElementById('subtask-of-label');
    const subtaskName = document.getElementById('subtask-of-name');
    if (subtaskLabel && subtaskName) {
        subtaskName.textContent = parentName;
        subtaskLabel.style.display = 'block';
    }
    loadBlockerCheckboxes('');
    showModal('add-task-modal');
}

//  HÀM MỞ MODAL SỬA TASK
function openEditTask(id, name, status, priority, dueDate, assigneesStr, description, parentTaskId, blockedByStr) {
    const sourceTask = (globalAllTasks || []).find(t => t.id === id);
    editingTaskBaseUpdatedAt = sourceTask ? (sourceTask.updated_at || null) : null;

    const labelsInput = document.getElementById('new-task-labels');
    if (labelsInput) labelsInput.value = sourceTask ? (sourceTask.labels || '') : '';

    document.getElementById('task-id').value = id;
    document.getElementById('new-task-name').value = name;
    document.getElementById('new-task-status').value = status;
    document.getElementById('new-task-priority').value = priority;
    document.getElementById('new-task-duedate').value = dueDate;
    document.getElementById('new-task-desc').value = description || '';
    document.getElementById('new-task-parent-id').value = parentTaskId || '';

    loadBlockerCheckboxes(id);
    const blockerIds = (blockedByStr || '').split(',').map(x => x.trim()).filter(Boolean);
    document.querySelectorAll('input[name="task-blockers"]').forEach(cb => {
        cb.checked = blockerIds.includes(cb.value);
    });

    const subtaskLabel = document.getElementById('subtask-of-label');
    const subtaskName = document.getElementById('subtask-of-name');
    if (subtaskLabel && subtaskName) {
        if (parentTaskId) {
            const parent = (globalAllTasks || []).find(t => t.id === parentTaskId);
            subtaskName.textContent = parent ? parent.name : parentTaskId;
            subtaskLabel.style.display = 'block';
        } else {
            subtaskLabel.style.display = 'none';
        }
    }

    if (typeof currentTaskProjectID !== 'undefined' && currentTaskProjectID) {
        document.getElementById('new-task-project-id').value = currentTaskProjectID;
    }

    // Tick vào những người đã được giao
    const checkboxes = document.querySelectorAll('input[name="task-assignees"]');
    const assignedEmails = (assigneesStr || '').toLowerCase().split(',').map(e => e.trim());

    checkboxes.forEach(cb => {
        cb.checked = assignedEmails.includes(cb.value.toLowerCase());
    });

    const submitBtn = document.querySelector('#task-form button[type="submit"]');
    if (submitBtn) submitBtn.innerHTML = "Cập nhật";

    showModal('add-task-modal');
}

async function handleTaskFormSubmit(e) {
    if (e) e.preventDefault();

    const form = document.getElementById('task-form');
    const submitBtn = form.querySelector('button[type="submit"]');

    // Gom danh sách email được tick
    const checkboxes = document.querySelectorAll('input[name="task-assignees"]:checked');
    const selectedEmails = Array.from(checkboxes).map(cb => cb.value).join(',');

    // Gom danh sách công việc chặn được tick
    const blockerCbs = document.querySelectorAll('input[name="task-blockers"]:checked');
    const selectedBlockers = Array.from(blockerCbs).map(cb => cb.value).join(',');

    // Gom dữ liệu từ form
    const taskData = {
        id: document.getElementById('task-id').value,
        projectId: document.getElementById('new-task-project-id').value,
        name: document.getElementById('new-task-name').value,
        status: document.getElementById('new-task-status').value,
        priority: document.getElementById('new-task-priority').value,
        dueDate: document.getElementById('new-task-duedate').value,
        assignees: selectedEmails,
        description: document.getElementById('new-task-desc').value,
        parentTaskId: document.getElementById('new-task-parent-id').value || null,
        blockedBy: selectedBlockers,
        labels: normalizeLabels(document.getElementById('new-task-labels') ? document.getElementById('new-task-labels').value : ''),
        baseUpdatedAt: editingTaskBaseUpdatedAt
    };

    if (!taskData.projectId) {
        showToast("Lỗi: Không xác định được Dự án! Vui lòng chọn lại dự án.", "error");
        if (typeof hideModal === 'function') hideModal('add-task-modal');
        return;
    }

    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';

    try {
        const response = await callGAS("saveTask", {
            ...taskData,
            groupKey: activeGroup
        });

        if (response.status === 'success') {
            showToast(response.data || response.message, "success");
            if (typeof hideModal === 'function') hideModal('add-task-modal');

            resetTaskModalUI();

            if (typeof loadTasksForProject === 'function') loadTasksForProject(taskData.projectId);
            if (typeof loadProjectOverview === 'function') loadProjectOverview();
        } else {
            showToast("Lỗi: " + response.message, "error");
        }

    } catch (err) {
        console.error("Lỗi submit task:", err);
        showToast("Lỗi hệ thống: " + (err.message || err), "error");
    } finally {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
    }
}


//  HÀM XÓA TASK 
function deleteTaskAction(taskId, taskName) {
    Swal.fire({
        title: 'Xóa Công Việc?',
        text: `Bạn có chắc chắn muốn xóa công việc: "${taskName}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa liền đi người ae!',
        cancelButtonText: 'Nghĩ lại òi!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang xóa công việc...',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS("deleteTask", {
                    taskId: taskId,
                    projectId: currentTaskProjectID, // Cần ID Project để tính lại %
                    groupKey: activeGroup
                });

                if (response.status === 'success') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Thành công',
                        text: response.data || response.message, // Server trả về message
                        timer: 1500,
                        showConfirmButton: false
                    });

                    // Tải lại dữ liệu
                    if (typeof currentTaskProjectID !== 'undefined' && currentTaskProjectID) {
                        if (typeof loadTasksForProject === 'function') loadTasksForProject(currentTaskProjectID);
                        if (typeof loadProjectOverview === 'function') loadProjectOverview();
                    }
                } else {
                    Swal.fire('Lỗi!', "Không thể xóa: " + response.message, 'error');
                }

            } catch (err) {
                console.error("Lỗi xóa task:", err);
                Swal.fire('Lỗi!', "Lỗi kết nối: " + (err.message || err), 'error');
            }
        }
    });
}




//  8. CÁC HÀM HELPER 

// Helper: Render Badge HTML
function renderBadge(type, value) {
    let className = '';
    if (type === 'status') {
        if (value === 'Done') className = 'bg-done';
        else if (value === 'Working on it') className = 'bg-working';
        else if (value === 'Stuck') className = 'bg-stuck';
        else className = 'bg-not-started';
    } else if (type === 'priority') {
        if (value === 'Critical') className = 'bg-critical';
        else if (value === 'High') className = 'bg-high';
        else if (value === 'Medium') className = 'bg-medium';
        else className = 'bg-low';
    }
    return `<span class="status-badge ${className}">${value}</span>`;
}

// Helper: Lấy màu viền/màu bar
function getStatusColor(status) {
    if (status === 'Done') return '#00c875';
    if (status === 'Working on it') return '#fdab3d';
    if (status === 'Stuck') return '#e2445c';
    return '#c4c4c4';
}

// Badge cảnh báo hạn task: đỏ nếu đã quá hạn, vàng nếu còn <=2 ngày. Ẩn khi task đã Done.
function getDueDateBadge(dueDate, status) {
    if (!dueDate || status === 'Done') return '';
    const due = new Date(dueDate + 'T00:00:00');
    if (isNaN(due.getTime())) return '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / 86400000);
    if (diffDays < 0) return `<span class="due-badge overdue"><i class="fa-solid fa-triangle-exclamation"></i> Quá hạn</span>`;
    if (diffDays <= 2) return `<span class="due-badge due-soon"><i class="fa-regular fa-clock"></i> Sắp đến hạn</span>`;
    return '';
}

// Badge tiến độ checklist, ví dụ "3/5" — chỉ hiện khi task có checklist
function getChecklistBadge(task) {
    const list = Array.isArray(task.checklist) ? task.checklist : [];
    if (list.length === 0) return '';
    const done = list.filter(x => x && x.done).length;
    const allDone = done === list.length;
    return `<span class="checklist-badge${allDone ? ' is-complete' : ''}" title="Danh sách kiểm: ${done}/${list.length} xong"><i class="fa-regular fa-square-check"></i> ${done}/${list.length}</span>`;
}

//  NHÃN CÔNG VIỆC
// Chuẩn hóa chuỗi nhãn người dùng gõ: bỏ khoảng trắng thừa, bỏ rỗng, bỏ trùng (không phân biệt hoa thường)
function normalizeLabels(raw) {
    const seen = new Set();
    const out = [];
    String(raw || '').split(',').forEach(part => {
        const label = part.trim();
        if (!label) return;
        const key = label.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(label);
    });
    return out.join(', ');
}

function parseLabels(value) {
    return String(value || '').split(',').map(x => x.trim()).filter(Boolean);
}

// Màu chip suy ra từ chính tên nhãn để cùng một nhãn luôn có cùng màu ở mọi nơi
function labelHue(label) {
    let hash = 0;
    const s = String(label).toLowerCase();
    for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) % 360;
    return hash;
}

// Đổ danh sách nhãn có thật trong dự án đang xem vào dropdown lọc, giữ lại lựa chọn hiện
// tại nếu nhãn đó vẫn còn tồn tại (tránh nhảy về "Tất cả" mỗi lần tải lại task).
function populateLabelFilter() {
    const select = document.getElementById('filter-label');
    if (!select) return;

    const prevVal = select.value;
    const seen = new Set();
    const labels = [];
    (globalAllTasks || []).forEach(t => {
        parseLabels(t.labels).forEach(l => {
            const key = l.toLowerCase();
            if (!seen.has(key)) { seen.add(key); labels.push(l); }
        });
    });
    labels.sort((a, b) => a.localeCompare(b, 'vi'));

    select.innerHTML = '<option value="all">Tất cả nhãn</option>' +
        labels.map(l => `<option value="${escapeHtml(l.toLowerCase())}">${escapeHtml(l)}</option>`).join('');

    if (labels.some(l => l.toLowerCase() === prevVal)) select.value = prevVal;
}

function renderLabelChips(labelsValue) {
    const labels = parseLabels(labelsValue);
    if (labels.length === 0) return '';
    return labels.map(l => {
        const hue = labelHue(l);
        return `<span class="task-label-chip" style="--label-hue:${hue};">${escapeHtml(l)}</span>`;
    }).join('');
}

// Badge "Bị chặn": hiện khi task còn công việc phụ thuộc (blocked_by) chưa Done
function getBlockedBadge(task) {
    if (!task.blocked_by) return '';
    const blockerIds = task.blocked_by.split(',').map(x => x.trim()).filter(Boolean);
    if (blockerIds.length === 0) return '';
    const unfinished = blockerIds
        .map(id => (globalAllTasks || []).find(t => t.id === id))
        .filter(b => b && String(b.status).toLowerCase() !== 'done');
    if (unfinished.length === 0) return '';
    const names = unfinished.map(b => escapeHtml(b.name)).join(', ');
    return `<span class="blocked-badge" title="Bị chặn bởi: ${names}"><i class="fa-solid fa-lock"></i> Bị chặn</span>`;
}

function getProgressBarColor(percent) {
    if (percent == 100) return 'bg-success';
    if (percent >= 50) return 'bg-primary';
    if (percent > 0) return 'bg-warning';
    return 'bg-secondary';
}



//  hàm tải danh sách checkbox thành viên
async function loadMemberCheckboxes() {
    const container = document.getElementById('checkboxes');
    if (!container) return;

    container.innerHTML = '<div class="p-2 small text-muted">Đang tải...</div>';

    try {
        const response = await callGAS("getAllUsers", {
            groupKey: activeGroup
        });

        if (response.status === 'success') {
            const users = response.data;
            container.innerHTML = '';

            if (!users || users.length === 0) {
                container.innerHTML = '<div class="p-2 small text-muted">Chưa có thành viên.</div>';
                return;
            }

            users.forEach(u => {
                const label = document.createElement('label');
                label.style.display = 'block';
                label.style.padding = '5px 10px';
                label.style.cursor = 'pointer';
                label.onmouseover = function () { this.style.backgroundColor = '#f1f1f1'; };
                label.onmouseout = function () { this.style.backgroundColor = 'transparent'; };

                label.innerHTML = `<input type="checkbox" name="task-assignees" value="${escapeHtml(u.email)}" style="margin-right:8px;" /> ${escapeHtml(u.name)}`;
                container.appendChild(label);
            });
        } else {
            container.innerHTML = `<div class="text-danger p-2 small">Lỗi: ${response.message}</div>`;
        }

    } catch (err) {
        console.error("Lỗi tải thành viên:", err);
        container.innerHTML = `<div class="text-danger p-2 small">Lỗi kết nối server!</div>`;
    }
}

// Hàm UI toggle 
let expanded = false;
function showCheckboxes() {
    const checkboxes = document.getElementById("checkboxes");
    if (!expanded) {
        checkboxes.style.display = "block";
        expanded = true;
    } else {
        checkboxes.style.display = "none";
        expanded = false;
    }
}

//  hàm tải dropdown assignee filter
async function loadAssigneeDropdown() {
    const assigneeSelect = document.getElementById('filter-assignee');
    if (!assigneeSelect) return;

    // Kiểm tra biến activeGroup, nếu chưa có thì gán là 'all'
    const currentGroup = (typeof activeGroup !== 'undefined') ? activeGroup : 'all';

    try {
        const response = await callGAS("getAllUsers", {
            groupKey: currentGroup
        });

        if (response.status === 'success') {
            const members = response.data;

            assigneeSelect.innerHTML = '<option value="all">Tất cả thành viên</option>';

            if (members && members.length > 0) {
                members.forEach(m => {
                    const opt = document.createElement('option');
                    // Lưu email chữ thường để so sánh cho dễ
                    opt.value = m.email.toLowerCase().trim();
                    opt.textContent = m.name;
                    assigneeSelect.appendChild(opt);
                });
            }
        } else {
            console.error("Lỗi tải assignee filter:", response.message);
        }

    } catch (err) {
        console.error("Lỗi kết nối assignee filter:", err);
    }
}

function applyTaskFilters() {
    const nameInput = document.getElementById('filter-task-name');
    const statusInput = document.getElementById('filter-status');
    const priorityInput = document.getElementById('filter-priority');
    const assigneeInput = document.getElementById('filter-assignee');
    const labelInput = document.getElementById('filter-label');

    const nameVal = nameInput ? nameInput.value.toLowerCase() : '';
    const statusVal = statusInput ? statusInput.value : 'all';
    const priorityVal = priorityInput ? priorityInput.value : 'all';
    const assigneeVal = assigneeInput ? assigneeInput.value.toLowerCase() : 'all';
    const labelVal = labelInput ? labelInput.value.toLowerCase() : 'all';

    if (!globalAllTasks) globalAllTasks = [];

    const filteredTasks = globalAllTasks.filter(t => {
        const matchName = t.name.toLowerCase().includes(nameVal);
        const matchStatus = (statusVal === 'all') || (t.status === statusVal);
        const matchPriority = (priorityVal === 'all') || (t.priority === priorityVal);
        const assigneeList = t.assignees ? t.assignees.toLowerCase().split(',').map(e => e.trim()) : [];
        const matchAssignee = (assigneeVal === 'all') || assigneeList.includes(assigneeVal);
        const taskLabels = parseLabels(t.labels).map(l => l.toLowerCase());
        const matchLabel = (labelVal === 'all') || taskLabels.includes(labelVal);

        return matchName && matchStatus && matchPriority && matchAssignee && matchLabel;
    });

    if (typeof renderTasks === 'function') {
        renderTasks(filteredTasks);
    }
    if (typeof renderKanbanBoard === 'function') {
        renderKanbanBoard(filteredTasks);
    }
    if (typeof refreshBulkSelectionUI === 'function') {
        refreshBulkSelectionUI();
    }
}

function onProjectChange() {
    const select = document.getElementById('task-project-select');
    const projectId = select.value;

    if (typeof loadTasksForProject === 'function') {
        loadTasksForProject(projectId);
    } else {
        console.error("Chưa có hàm loadTasksForProject!");
    }
}



//  hàm lọc file theo loại
function filterFileByType(type, btnElement) {
    const container = document.getElementById('file-filter-group');
    if (container) {
        const buttons = container.getElementsByTagName('button');
        for (let btn of buttons) {
            btn.classList.remove('btn-primary', 'text-white', 'shadow-sm');
            btn.classList.add('btn-light', 'border');
        }
    }

    if (btnElement) {
        btnElement.classList.remove('btn-light', 'border');
        btnElement.classList.add('btn-primary', 'text-white', 'shadow-sm');
    }

    if (!currentTaskFiles) currentTaskFiles = [];

    let filtered = [];
    if (type === 'all') {
        filtered = currentTaskFiles;
    } else {
        filtered = currentTaskFiles.filter(f => {
            // Chuẩn hóa loại file
            const fType = (f.mimeType || f.type || '').toLowerCase();
            const fName = (f.name || '').toLowerCase();

            if (type === 'image') return fType.includes('image') || /\.(jpg|png|jpeg|gif)$/.test(fName);
            if (type === 'pdf') return fType.includes('pdf') || fName.endsWith('.pdf');
            if (type === 'sheet') return fType.includes('sheet') || fType.includes('excel') || fType.includes('spreadsheet') || fName.endsWith('.xlsx');
            if (type === 'doc') return fType.includes('word') || fType.includes('document') || fName.endsWith('.docx');
            return false;
        });
    }

    if (typeof renderFileList === 'function') {
        renderFileList(filtered);
    }
}



// Biến toàn cục để lưu mô tả tự động
var globalAutoDescription = "";

function openFileModal(taskId, filesJsonString, taskName) {
    const hiddenInput = document.getElementById('current-upload-task-id');
    if (hiddenInput) {
        hiddenInput.value = taskId;
    } else {
        console.error("Lỗi: Thiếu thẻ input hidden ID");
        return;
    }

    // tạo mô tả tự động theo tên dự án + tên task
    const projectSelect = document.getElementById('task-project-select');
    let projectName = "";
    if (projectSelect && projectSelect.selectedIndex >= 0) {
        const text = projectSelect.options[projectSelect.selectedIndex].text;
        if (!text.includes("Đang tải") && !text.includes("Chọn Dự Án") && !text.includes("--")) {
            projectName = text;
        }
    }
    window.globalAutoDescription = projectName ? `${projectName} - ${taskName}` : taskName;

    // Reset bộ lọc tìm kiếm & Button
    const searchInput = document.getElementById('file-search-input');
    if (searchInput) searchInput.value = '';

    const filterGroup = document.getElementById('file-filter-group');
    if (filterGroup) {
        const btns = filterGroup.getElementsByTagName('button');
        for (let btn of btns) {
            btn.classList.remove('btn-primary', 'text-white', 'shadow-sm');
            btn.classList.add('btn-light', 'border');

            // Mặc định chọn nút "Tất cả"
            if (btn.textContent.includes('Tất cả')) {
                btn.classList.remove('btn-light', 'border');
                btn.classList.add('btn-primary', 'text-white', 'shadow-sm');
            }
        }
    }

    let filesToRender = [];

    if (typeof globalAllTasks !== 'undefined' && Array.isArray(globalAllTasks)) {
        // Tìm task trong mảng gốc để lấy dữ liệu file mới nhất
        const foundTask = globalAllTasks.find(t => String(t.id) === String(taskId));

        if (foundTask) {
            let rawAttachments = foundTask.attachments;

            if (typeof rawAttachments === 'string') {
                try {
                    filesToRender = JSON.parse(rawAttachments);
                } catch (e) { filesToRender = []; }
            } else if (Array.isArray(rawAttachments)) {
                filesToRender = rawAttachments;
            }
        }
    }

    if (filesToRender.length === 0 && filesJsonString) {
        try { filesToRender = JSON.parse(filesJsonString); } catch (e) { filesToRender = []; }
    }

    // Cập nhật biến toàn cục hiện tại (để các hàm filter/render khác sử dụng)
    currentTaskFiles = filesToRender;

    if (typeof renderFileList === 'function') {
        renderFileList(currentTaskFiles);
    }

    const modalEl = document.getElementById('fileModal');
    if (modalEl) {
        // Kiểm tra xem Modal đã có instance chưa để tránh tạo trùng
        let myModal = bootstrap.Modal.getInstance(modalEl);
        if (!myModal) {
            myModal = new bootstrap.Modal(modalEl);
        }
        myModal.show();
    }
}



/**
 * Quản lý File trong Task
 */

// HÀM VẼ DANH SÁCH FILE 
function renderFileList(files) {
    const tbody = document.getElementById('file-list-body');
    const footerCount = document.getElementById('file-count-display');

    if (tbody) tbody.innerHTML = '';
    if (footerCount) footerCount.textContent = `Tổng: ${files ? files.length : 0} file`;

    if (!files || files.length === 0) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center py-5 text-muted">
                        <i class="fa-solid fa-folder-open fa-3x mb-3 text-secondary opacity-25"></i>
                        <p class="mb-0">Chưa có tài liệu nào.</p>
                    </td>
                </tr>`;
        }
        return;
    }

    let html = '';
    files.forEach(f => {
        const safeUrl = escapeHtml((f && f.url) ? f.url : '#');
        const safeName = escapeHtml((f && f.name) ? f.name : 'Không tên');
        const safeType = escapeHtml((f && f.type) ? f.type : '');
        const safeDate = escapeHtml((f && f.date) ? f.date : '--/--');
        const safeDesc = escapeHtml((f && f.description) ? f.description : '');

        const safeNameForClick = escapeHtml(escapeJs((f && f.name) ? f.name : 'Không tên'));

        let iconClass = 'fa-file text-secondary';
        if (safeType.includes('image')) iconClass = 'fa-file-image text-primary';
        else if (safeType.includes('pdf')) iconClass = 'fa-file-pdf text-danger';
        else if (safeType.includes('sheet') || safeType.includes('excel')) iconClass = 'fa-file-excel text-success';
        else if (safeType.includes('word')) iconClass = 'fa-file-word text-primary';

        html += `
            <tr>
                <td>
                    <a href="${safeUrl}" target="_blank" class="text-decoration-none fw-bold text-dark d-flex align-items-center">
                        <i class="fa-solid ${iconClass} fs-5 me-2"></i> 
                        <div>
                            <span class="d-block text-truncate" style="max-width: 200px;">${safeName}</span>
                            <small class="text-muted fst-italic" style="font-size: 11px;">
                                <i class="fa-solid fa-tag me-1"></i>${safeDesc}
                            </small>
                        </div>
                    </a>
                </td>
                <td><span class="badge bg-light text-dark border">${safeType.split('/')[1] || 'File'}</span></td>
                <td class="small text-muted">${safeDate}</td>
                
                <td class="text-center text-nowrap">
                    <a href="${safeUrl}" target="_blank" class="btn btn-sm btn-outline-secondary border-0 me-1" title="Xem">
                        <i class="fa-solid fa-eye"></i>
                    </a>
                    
                    <button class="btn btn-sm btn-outline-danger border-0" 
                        title="Xóa file"
                        onclick="deleteTaskFile('${f.id}', '${safeNameForClick}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    if (tbody) tbody.innerHTML = html;
}

function deleteTaskFile(fileId, fileName) {
    const taskId = document.getElementById('current-upload-task-id').value;

    if (!taskId) {
        showToast("Lỗi: Không xác định được Task ID", "error");
        return;
    }

    Swal.fire({
        title: 'Xóa file?',
        text: `Bạn muốn xóa file "${fileName}" khỏi công việc này?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa',
        cancelButtonText: 'Hủy'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({ title: 'Đang xóa...', didOpen: () => Swal.showLoading() });

            try {
                const response = await callGAS("deleteFileFromTask", {
                    taskId: taskId,
                    fileId: fileId,
                    groupKey: activeGroup
                });

                if (response.status === 'success') {
                    Swal.fire('Đã xóa!', 'File đã được gỡ bỏ.', 'success');

                    currentTaskFiles = response.data;
                    renderFileList(currentTaskFiles);

                    if (typeof globalAllTasks !== 'undefined') {
                        const t = globalAllTasks.find(x => String(x.id) === String(taskId));
                        if (t) t.attachments = JSON.stringify(currentTaskFiles);
                    }

                    applyTaskFilters();

                } else {
                    Swal.fire('Lỗi!', response.message, 'error');
                }
            } catch (err) {
                console.error("Lỗi xóa file task:", err);
                Swal.fire('Lỗi!', "Lỗi kết nối: " + err.message, 'error');
            }
        }
    });
}

//hàm upload file lên task
async function handleTaskFileUpload() {
    const fileInput = document.getElementById('task-file-input');
    const taskId = document.getElementById('current-upload-task-id').value;
    const descInput = document.getElementById('file-description-input');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast("Vui lòng chọn file để tải lên!", "warning");
        return;
    }
    if (!taskId) {
        showToast("Lỗi: Không xác định được Task!", "error");
        return;
    }

    const file = fileInput.files[0];

    // Validate kích thước (giới hạn 5MB cho Base64 an toàn)
    if (file.size > 5 * 1024 * 1024) {
        showToast("File quá lớn! Vui lòng chọn file < 5MB.", "error");
        return;
    }

    const uploadBtn = document.getElementById('btn-upload-task-file');
    const originalText = uploadBtn.innerHTML;
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';

    // Đọc file sang Base64
    const reader = new FileReader();
    reader.onload = async function (e) {
        const base64Data = e.target.result.split(',')[1]; // Bỏ phần header "data:image/..."
        const description = (typeof globalAutoDescription !== 'undefined') ? globalAutoDescription : "";

        try {
            const response = await callGAS("uploadFileToTask", {
                fileData: base64Data,
                fileName: file.name,
                mimeType: file.type,
                taskId: taskId,
                groupKey: activeGroup,
                description: description,
                email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : "unknown"
            });

            if (response.status === 'success') {
                showToast("Tải lên thành công!", "success");
                fileInput.value = '';

                currentTaskFiles = response.data;
                renderFileList(currentTaskFiles);

                if (typeof globalAllTasks !== 'undefined') {
                    const t = globalAllTasks.find(x => String(x.id) === String(taskId));
                    if (t) t.attachments = JSON.stringify(currentTaskFiles);
                }
                applyTaskFilters();
            } else {
                showToast("Lỗi: " + response.message, "error");
            }

        } catch (err) {
            console.error("Lỗi upload:", err);
            showToast("Lỗi upload: " + err.message, "error");
        } finally {
            uploadBtn.disabled = false;
            uploadBtn.innerHTML = originalText;
        }
    };
    reader.readAsDataURL(file);
}


// hàm lọc file bên popup của task
function filterFiles() {
    const searchInput = document.getElementById('file-search-input');
    if (!searchInput) return;

    const keyword = searchInput.value.toLowerCase();

    if (!currentTaskFiles) currentTaskFiles = [];

    const filtered = currentTaskFiles.filter(f =>
        (f.name && f.name.toLowerCase().includes(keyword)) ||
        (f.date && f.date.includes(keyword))
    );

    renderFileList(filtered);
}

async function startUploadFile() {
    const fileInput = document.getElementById('task-file-input');
    const taskIdInput = document.getElementById('current-upload-task-id');

    if (!fileInput || !fileInput.files || fileInput.files.length === 0) return;
    if (!taskIdInput) return;

    const taskId = taskIdInput.value;
    const file = fileInput.files[0];

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast("File quá lớn! Vui lòng chọn file < 5MB.", "error");
        return;
    }

    const uploadBtn = fileInput.nextElementSibling; // Nút Upload nằm ngay sau input
    const originalText = uploadBtn ? uploadBtn.innerHTML : "Upload";

    if (uploadBtn) {
        uploadBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...';
        uploadBtn.disabled = true;
    }

    // Đọc file sang Base64
    const reader = new FileReader();
    reader.onload = async function (e) {
        const rawBase64 = e.target.result.split(',')[1];
        const descriptionToSend = (typeof globalAutoDescription !== 'undefined') ? globalAutoDescription : '';

        try {
            const response = await callGAS("uploadFileToTask", {
                fileData: rawBase64,
                fileName: file.name,
                mimeType: file.type,
                taskId: taskId,
                groupKey: activeGroup,
                description: descriptionToSend
            });

            if (response.status === 'success') {
                showToast("Tải lên thành công!", "success");
                fileInput.value = '';
                // Server trả về danh sách file mới trong response.data
                currentTaskFiles = response.data;
                renderFileList(currentTaskFiles);

                if (typeof globalAllTasks !== 'undefined') {
                    // Tìm Task vừa upload trong danh sách tổng
                    const foundTask = globalAllTasks.find(t => String(t.id) === String(taskId));

                    if (foundTask) {
                        // Cập nhật cột attachments của task đó trong bộ nhớ
                        foundTask.attachments = JSON.stringify(currentTaskFiles);

                        if (typeof applyTaskFilters === 'function') {
                            applyTaskFilters();
                        } else if (typeof renderTasks === 'function') {
                            renderTasks(globalAllTasks);
                        }
                    }
                }

            } else {
                showToast("Lỗi: " + response.message, "error");
            }

        } catch (err) {
            console.error("Lỗi upload:", err);
            showToast("Lỗi Server: " + err.message, "error");
        } finally {
            if (uploadBtn) {
                uploadBtn.innerHTML = originalText;
                uploadBtn.disabled = false;
            }
        }
    };

    reader.readAsDataURL(file);
}


//  hàm xóa file trong tasks
function deleteTaskFile(fileId, fileName) {
    const taskIdInput = document.getElementById('current-upload-task-id');
    const taskId = taskIdInput ? taskIdInput.value : '';

    if (!taskId) {
        Swal.fire('Lỗi', 'Không tìm thấy ID công việc.', 'error');
        return;
    }

    Swal.fire({
        title: 'Bạn chắc chứ?',
        text: `Bạn có muốn xóa file "${fileName}" không? Hành động này không thể hoàn tác!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        cancelButtonColor: '#3085d6',
        confirmButtonText: 'Xóa đi người ae!',
        cancelButtonText: 'Nghĩ lại òi!'
    }).then(async (result) => {
        if (result.isConfirmed) {
            Swal.fire({
                title: 'Đang xóa...',
                text: 'Vui lòng chờ trong giây lát',
                allowOutsideClick: false,
                didOpen: () => Swal.showLoading()
            });

            try {
                const response = await callGAS("deleteFileFromTask", {
                    taskId: taskId,
                    fileId: fileId,
                    groupKey: activeGroup
                });

                if (response.status === 'success') {
                    currentTaskFiles = response.data; // Server trả về danh sách file mới trong data
                    renderFileList(currentTaskFiles);

                    // Cập nhật dữ liệu bên ngoài 
                    if (typeof globalAllTasks !== 'undefined') {
                        const taskIndex = globalAllTasks.findIndex(t => String(t.id) === String(taskId));
                        if (taskIndex !== -1) {
                            globalAllTasks[taskIndex].attachments = JSON.stringify(currentTaskFiles);

                            if (typeof applyTaskFilters === 'function') applyTaskFilters();
                            else if (typeof renderTasks === 'function') renderTasks(globalAllTasks);
                        }
                    }

                    Swal.fire('Đã xóa!', 'File đã được xóa thành công.', 'success');
                } else {
                    Swal.fire('Lỗi!', response.message, 'error');
                }

            } catch (err) {
                console.error("Lỗi xóa file:", err);
                Swal.fire('Lỗi Server!', err.message || err, 'error');
            }
        }
    });
}












/**
 * 7: CHAT WIDGET TRONG DASHBOARD
 */
//  7.1. Khai báo biến DOM 
var rightSidebar, toggleRightSidebarBtn, closeRightSidebarBtn, memberListContainer;
var chatWidget, chatBox, toggleChatBtn, closeChatBtn;
var msgInput, sendBtn, msgList, pinViewDashboard;
var unreadBadge, replyPreviewBar, replyToName, replyToText;

//  7.2. Khai báo biến Trạng thái 
var unsubscribeChat = null;
var unsubscribeMembers = null;
var unsubscribePinned = null;
var chatUser = null;
var onlineInterval = null;

var unreadCount = 0;
var isFirstLoad = true;
var currentReplyData = null; // Biến lưu tin nhắn đang trả lời

//  7.3. Các hàm Tiện ích 

function escapeHtml(text) {
    if (!text) return "";
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatSmartTime(timestamp) {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    const now = new Date();

    // Lấy giờ phút
    const timeStr = date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

    const isToday = date.getDate() === now.getDate() &&
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear();

    if (isToday) {
        return timeStr;
    } else {
        // Nếu khác ngày thì ghi đầy đủ ngày tháng
        const dayStr = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
        return `${dayStr}, ${timeStr}`;
    }
}

function timeSince(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    var interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " năm trước";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " tháng trước";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " ngày trước";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " giờ trước";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " phút trước";
    return "vài giây trước";
}

//  7.4. Các hàm sự kiện từ HTML 

window.toggleReaction = function (docId, emoji) {
    if (!chatUser) return;

    const msgRef = db.collection('messages').doc(docId);

    // Dùng transaction để đảm bảo dữ liệu không bị lỗi khi nhiều người thả cùng lúc
    db.runTransaction((transaction) => {
        return transaction.get(msgRef).then((doc) => {
            if (!doc.exists) return;

            let reactions = doc.data().reactions || {};

            if (reactions[chatUser.uid] === emoji) {
                delete reactions[chatUser.uid];
            } else {
                reactions[chatUser.uid] = emoji;
            }

            transaction.update(msgRef, { reactions: reactions });
        });
    }).catch(console.error);

    // Ẩn popup sau khi chọn
    const popupId = 'emoji-popup-' + docId;
    const popup = document.getElementById(popupId);
    if (popup) popup.style.display = 'none';
};

window.showEmojiPicker = function (docId) {
    document.querySelectorAll('.emoji-picker-popup').forEach(el => el.style.display = 'none');

    const popup = document.getElementById('emoji-popup-' + docId);
    if (popup) {
        popup.style.display = (popup.style.display === 'block') ? 'none' : 'block';
    }
};

window.startReply = function (docId, name, text) {
    currentReplyData = { id: docId, name: name, text: text };

    // Hiển thị thanh Preview
    replyPreviewBar.style.display = 'flex';
    replyToName.textContent = "Trả lời " + name;
    replyToText.textContent = text;

    msgInput.focus();
};

window.cancelReply = function () {
    currentReplyData = null;
    replyPreviewBar.style.display = 'none';
};

window.togglePinMessage = function (docId, currentStatus) {
    db.collection('messages').doc(docId).update({ isPinned: !currentStatus }).catch(console.error);
};

//  7.5. các hàm chính xử lý Chat
function updateUnreadBadge() {
    if (unreadCount > 0) {
        unreadBadge.style.display = 'block';
        unreadBadge.innerText = unreadCount > 99 ? '99+' : unreadCount;
        unreadBadge.classList.remove('shake-animation');
        void unreadBadge.offsetWidth;
        unreadBadge.classList.add('shake-animation');
    } else {
        unreadBadge.style.display = 'none';
    }
}

function renderMessage(docId, data) {
    if (!data.text) return;
    var isMe = (chatUser && data.uid === chatUser.uid);
    var isPinned = data.isPinned === true;

    var timeString = formatSmartTime(data.createdAt);

    var formattedText = escapeHtml(data.text);

    formattedText = formattedText.replace(/@All/g, '<span class="mention-tag is-all">@All</span>');

    if (chatUser && chatUser.displayName) {
        var myNameRegex = new RegExp("@" + chatUser.displayName, "gi");
        formattedText = formattedText.replace(myNameRegex, '<span class="mention-tag is-me">@' + chatUser.displayName + '</span>');
    }

    formattedText = formattedText.replace(/@([a-zA-Z0-9_À-ỹ]+)/g, function (match) {
        if (match.includes('<span')) return match;
        return '<span class="mention-tag">' + match + '</span>';
    });

    var reactionsHtml = '';
    if (data.reactions) {
        var counts = {};
        for (var uid in data.reactions) {
            var icon = data.reactions[uid];
            counts[icon] = (counts[icon] || 0) + 1;
        }

        var badges = '';
        for (var icon in counts) {
            badges += '<span class="reaction-bubble">' + icon + ' ' + counts[icon] + '</span>';
        }

        if (badges) {
            var alignClass = isMe ? 'justify-content-end' : 'justify-content-start';
            reactionsHtml = '<div class="reaction-bar ' + alignClass + '">' + badges + '</div>';
        }
    }

    var existingDiv = document.getElementById('msg-' + docId);
    var div = existingDiv || document.createElement('div');
    div.id = 'msg-' + docId;
    div.className = 'msg-container ' + (isMe ? 'text-end' : 'text-start');
    div.style.marginBottom = "12px";
    div.style.textAlign = isMe ? "right" : "left";

    var bubbleStyle = 'text-align:left;'; // Màu nền/chữ do class .msg-me/.msg-other trong style.css đảm nhiệm (theme-aware)
    var pinIcon = isPinned ? '<i class="fa-solid fa-thumbtack text-warning me-1"></i>' : '';
    var nameLabel = !isMe ? '<div class="small text-muted mb-1 fw-bold">' + escapeHtml(data.displayName) + '</div>' : '';
    var timeHtml = '<span class="msg-time">' + timeString + '</span>';

    var replyQuoteHtml = '';
    if (data.replyTo) {
        replyQuoteHtml = '<div class="reply-quote"><strong>' + escapeHtml(data.replyTo.name) + '</strong><span>' + escapeHtml(data.replyTo.text) + '</span></div>';
    }

    var bubbleContent =
        '<div class="msg-bubble ' + (isMe ? 'msg-me' : 'msg-other') + ' ' + (isPinned ? 'pinned' : '') + '" style="' + bubbleStyle + '">' +
        replyQuoteHtml +
        pinIcon +
        nameLabel +
        '<span>' + formattedText + '</span>' +
        timeHtml +
        '</div>' +
        reactionsHtml; // Chèn thanh reaction xuống dưới


    // Tạo danh sách nút Emote trong Popup
    var emojiList = ['👍', '❤️', '😂', '😮', '😢', '😡'];
    var emojiButtons = '';
    for (var i = 0; i < emojiList.length; i++) {
        var em = emojiList[i];
        emojiButtons += '<span class="emoji-btn" onclick="toggleReaction(\'' + docId + '\', \'' + em + '\')">' + em + '</span>';
    }

    // Nút mặt cười (Chứa popup)
    var reactBtn =
        '<div class="action-btn-container">' +
        '<span onclick="window.showEmojiPicker(\'' + docId + '\')" style="cursor:pointer; color:var(--text-muted); margin:0 5px;" title="Thả cảm xúc">' +
        '<i class="fa-regular fa-face-smile"></i>' +
        '</span>' +
        '<div id="emoji-popup-' + docId + '" class="emoji-picker-popup" style="display:none;">' +
        emojiButtons +
        '</div>' +
        '</div>';

    // Nút Reply
    var replyBtn =
        '<span onclick="window.startReply(\'' + docId + '\', \'' + escapeHtml(data.displayName) + '\', \'' + escapeHtml(data.text).replace(/'/g, "\\'") + '\')" ' +
        'style="cursor:pointer; color:var(--text-muted); margin:0 5px; font-size:0.9rem;" title="Trả lời">' +
        '<i class="fa-solid fa-reply"></i>' +
        '</span>';

    // Nút Pin
    var pinBtn =
        '<span onclick="window.togglePinMessage(\'' + docId + '\', ' + isPinned + ')" ' +
        'style="cursor:pointer; color:var(--text-muted); margin:0 5px; font-size:0.9rem;" title="' + (isPinned ? 'Bỏ ghim' : 'Ghim') + '">' +
        '<i class="fa-solid fa-thumbtack"></i>' +
        '</span>';

    // Sắp xếp vị trí các nút
    if (isMe) {
        div.innerHTML = reactBtn + replyBtn + pinBtn + bubbleContent;
    } else {
        div.innerHTML = bubbleContent + pinBtn + replyBtn + reactBtn;
    }

    if (!existingDiv) msgList.appendChild(div);
}


function renderMemberSidebar(snapshot) {
    if (!memberListContainer) return;
    memberListContainer.innerHTML = '';
    var now = new Date();
    var ONLINE_THRESHOLD = 2 * 60 * 1000;

    if (snapshot.empty) {
        memberListContainer.innerHTML = '<p class="text-center text-muted">Chưa có thành viên nào.</p>';
        return;
    }

    snapshot.forEach(function (doc) {
        var data = doc.data();
        var lastSeen = data.last_changed ? data.last_changed.toDate() : new Date(0);
        var timeDiff = now - lastSeen;
        var isOnline = timeDiff < ONLINE_THRESHOLD;
        var statusText = isOnline ? 'Đang hoạt động' : 'Hoạt động ' + timeSince(lastSeen);
        var statusClass = isOnline ? 'text-online' : '';
        var dotClass = isOnline ? 'status-online' : 'status-offline';

        var div = document.createElement('div');
        div.className = 'member-card';
        div.innerHTML =
            '<div class="member-avatar">' +
            '<img src="' + data.photoURL + '" onerror="this.src=\'https://www.w3schools.com/howto/img_avatar.png\'">' +
            '<div class="status-indicator ' + dotClass + '"></div>' +
            '</div>' +
            '<div class="member-info">' +
            '<span class="member-name">' + escapeHtml(data.displayName) + '</span>' +
            '<span class="member-status-text ' + statusClass + '">' + statusText + '</span>' +
            '</div>';
        memberListContainer.appendChild(div);
    });
}

function renderPinToDashboard(data, docId) {
    if (!pinViewDashboard) return;
    var div = document.createElement('div');
    div.className = "alert alert-warning p-2 mb-2 d-flex justify-content-between align-items-center shadow-sm border-0";
    div.style.fontSize = "0.9rem";
    var contentHtml = '<span><strong>' + escapeHtml(data.displayName) + ':</strong> ' + escapeHtml(data.text) + '</span>';
    var btnHtml = '<button onclick="window.togglePinMessage(\'' + docId + '\', true)" class="btn btn-sm text-danger p-0 ms-2" style="background:none; border:none;" title="Gỡ ghim"><i class="fa-solid fa-xmark"></i></button>';
    div.innerHTML = contentHtml + btnHtml;
    pinViewDashboard.appendChild(div);
}


function loadChatMessages() {
    if (!msgList) return;

    const q = db.collection('messages')
        .where('group', '==', activeGroup)
        .orderBy('createdAt', 'asc')
        .limitToLast(100);
    unsubscribeChat = q.onSnapshot((snapshot) => {
        let hasNewMessage = false;

        snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();

            if (change.type === "added") {
                renderMessage(change.doc.id, data);

                if (!isFirstLoad && chatBox.classList.contains('hidden')) {
                    if (chatUser && data.uid !== chatUser.uid) {
                        unreadCount++;
                        updateUnreadBadge();
                        hasNewMessage = true;
                    }
                }
            }

            if (change.type === "modified") {
                renderMessage(change.doc.id, data);
            }
        });

        if (isFirstLoad || (!chatBox.classList.contains('hidden') && hasNewMessage)) {
            msgList.scrollTop = msgList.scrollHeight;
        }

        isFirstLoad = false;
    });
}


function loadPinnedMessages() {
    if (!pinViewDashboard) return;

    const q = db.collection('messages')
        .where('isPinned', '==', true)
        .where('group', '==', activeGroup)
        .orderBy('createdAt', 'asc');
    unsubscribePinned = q.onSnapshot((snapshot) => {
        pinViewDashboard.innerHTML = '';

        if (snapshot.empty) {
            pinViewDashboard.innerHTML = '<p class="text-muted small">Không có tin quan trọng.</p>';
            return;
        }

        snapshot.forEach((doc) => {
            const data = doc.data();
            renderPinToDashboard(data, doc.id);
        });
    });
}

function setupPresenceSystem(user) {
    var userStatusRef = db.collection('status').doc(user.uid);
    var setOnline = function () {
        userStatusRef.set({
            state: 'online',
            last_changed: firebase.firestore.FieldValue.serverTimestamp(),
            displayName: user.displayName || user.email,
            email: user.email,
            photoURL: user.photoURL || ('https://ui-avatars.com/api/?name=' + (user.displayName || "User") + '&background=random'),
            currentGroup: activeGroup
        }, { merge: true });
    };
    setOnline();
    onlineInterval = setInterval(setOnline, 60000);

    unsubscribeMembers = db.collection('status')
        .where('currentGroup', '==', activeGroup)
        .orderBy('last_changed', 'desc')
        .onSnapshot(function (snapshot) {
            renderMemberSidebar(snapshot);
        });
}

async function sendChatMessage() {
    var text = msgInput.value.trim();
    if (!text || !chatUser) return;

    var messageData = {
        text: text,
        uid: chatUser.uid,
        displayName: chatUser.displayName || chatUser.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        isPinned: false,
        group: activeGroup
    };

    if (currentReplyData) {
        messageData.replyTo = {
            id: currentReplyData.id,
            name: currentReplyData.name,
            text: currentReplyData.text
        };
    }

    db.collection('messages').add(messageData);

    msgInput.value = '';
    cancelReply();
}


/**
 * Thông báo
*/
let lastReadTime = parseInt(localStorage.getItem('user_last_read_noti')) || 0;
let currentNotiFilter = 'all';
let allNotifications = [];

// Khởi tạo tab listener
document.addEventListener('DOMContentLoaded', () => {
    const notiTabs = document.querySelectorAll('.noti-tab-btn');
    notiTabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            const btn = e.target.closest('.noti-tab-btn');
            if (!btn) return;
            
            notiTabs.forEach(t => t.classList.remove('active'));
            btn.classList.add('active');

            currentNotiFilter = btn.getAttribute('data-filter') || 'all';
            renderNotifications();
        });
    });
});

async function loadNotifications() {
    const badge = document.getElementById('noti-badge');
    const notiContent = document.getElementById('noti-content-offcanvas');

    try {
        const response = await callGAS('getNotifications', { groupKey: activeGroup, limit: 100 });

        if (response.status === 'success' || Array.isArray(response)) {
            allNotifications = Array.isArray(response) ? response : response.data;
            
            // Tính số lượng chưa đọc (Toàn bộ)
            let unreadCount = 0;
            allNotifications.forEach(item => {
                if (item.timestamp > lastReadTime) unreadCount++;
            });

            if (unreadCount > 0) {
                badge.style.display = 'block';
            } else {
                badge.style.display = 'none';
            }

            renderNotifications();
        }
    } catch (e) {
        console.error("Lỗi tải thông báo:", e);
        if (notiContent) notiContent.innerHTML = `<div class="p-4 text-danger text-center"><i class="fa-solid fa-triangle-exclamation"></i> Lỗi hệ thống: ${e.message}</div>`;
    }
}

function closeNotiOffcanvas() {
    const el = document.getElementById('notiOffcanvas');
    if (!el || typeof bootstrap === 'undefined') return;
    const instance = bootstrap.Offcanvas.getInstance(el);
    if (instance) instance.hide();
}

function renderNotifications() {
    const notiContent = document.getElementById('noti-content-offcanvas');
    if (!notiContent) return;

    // Lọc bỏ tất cả các hành động get tự động để không hiển thị cho người dùng
    let filtered = allNotifications.filter(n => !(n.action || '').startsWith('get') && !(n.details || '').includes('Truy xuất'));
    
    if (currentNotiFilter === 'auth') {
        filtered = filtered.filter(n => (n.action || '').toLowerCase().includes('auth') || (n.action || '').toLowerCase() === 'login' || (n.action || '').toLowerCase() === 'logout');
    } else if (currentNotiFilter === 'data') {
        filtered = filtered.filter(n => !((n.action || '').toLowerCase().includes('auth') || (n.action || '').toLowerCase() === 'login'));
    }

    if (filtered.length === 0) {
        notiContent.innerHTML = `
        <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted" style="min-height: 200px;">
            <i class="fa-solid fa-ghost fs-1 mb-3"></i>
            <p>Khu vực trống.</p>
        </div>`;
        return;
    }

    let html = '<div class="list-group list-group-flush border-top-0">';
    
    filtered.forEach(item => {
        const isUnread = item.timestamp > lastReadTime;
        const dateStr = new Date(item.timestamp).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
        
        let iconHtml = '<i class="fa-solid fa-circle-info text-primary"></i>';
        let bgClass = isUnread ? 'bg-light border-start border-primary border-4' : '';
        let act = (item.action || '').toLowerCase();
        
        if (act === 'mention') iconHtml = '<i class="fa-solid fa-at text-warning"></i>';
        else if (act.includes('delete')) iconHtml = '<i class="fa-solid fa-trash-can text-danger"></i>';
        else if (act.includes('create') || act.includes('upload') || act.includes('add')) iconHtml = '<i class="fa-solid fa-plus-circle text-success"></i>';
        else if (act.includes('login') || act.includes('auth')) iconHtml = '<i class="fa-solid fa-user-shield text-info"></i>';
        else if (act.startsWith('get') || (item.details || '').includes('Truy xuất')) iconHtml = '<i class="fa-solid fa-eye text-secondary"></i>';

        const isMention = act === 'mention' && item.taskId;
        const clickAttr = isMention
            ? `onclick="closeNotiOffcanvas(); openTaskActivity('${escapeHtml(escapeJs(item.taskId))}', '')"`
            : '';

        html += `
        <div class="list-group-item list-group-item-action p-3 ${bgClass}" style="cursor: ${isMention ? 'pointer' : 'default'};" ${clickAttr}>
            <div class="d-flex w-100 justify-content-between align-items-center mb-1">
                <h6 class="mb-0 fw-bold text-truncate" style="font-size: 0.95rem;">
                    ${iconHtml} <span class="ms-1">${escapeHtml(item.creator || 'Hệ thống')}</span>
                </h6>
                <small class="text-muted" style="font-size: 0.75rem;">${dateStr}</small>
            </div>
            <div class="mb-1 text-wrap text-dark" style="font-size: 0.85rem;">
                <span class="badge ${isMention ? 'bg-warning text-dark' : 'bg-secondary'} me-1">${isMention ? 'Nhắc đến bạn' : (item.action || 'Event')}</span>
                ${escapeHtml(item.details || item.message)}
            </div>
        </div>`;
    });
    
    html += '</div>';
    notiContent.innerHTML = html;
}

// Hàm đánh dấu tất cả là đã đọc khi người dùng bấm chuông
function markAllRead(e) {
    if (e) e.preventDefault();

    // Cập nhật thời gian hiện tại vào localStorage
    const now = new Date().getTime();
    localStorage.setItem('user_last_read_noti', now);
    lastReadTime = now;

    // Ẩn chấm đỏ
    document.getElementById('noti-badge').style.display = 'none';

    // Bỏ highlight xanh các item
    const items = document.querySelectorAll('.noti-item.unread');
    items.forEach(el => el.classList.remove('unread'));
}

function handleNotiClick(el) {
    // 1. Lấy đường dẫn từ thẻ a
    const link = el.getAttribute('href');

    // 2. Kiểm tra link rỗng hoặc link chết (#)
    if (!link || link === '#' || link === 'javascript:void(0);') {
        console.log("Thông báo này chỉ để xem, không có liên kết.");

        // Ngăn trình duyệt nhảy lung tung
        return false;
    }

    // 3. Hiệu ứng UI: Bỏ in đậm (unread) ngay lập tức cho người dùng thấy đã bấm
    el.classList.remove('unread');
    el.style.backgroundColor = 'transparent'; // Reset màu nền nếu cần

    // 4. Xử lý điều hướng
    // Nếu là link Google (Drive, Docs, Sheet, Calendar...) -> MỞ TAB MỚI
    if (link.includes('drive.google.com') ||
        link.includes('docs.google.com') ||
        link.includes('calendar.google.com') ||
        link.includes('script.google.com')) { // Link về file gốc hoặc script

        window.open(link, '_blank');
    }
    // Nếu là link nội bộ trang web (ví dụ chuyển sang trang /finance) -> MỞ TAB HIỆN TẠI
    else {
        window.top.location.href = link;
    }

    // Trả về false để ngăn thẻ <a> thực hiện hành động mặc định (tránh xung đột)
    return false;
}




// ==========================================
// HỆ THỐNG TRẠNG THÁI (IDLE / LOUNGE DETECTOR)
// ==========================================
let idleTimer;
const IDLE_TIMEOUT = 30000; // Thời gian chờ 30 giây (30000ms). Chỉnh số này nếu muốn đổi.

function resetIdleTimer() {
    clearTimeout(idleTimer);
    // Nếu bạn cựa quậy, trạng thái vẫn đang là Active
    localStorage.setItem('my_status', 'active');

    // Cài lại đồng hồ đếm ngược 30s
    idleTimer = setTimeout(() => {
        goToLounge('idle'); // Hết 30s -> Mở chế độ Ngủ
    }, IDLE_TIMEOUT);
}

// Hàm này dùng cho cả Nút bấm thủ công và Auto ngủ
function goToLounge(status) {
    localStorage.setItem('my_status', status); // Lưu trạng thái hiện tại (in-lounge hoặc idle)

    if (status === 'idle') {
        // Nếu là ngủ tự động, phải lưu lại cái trang đang làm việc để lát "thức dậy" còn quay về
        localStorage.setItem('return_url', window.location.href);
    } else {
        // Nếu chủ động bấm vào Lounge thì xóa đường về (coi như rời khỏi bàn làm việc)
        localStorage.removeItem('return_url');
    }

    // Chuyển hướng sang phòng chờ
    window.location.href = '/rest/';
}

// Lắng nghe mọi cử động của bạn trên web để reset đồng hồ (Chuột, Phím, Lăn chuột, Click)
['mousemove', 'keydown', 'scroll', 'click'].forEach(evt => {
    document.addEventListener(evt, resetIdleTimer, true);
});

// Khởi động đồng hồ ngay khi mở web
resetIdleTimer();



/**
 * 8: MAIN WEB LOGIC-DOMCONTENT LOADED
 */
document.addEventListener('DOMContentLoaded', function () {
    if (window.isAppLoaded) {
        console.warn("Cảnh báo: File Javascript đang bị nạp 2 lần. Đã ngăn chặn chạy lặp.");
        return;
    }
    window.isAppLoaded = true; // Đánh dấu là đã chạy

    //  8.1 KHAI BÁO BIẾN DOM 
    // Basic UI
    const navItems = document.querySelectorAll('.nav-item');
    const contentSections = document.querySelectorAll('.content-section');
    const sidebar = document.getElementById('app-sidebar');
    const hamburgerBtn = document.getElementById('hamburger-menu');
    const logoutBtn = document.getElementById('logout-btn');
    const userDisplay = document.getElementById('user-display');
    const userEmailDisplay = document.getElementById('user-email-display');
    const resetPasswordLink = document.getElementById('reset-password-link');

    // File / Drive
    const fileInput = document.getElementById('file-input');
    const fileNameDisplay = document.getElementById('file-name-display');
    const submitUploadBtn = document.getElementById('submit-upload-btn');
    const uploadForm = document.getElementById('upload-file-form');
    const fileIconPreview = document.getElementById('file-icon-preview');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const searchInput = document.getElementById('search-name');

    // Filter Elements
    const filterSortSelect = document.getElementById('filter-sort');
    const filterTypeSelect = document.getElementById('filter-type');
    const filterUploaderSelect = document.getElementById('filter-uploader');
    const filterDateInput = document.getElementById('filter-date');

    // Calendar
    const calendarToggle = document.getElementById('calendar-toggle');
    const calendarNavItems = document.querySelectorAll('.calendar-nav');
    addEventBtn = document.getElementById('add-event-btn');
    eventForm = document.getElementById('event-form');

    // Ghi nhớ tiêu đề/label mặc định của modal (mỗi shell có icon/chữ riêng) để có thể
    // khôi phục lại đúng trạng thái "Tạo mới" sau khi dùng modal này để sửa sự kiện.
    const eventModalTitleEl = document.getElementById('event-modal-title');
    if (eventModalTitleEl) eventModalDefaultTitleHTML = eventModalTitleEl.innerHTML;
    const eventSubmitBtnEl = eventForm ? eventForm.querySelector('button[type="submit"]') : null;
    if (eventSubmitBtnEl) eventModalDefaultSubmitHTML = eventSubmitBtnEl.innerHTML;

    manageEventBtn = document.getElementById('manage-event-btn');
    deleteEventBtn = document.getElementById('delete-event-btn');
    todayEventList = document.getElementById('today-event-list');

    //  PROGRESS & TASK DOM 
    // Progress Section
    updateBtn = document.getElementById('update-progress-btn'); // Nút tạo dự án/update note
    projectSelect = document.getElementById('project-select'); // Dropdown chọn dự án 
    progressNameInput = document.getElementById('progress-project-name'); // Ô nhập tên dự án mới
    progressNoteInput = document.getElementById('progress-note-input'); // Ô nhập ghi chú
    progressSearchInput = document.getElementById('progress-search-input');
    progressSortSelect = document.getElementById('progress-sort-select');
    progressProjectFilter = document.getElementById('progress-project-filter');
    const container = document.querySelector('.multiselect-container');
    // Task Section
    taskProjectSelect = document.getElementById('task-project-select'); // Dropdown chọn dự án 
    taskForm = document.getElementById('task-form'); // Form tạo task mới
    //Theme
    applyTheme();
    setInterval(applyTheme, 300000);
    //Background
    initGlobalBackgroundListener();
    //Thông báo
    loadNotifications();
    const bellBtn = document.getElementById('notiDropdownBtn');
    if (bellBtn) {
        bellBtn.addEventListener('show.bs.dropdown', () => {
            markAllRead();
        });
    }
    //  8.2 LOGIC FIREBASE AUTH 
    auth.onAuthStateChanged(function (user) {
        const userDisplay = document.getElementById('user-display');
        const userEmailDisplay = document.getElementById('user-email-display');
        const chatWidgetEl = document.getElementById('workhub-chat-widget');
        const chatBoxEl = document.getElementById('chat-box');
        const msgInput = document.getElementById('msg-input');
        const sendBtn = document.getElementById('send-btn');
        const navItems = document.querySelectorAll('.nav-item');

        if (user) {
            // case1: đã đăng nhập
            chatUser = user;
            const displayName = user.displayName || user.email;
            const shortName = displayName.split('@')[0];

            // 1. Cập nhật Tên
            if (userDisplay) userDisplay.innerHTML = `<i class="fa-solid fa-user-circle"></i> ${shortName}`;
            if (userEmailDisplay) userEmailDisplay.innerHTML = `<i class="fa-solid fa-at me-2"></i> ${displayName}`;

            // 2. Mở khóa Chat & Input
            if (chatWidgetEl) {
                chatWidgetEl.style.display = 'block';
                chatWidgetEl.style.opacity = '1';
                chatWidgetEl.style.pointerEvents = 'auto';
                chatWidgetEl.style.zIndex = '9999';
            }
            if (msgInput) {
                msgInput.disabled = false;
                msgInput.placeholder = "Nhập tin nhắn...";
            }
            if (sendBtn) sendBtn.disabled = false;

            // 3. Xử lý Active Tab & Reload Data
            if (navItems.length > 0) {
                const hasActive = document.querySelector('.nav-item.active');
                if (!hasActive) navItems[0].click();

                const activeItem = document.querySelector('.nav-item.active');
                if (activeItem && activeItem.getAttribute('data-section') === 'dashboard') {
                    if (typeof loadDashboardDataSecurely === 'function') {
                        loadDashboardDataSecurely();
                    }
                    else if (typeof renderRecentFiles === 'function') {
                        callGAS('getRecentFilesForDashboard', { groupKey: activeGroup })
                            .then(files => {
                                renderRecentFiles(files);
                            })
                            .catch(err => console.error("Lỗi tải dashboard fallback:", err));

                        if (typeof loadCalendarData === 'function') loadCalendarData();
                        if (typeof loadDashboardTopProgress === 'function') loadDashboardTopProgress();
                    }
                }
            }

            // 4. Khởi động hệ thống ngầm
            if (typeof setupPresenceSystem === 'function') setupPresenceSystem(user);
            if (typeof loadChatMessages === 'function') loadChatMessages();
            if (typeof loadPinnedMessages === 'function') loadPinnedMessages();

            // 5. Tải dữ liệu Project Overview ngay khi Login
            if (typeof loadProjectOverview === 'function') loadProjectOverview();

            // 6. Bật đồng bộ thời gian thực
            if (typeof initRealtimeSync === 'function') initRealtimeSync();

        } else {
            // case2: chưa đăng nhập
            chatUser = null;
            if (typeof stopRealtimeSync === 'function') stopRealtimeSync();

            if (userDisplay) userDisplay.innerHTML = `<i class="fa-solid fa-user-circle"></i> Khách`;
            if (userEmailDisplay) userEmailDisplay.innerHTML = `<i class="fa-solid fa-at me-2"></i> Chưa đăng nhập`;

            if (chatWidgetEl) {
                chatWidgetEl.style.display = 'block';
                chatWidgetEl.style.opacity = '0.5';
                chatWidgetEl.style.pointerEvents = 'none';
                if (chatBoxEl) chatBoxEl.classList.add('hidden');
            }
            if (msgInput) msgInput.disabled = true;
            if (sendBtn) sendBtn.disabled = true;

            if (typeof clearDashboardData === 'function') clearDashboardData();

            if (typeof unsubscribeChat === 'function') unsubscribeChat();
            if (typeof unsubscribeMembers === 'function') unsubscribeMembers();
            if (window.onlineInterval) clearInterval(window.onlineInterval);
        }
    });
    //  LOGIC LOGOUT & RESET PASS 
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {

            logoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            logoutBtn.disabled = true;

            const performRedirect = () => {
                window.top.location.href = "/";
            };

            const mainContainer = document.getElementById('main-container');
            if (mainContainer) mainContainer.style.display = 'none';

            if (typeof clearDashboardData === 'function') clearDashboardData();

            if (typeof showToast === 'function') showToast("Đang đăng xuất...", "info");

            if (auth) {
                if (window.API && API.system) {
                    API.system.logAction(Date.now().toString(), 'logout', `Người dùng đã đăng xuất hệ thống`, 'success', localStorage.getItem('userEmail'), localStorage.getItem('userGroup'));
                }
                auth.signOut()
                    .then(() => {
                        performRedirect();
                    })
                    .catch((error) => {
                        console.error("Lỗi đăng xuất:", error);
                        performRedirect();
                    });
            } else {
                performRedirect();
            }
        });
    }

    if (resetPasswordLink) {
        resetPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            goToResetPassword();
        });
    }

    //  8.3 SIDEBAR & NAVIGATION
    // Mặc định mở rộng trên màn hình lớn; trên mobile giữ dạng thu gọn (chỉ icon) để nhường chỗ cho nội dung
    if (sidebar && window.innerWidth > 768) sidebar.classList.add('expanded');
    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener('click', function () {
            sidebar.classList.toggle('expanded');
        });
    }

    //if (document.getElementById('today-calendar-view')) loadCalendarData();
    //if (document.getElementById('project-progress-view') && typeof loadDashboardTopProgress === 'function') loadDashboardTopProgress();

    //  8.4 SỰ KIỆN CHO TASK & PROGRESS

    // Chọn 1 dự án có sẵn từ dropdown -> tự điền trạng thái/mô tả hiện tại để sửa
    // (không chọn gì / chọn lại "-- Nhập mới --" -> quay về chế độ tạo mới, để trống form)
    if (projectSelect) {
        projectSelect.addEventListener('change', function () {
            const nameInput = document.getElementById('progress-project-name');
            const noteInput = document.getElementById('progress-note-input');
            const statusInput = document.getElementById('progress-status-select');
            const selectedId = projectSelect.value;

            if (!selectedId) {
                if (nameInput) nameInput.value = '';
                if (noteInput) noteInput.value = '';
                if (statusInput) statusInput.value = 'Planning';
                return;
            }

            const project = (globalAllProjects || []).find(p => p.id === selectedId);
            if (nameInput) nameInput.value = '';
            if (noteInput) noteInput.value = (project && project.description) || '';
            if (statusInput) statusInput.value = (project && project.status) || 'Planning';
        });
    }

    // tạo dự án / update note
    if (updateBtn) {
        updateBtn.addEventListener('click', function (e) {
            e.preventDefault();
            if (typeof handleProjectCreationOrUpdate === 'function') {
                handleProjectCreationOrUpdate();
                loadNotifications();
            } else {
                console.error("Hàm handleProjectCreationOrUpdate chưa được định nghĩa!");
            }
        });
    }

    // B. Chọn dự án và tải task tương ứng
    if (taskProjectSelect) {
        taskProjectSelect.addEventListener('change', function () {
            const projectId = this.value;
            if (typeof loadTasksForProject === 'function') {
                loadTasksForProject(projectId);
                loadNotifications();
            }
        });
    }

    // C. submit form tạo task mới
    if (taskForm) {
        taskForm.addEventListener('submit', function (e) {
            e.preventDefault();
            if (typeof handleTaskFormSubmit === 'function') {
                handleTaskFormSubmit(e);
                loadNotifications();
            }
        });
    }

    // D. Filter/Search trong Progress Tab — chỉ vẽ lại từ cache (globalAllProjects),
    // không gọi lại API mỗi lần đổi dropdown.
    if (typeof renderProgressTable === 'function') {

        // 1. Dropbox người tạo
        if (progressSearchInput) {
            progressSearchInput.addEventListener('change', () => renderProgressTable());
        }

        // 2. Dropdown Lọc Dự án
        if (progressProjectFilter) {
            progressProjectFilter.addEventListener('change', () => renderProgressTable());
        }

        // 3. Dropdown Sắp xếp
        if (progressSortSelect) {
            progressSortSelect.addEventListener('change', () => renderProgressTable());
        }

    }

    if (expanded && container && !container.contains(e.target)) {
        document.getElementById("checkboxes").style.display = "none";
        expanded = false;
    }

    if (typeof loadAssigneeDropdown === 'function') {
        loadAssigneeDropdown();
    }

    //  8.5 LOGIC CHUYỂN TAB (NAVIGATION) 
    navItems.forEach(item => {
        item.addEventListener('click', function (e) {
            const sectionName = item.getAttribute('data-section');

            if (!chatUser && sectionName !== 'dashboard') {
                e.preventDefault();
                showToast("Đăng nhập mới xài được nha mấy ní ơi!", "error");
                return;
            }

            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            contentSections.forEach(s => s.style.display = 'none');
            const target = document.getElementById(sectionName + '-section');
            if (target) target.style.display = 'block';

            if (chatUser) {
                // A. Tab Drive
                if (sectionName === 'drive') {
                    if (typeof resetAndLoadDrive === 'function') {
                        resetAndLoadDrive();
                    } else {
                        // Fallback nếu chưa kịp khai báo hàm trên
                        if (typeof loadFileList === 'function') loadFileList(false);
                    }
                }

                // B. Tab Dashboard
                if (sectionName === 'dashboard') {
                    callGAS('getRecentFilesForDashboard', { groupKey: activeGroup })
                        .then(response => { // [SỬA 1] Đổi tên biến thành 'response' cho đỡ nhầm

                            // [SỬA 2] Kiểm tra status và lấy mảng file từ .data
                            if (response.status === 'success' && Array.isArray(response.data)) {
                                const files = response.data; // Đây mới là mảng file thực sự

                                if (typeof renderFileStats === 'function') renderFileStats(files);

                                // [SỬA 3] Bây giờ files là mảng nên hàm slice sẽ chạy ngon lành
                                if (typeof renderRecentFiles === 'function') renderRecentFiles(files.slice(0, 9));
                            } else {
                                console.warn("Lỗi tải Dashboard:", response.message);
                            }
                        })
                        .catch(err => console.error("Lỗi kết nối Dashboard:", err));

                    if (typeof loadCalendarData === 'function') loadCalendarData();
                    if (typeof loadDashboardTopProgress === 'function') loadDashboardTopProgress();
                }

                // C. Tab Calendar
                if (sectionName === 'calendar') {
                    if (typeof loadCalendarData === 'function') loadCalendarData();
                }

                // D.Tab Progress & Task
                if (sectionName === 'progress' || sectionName === 'task') {
                    if (typeof loadProjectOverview === 'function') loadProjectOverview();
                }

                // D2. Tab Việc của tôi
                if (sectionName === 'mytasks') {
                    if (typeof loadMyTasks === 'function') loadMyTasks();
                }

                // D3. Tab Quản lý người dùng (admin)
                if (sectionName === 'admin-users') {
                    if (typeof loadAdminUsers === 'function') loadAdminUsers();
                }
            }
        });
    });


    //  8.6 LOGIC UPLOAD FILE 
    if (uploadForm) {
        // Xử lý chuyển đổi loại hình tải lên
        const uploadTypeRadios = uploadForm.querySelectorAll('input[name="uploadType"]');
        const folderInput = document.getElementById('folder-input');
        const uploadLabel = document.getElementById('upload-label');
        
        uploadTypeRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'folder') {
                    uploadLabel.setAttribute('for', 'folder-input');
                    uploadLabel.innerHTML = '<i class=\"fa-solid fa-folder-tree\"></i> Chọn thư mục từ máy tính<span id=\"file-name-display\"> (Chưa chọn thư mục)</span>';
                } else {
                    uploadLabel.setAttribute('for', 'file-input');
                    uploadLabel.innerHTML = '<i class=\"fa-solid fa-cloud-arrow-up\"></i> Chọn file từ máy tính<span id=\"file-name-display\"> (Chưa có file nào)</span>';
                }
                document.getElementById('file-icon-preview').innerHTML = '';
            });
        });

        const handleFileInputChange = function () {
            if (this.files.length > 0) {
                const fileNameDisplay = document.getElementById('file-name-display');
                const fileIconPreview = document.getElementById('file-icon-preview');
                
                if (this.files.length === 1) {
                    const file = this.files[0];
                    const fileName = file.name.toLowerCase();
                    fileNameDisplay.textContent = ' (' + file.name + ')';
                    
                    let iconClass = 'fa-file';
                    if (fileName.endsWith('.pdf')) iconClass = 'fa-file-pdf text-danger';
                    else if (fileName.endsWith('.docx')) iconClass = 'fa-file-word text-primary';
                    else if (file.type && file.type.startsWith('image/')) iconClass = 'fa-file-image text-warning';
                    else if (fileName.endsWith('.xlsx')) iconClass = 'fa-file-excel text-success';
                    
                    fileIconPreview.innerHTML = `<i class=\"fa-solid ${iconClass}\" style=\"font-size: 36px; color: var(--text-secondary);\"></i>`;
                } else {
                    fileNameDisplay.textContent = ' (Đã chọn ' + this.files.length + ' files)';
                    fileIconPreview.innerHTML = `<i class=\"fa-solid fa-copy text-primary\" style=\"font-size: 36px;\"></i>`;
                }
                submitUploadBtn.disabled = false;
            }
        };

        if (fileInput) fileInput.addEventListener('change', handleFileInputChange);
        const folderInputObj = document.getElementById('folder-input');
        if (folderInputObj) folderInputObj.addEventListener('change', handleFileInputChange);

        uploadForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const uploadType = document.querySelector('input[name=\"uploadType\"]:checked').value;
            const inputElement = uploadType === 'folder' ? folderInput : fileInput;

            if (!inputElement || !inputElement.files.length) {
                showToast('Vui lòng chọn file/thư mục để tải lên!', 'error');
                return;
            }

            submitUploadBtn.disabled = true;
            const originalBtnText = submitUploadBtn.innerHTML;

            const descInput = uploadForm.querySelector('[name=\"description\"]');
            const descriptionValue = descInput ? descInput.value : "";
            const totalFiles = inputElement.files.length;
            let successCount = 0;

            const readFileAsBase64 = (f) => new Promise((resolve) => {
                const r = new FileReader();
                r.onload = (e) => resolve(e.target.result.split(',')[1]);
                r.readAsDataURL(f);
            });

            try {
                for (let i = 0; i < totalFiles; i++) {
                    const file = inputElement.files[i];
                    submitUploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang tải ${i+1}/${totalFiles}...`;
                    
                    const base64Data = await readFileAsBase64(file);
                    
                    let folderPath = "";
                    if (uploadType === 'folder' && file.webkitRelativePath) {
                        const parts = file.webkitRelativePath.split('/');
                        parts.pop(); // Bỏ tên file
                        folderPath = parts.join('/');
                    }

                    const res = await callGAS('uploadFile', {
                        fileData: base64Data,
                        fileName: file.name,
                        mimeType: file.type || 'application/octet-stream',
                        groupKey: activeGroup,
                        description: descriptionValue,
                        email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : "unknown",
                        folderPath: folderPath
                    });

                    if (res.status === 'error') throw new Error(res.message);
                    successCount++;
                }

                showToast(`Tải lên thành công ${successCount} file!`, "success");
                loadNotifications();
                uploadForm.reset();
                if (typeof loadFileList === 'function') loadFileList(false);
                
                // Kích hoạt sự kiện change để UI label đồng bộ lại với trạng thái mặc định của radio button
                const checkedRadio = document.querySelector('input[name="uploadType"]:checked');
                if (checkedRadio) {
                    checkedRadio.dispatchEvent(new Event('change'));
                } else {
                    const displaySpan = document.getElementById('file-name-display');
                    if (displaySpan) displaySpan.textContent = ' (Chưa có file nào)';
                }
                
                document.getElementById('file-icon-preview').innerHTML = '';

            } catch (err) {
                if (typeof handleUploadFailure === 'function') handleUploadFailure(err);
                showToast("Lỗi tải file: " + err.message, "error");
            } finally {
                submitUploadBtn.disabled = false;
                submitUploadBtn.innerHTML = originalBtnText;
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', function () {
            if (this.files.length > 0) {
                const file = this.files[0];
                const fileName = file.name.toLowerCase();
                fileNameDisplay.textContent = ' (' + file.name + ')';
                submitUploadBtn.disabled = false;

                let iconClass = 'fa-file';
                if (fileName.endsWith('.pdf')) iconClass = 'fa-file-pdf';
                else if (fileName.endsWith('.docx')) iconClass = 'fa-file-word';
                else if (file.type.startsWith('image/')) iconClass = 'fa-file-image';
                else if (fileName.endsWith('.xlsx')) iconClass = 'fa-file-excel';

                fileIconPreview.innerHTML = `<i class="fa-solid ${iconClass}" style="font-size: 36px; color: var(--text-secondary);"></i>`;
            } else {
                fileNameDisplay.textContent = ' (Chưa có file nào)';
                submitUploadBtn.disabled = true;
                fileIconPreview.innerHTML = '';
            }
        });
    }

    //  8.7 LOGIC LỌC FILE 

    let searchTimeout = null;

    if (searchInput) {
        searchInput.addEventListener('input', () => {
            if (searchTimeout) clearTimeout(searchTimeout);

            searchTimeout = setTimeout(() => {
                if (typeof loadFileList === 'function') loadFileList(true);
            }, 500); // 500ms delay
        });
    }

    const directFilters = [filterSortSelect, filterTypeSelect, filterUploaderSelect, filterDateInput];
    directFilters.forEach(el => {
        if (el) {
            el.addEventListener('change', () => {
                if (typeof loadFileList === 'function') loadFileList(true);
            });
        }
    });

    if (applyFilterBtn) {
        applyFilterBtn.addEventListener('click', () => {
            if (typeof loadFileList === 'function') loadFileList(true);
        });
    }

    //  8.8 LOGIC SỰ KIỆN CALENDAR (Events) 
    if (calendarNavItems.length > 0) {
        calendarNavItems.forEach(item => {
            item.addEventListener('click', function () {
                const newType = item.getAttribute('data-calendar-type');
                if (newType && newType !== currentCalendarType) {
                    currentCalendarType = newType;
                    calendarNavItems.forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                    loadCalendarData();
                }
            });
        });
    }

    if (document.getElementById('full-calendar-display')) loadCalendarData();
    if (document.getElementById('event-attendee-checkboxes')) loadEventAttendeeCheckboxes();
    selectedEventId = null;

    //  8.9 FORM BÌNH LUẬN TASK
    const taskCommentForm = document.getElementById('task-comment-form');
    if (taskCommentForm) {
        taskCommentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('task-comment-input');
            const content = input ? input.value.trim() : '';
            if (!content || !currentActivityTaskId) return;

            const mentionCbs = document.querySelectorAll('input[name="comment-mentions"]:checked');
            const mentionedEmails = Array.from(mentionCbs).map(cb => cb.value).join(',');

            try {
                const response = await callGAS('addTaskComment', {
                    taskId: currentActivityTaskId,
                    content: content,
                    mentionedEmails: mentionedEmails,
                    groupKey: activeGroup,
                    email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
                });
                if (response.status !== 'success') throw new Error(response.message);
                if (input) input.value = '';
                document.querySelectorAll('input[name="comment-mentions"]:checked').forEach(cb => cb.checked = false);
                loadTaskComments(currentActivityTaskId);
                loadTaskHistory(currentActivityTaskId);
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }

    //  8.9a TÌM KIẾM TOÀN CỤC: phím tắt + ô nhập
    const searchPaletteInput = document.getElementById('search-palette-input');
    if (searchPaletteInput) {
        searchPaletteInput.addEventListener('input', function () {
            onSearchPaletteInput(this.value);
        });
        searchPaletteInput.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveSearchSelection(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moveSearchSelection(-1); }
            else if (e.key === 'Enter') { e.preventDefault(); if (searchPaletteIndex >= 0) activateSearchResult(searchPaletteIndex); }
            else if (e.key === 'Escape') { e.preventDefault(); closeSearchPalette(); }
        });
    }

    const searchPaletteEl = document.getElementById('search-palette');
    if (searchPaletteEl) {
        // Bấm ra vùng nền tối thì đóng, bấm trong hộp thì không
        searchPaletteEl.addEventListener('mousedown', function (e) {
            if (e.target === searchPaletteEl) closeSearchPalette();
        });
    }

    document.addEventListener('keydown', function (e) {
        const key = (e.key || '').toLowerCase();
        if ((e.ctrlKey || e.metaKey) && key === 'k') {
            e.preventDefault();
            const palette = document.getElementById('search-palette');
            if (palette && palette.style.display !== 'none') closeSearchPalette();
            else openSearchPalette();
            return;
        }
        if (key === 'escape') {
            const palette = document.getElementById('search-palette');
            if (palette && palette.style.display !== 'none') closeSearchPalette();
        }
    });

    //  8.9b FORM CẤP QUYỀN TRƯỚC CHO NGƯỜI DÙNG (ADMIN)
    const provisionUserForm = document.getElementById('provision-user-form');
    if (provisionUserForm) {
        provisionUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('provision-email');
            const nicknameInput = document.getElementById('provision-nickname');
            const groupSelect = document.getElementById('provision-group');
            const email = emailInput ? emailInput.value.trim() : '';
            if (!email) return;

            try {
                const response = await callGAS('provisionUser', {
                    email,
                    nickname: nicknameInput ? nicknameInput.value.trim() : '',
                    groupKey: groupSelect ? groupSelect.value : 'guest'
                });
                if (response.status !== 'success') throw new Error(response.message);
                showToast(response.data || response.message, 'success');
                provisionUserForm.reset();
                if (typeof loadAdminUsersTable === 'function') loadAdminUsersTable();
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }

    //  8.9c FORM THÊM MỤC VÀO DANH SÁCH KIỂM
    const checklistForm = document.getElementById('task-checklist-form');
    if (checklistForm) {
        checklistForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const input = document.getElementById('task-checklist-input');
            const text = input ? input.value.trim() : '';
            if (!text || !currentActivityTaskId) return;

            try {
                const response = await callGAS('addChecklistItem', { taskId: currentActivityTaskId, text });
                if (response.status !== 'success') throw new Error(response.message);
                if (input) input.value = '';
                renderTaskChecklist(response.data || []);
                refreshTaskListAfterChecklistChange();
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }

    //  8.10 FORM THÊM CỘT MỐC DỰ ÁN
    const milestoneForm = document.getElementById('milestone-form');
    if (milestoneForm) {
        milestoneForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const titleInput = document.getElementById('milestone-title-input');
            const dateInput = document.getElementById('milestone-date-input');
            const title = titleInput ? titleInput.value.trim() : '';
            if (!title || !currentMilestoneProjectId) return;

            try {
                const response = await callGAS('addMilestone', {
                    projectId: currentMilestoneProjectId,
                    title: title,
                    targetDate: dateInput ? dateInput.value : '',
                    groupKey: activeGroup,
                    email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
                });
                if (response.status !== 'success') throw new Error(response.message);
                if (titleInput) titleInput.value = '';
                if (dateInput) dateInput.value = '';
                loadMilestones(currentMilestoneProjectId);
            } catch (err) {
                showToast('Lỗi: ' + err.message, 'error');
            }
        });
    }

    if (addEventBtn) addEventBtn.addEventListener('click', () => {
        if (eventForm) eventForm.reset();
        resetEventModalUI();
        showModal('add-event-modal');
    });

    if (calendarToggle) {
        calendarToggle.addEventListener('change', function () {
            currentCalendarType = calendarToggle.value;
            if (typeof loadCalendarData === 'function') loadCalendarData();
        });
    }

    // 1. FORM TẠO SỰ KIỆN
    if (eventForm) {
        eventForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const formBtn = eventForm.querySelector('button[type="submit"]');
            const formData = new FormData(eventForm);
            const eventData = {};

            // Chuyển FormData thành Object
            for (const [key, value] of formData.entries()) eventData[key] = value;

            // Gom danh sách thành viên được mời (checkbox nhiều name trùng, FormData không gom được)
            const attendeeCbs = document.querySelectorAll('input[name="event-attendees"]:checked');
            eventData.attendees = Array.from(attendeeCbs).map(cb => cb.value).join(',');

            if (!eventData.title || !eventData.startDate || !eventData.startTime || !eventData.endDate || !eventData.endTime) {
                showToast("Vui lòng điền đầy đủ thông tin!", "error");
                return;
            }

            const startObj = new Date(`${eventData.startDate}T${eventData.startTime}`);
            const endObj = new Date(`${eventData.endDate}T${eventData.endTime}`);

            if (endObj <= startObj) {
                showToast("Thời gian kết thúc phải sau thời gian bắt đầu!", "warning");
                return;
            }

            const editingId = document.getElementById('event-id').value;
            const isEditing = !!editingId;

            formBtn.disabled = true;
            const originalBtnText = formBtn.innerHTML;
            formBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ' + (isEditing ? 'Đang cập nhật...' : 'Đang tạo...');

            try {
                const msg = await callGAS(isEditing ? 'updateEvent' : 'createEvent', {
                    ...eventData,
                    eventId: editingId,
                    calendarType: currentCalendarType,
                    groupKey: activeGroup,
                    email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
                });

                showToast(msg, "success");
                loadNotifications();
                if (typeof hideModal === 'function') hideModal('add-event-modal');
                eventForm.reset();
                resetEventModalUI();

                if (typeof loadCalendarData === 'function') loadCalendarData();

            } catch (error) {
                showToast("Lỗi: " + error.message, "error");

            } finally {
                formBtn.disabled = false;
                formBtn.innerHTML = originalBtnText || (isEditing ? 'Cập Nhật' : 'Tạo Sự Kiện');
            }
        });
    }

    // 2. NÚT ĐÁNH DẤU QUAN TRỌNG
    if (manageEventBtn) {
        manageEventBtn.addEventListener('click', async function () {
            if (!selectedEventId) return showToast("Vui lòng chọn sự kiện trước!", "error");

            const selectedItem = todayEventList.querySelector(`[data-id="${selectedEventId}"]`);
            if (!selectedItem) return;

            const isCurrentlyImportant = selectedItem.getAttribute('data-important') === 'true';
            const newImportant = !isCurrentlyImportant;

            const originalBtnText = manageEventBtn.innerHTML;
            manageEventBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
            manageEventBtn.disabled = true;

            try {
                const msg = await callGAS('toggleImportant', {
                    eventId: selectedEventId,
                    isImportant: newImportant,
                    calendarType: currentCalendarType,
                    groupKey: activeGroup,
                    email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
                });

                showToast(msg, "success");
                loadNotifications();
                if (typeof loadCalendarData === 'function') loadCalendarData();

            } catch (err) {
                showToast("Lỗi: " + err.message, "error");

            } finally {
                manageEventBtn.innerHTML = originalBtnText || '<i class="fa-solid fa-pen-to-square"></i> Quản Lý Sự Kiện';
                manageEventBtn.disabled = false;
            }
        });
    }
    // 3. NÚT XÓA SỰ KIỆN
    if (deleteEventBtn) {
        deleteEventBtn.addEventListener('click', function () {
            if (!selectedEventId) {
                showToast("Vui lòng chọn một sự kiện để xóa!", "error");
                return;
            }

            // Lấy tiêu đề sự kiện
            const selectedItem = todayEventList.querySelector(`[data-id="${selectedEventId}"]`);
            const title = selectedItem ? selectedItem.querySelector('.event-title').innerText : "này";

            Swal.fire({
                title: 'Xóa Sự Kiện?',
                text: `Bạn có chắc chắn muốn xóa sự kiện: "${title}"?`,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Xóa liền đi người ae!',
                cancelButtonText: 'Nghĩ lại òi!'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    Swal.fire({
                        title: 'Đang xóa sự kiện...',
                        allowOutsideClick: false,
                        didOpen: () => Swal.showLoading()
                    });

                    try {
                        const response = await callGAS('deleteEvent', {
                            eventId: selectedEventId,
                            calendarType: currentCalendarType,
                            groupKey: activeGroup,
                            email: (typeof chatUser !== 'undefined' && chatUser) ? chatUser.email : null
                        });

                        if (response.status === 'success') {
                            Swal.fire({
                                icon: 'success',
                                title: 'Đã xóa!',
                                text: response.message, // Lấy message từ object response
                                timer: 1500,
                                showConfirmButton: false
                            });
                            loadNotifications();
                            if (typeof loadCalendarData === 'function') loadCalendarData();

                            selectedEventId = null;
                            deleteEventBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Xóa Sự Kiện';
                            deleteEventBtn.disabled = true;
                        } else {
                            throw new Error(response.message);
                        }

                    } catch (err) {
                        Swal.fire('Lỗi!', err.message || err, 'error');
                    }
                }
            });
        });
    }



    //8.10 LOGIC CHAT WIDGET
    rightSidebar = document.getElementById('right-sidebar');
    toggleRightSidebarBtn = document.getElementById('toggle-right-sidebar-btn');
    closeRightSidebarBtn = document.getElementById('close-right-sidebar');
    memberListContainer = document.getElementById('member-list-container');

    chatWidget = document.getElementById('workhub-chat-widget');
    chatBox = document.getElementById('chat-box');
    toggleChatBtn = document.getElementById('chat-toggle-btn');
    closeChatBtn = document.getElementById('close-chat');

    msgInput = document.getElementById('msg-input');
    sendBtn = document.getElementById('send-btn');
    msgList = document.getElementById('messages-list');
    pinViewDashboard = document.getElementById('chat-pin-view');

    unreadBadge = document.getElementById('unread-badge');
    replyPreviewBar = document.getElementById('reply-preview-bar');
    replyToName = document.getElementById('reply-to-name');
    replyToText = document.getElementById('reply-to-text');

    if (toggleChatBtn) {
        toggleChatBtn.addEventListener('click', function () {
            chatBox.classList.toggle('hidden');
            if (!chatBox.classList.contains('hidden')) {
                unreadCount = 0;
                updateUnreadBadge();
                setTimeout(function () { msgList.scrollTop = msgList.scrollHeight; }, 100);
            }
        });
    }

    if (closeChatBtn) closeChatBtn.addEventListener('click', () => chatBox.classList.add('hidden'));

    if (toggleRightSidebarBtn) {
        toggleRightSidebarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            rightSidebar.classList.toggle('open');
        });
    }
    if (closeRightSidebarBtn) closeRightSidebarBtn.addEventListener('click', () => rightSidebar.classList.remove('open'));

    document.addEventListener('click', function (e) {
        if (rightSidebar && rightSidebar.classList.contains('open') &&
            !rightSidebar.contains(e.target) &&
            e.target !== toggleRightSidebarBtn &&
            !toggleRightSidebarBtn.contains(e.target)) {
            rightSidebar.classList.remove('open');
        }
    });

    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);
    if (msgInput) {
        msgInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') sendChatMessage();
        });
    }





}); // Kết thúc DOMContentLoaded

// ==========================================
// THÙNG RÁC (RESTORE MANAGER)
// ==========================================
function showTrashModal() {
    const trashModalEl = document.getElementById('trashModal');
    if (!trashModalEl) return;
    const modal = new bootstrap.Modal(trashModalEl);
    modal.show();
    loadTrashItems();
}

// Số ngày giữ trong thùng rác trước khi khuyến nghị dọn.
// Chỉ CẢNH BÁO chứ không tự xóa: xóa vĩnh viễn tự động cần tác vụ chạy nền phía server
// (Cloudflare Worker), không thể làm đáng tin từ trình duyệt vì phải có người mở trang mới chạy.
const TRASH_RETENTION_DAYS = 30;

function getTrashAgeDays(deletedAt) {
    if (!deletedAt) return null;
    const t = new Date(deletedAt).getTime();
    if (isNaN(t)) return null;
    return Math.floor((Date.now() - t) / 86400000);
}

function getTrashAgeInfo(deletedAt) {
    const days = getTrashAgeDays(deletedAt);
    if (days === null) return '';
    if (days >= TRASH_RETENTION_DAYS) {
        return `<br><span class="trash-age is-old"><i class="fa-solid fa-triangle-exclamation"></i> Đã ${days} ngày — nên dọn</span>`;
    }
    if (days >= 1) return `<br><span class="trash-age">${days} ngày trước</span>`;
    return '';
}

async function loadTrashItems() {
    const tbody = document.getElementById('trash-list-body');
    const category = document.getElementById('trash-category').value;
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted"><i class="fa-solid fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    
    try {
        const response = await callGAS('getDeletedItems', { tableName: category, groupKey: activeGroup });
        if (response.status === 'success' && response.data && response.data.length > 0) {
            let html = '';
            response.data.forEach(item => {
                let name = item.name || item.title || 'Không có tên';
                let displayName = escapeHtml(name);
                if (category === 'tasks' && item.projectName) {
                    displayName += ` <br><small class="text-muted"><i class="fa-solid fa-folder-open"></i> Dự án: ${escapeHtml(item.projectName)}</small>`;
                }
                let dateStr = item.deleted_at ? new Date(item.deleted_at).toLocaleString('vi-VN') : 'N/A';
                const ageInfo = getTrashAgeInfo(item.deleted_at);

                html += `
                <tr>
                  <td>${displayName}</td>
                  <td>${dateStr}${ageInfo}</td>
                  <td class="text-center">
                    <button class="btn btn-sm btn-success shadow-sm mb-1" onclick="restoreItemClick('${category}', '${item.id}')">
                      <i class="fa-solid fa-clock-rotate-left"></i> Khôi phục
                    </button>
                    <button class="btn btn-sm btn-danger shadow-sm mb-1" onclick="hardDeleteItemClick('${category}', '${item.id}')">
                      <i class="fa-solid fa-trash"></i> Xóa hẳn
                    </button>
                  </td>
                </tr>`;
            });
            tbody.innerHTML = html;

            const oldItems = response.data.filter(x => (getTrashAgeDays(x.deleted_at) || 0) >= TRASH_RETENTION_DAYS);
            if (oldItems.length > 0) {
                const ids = oldItems.map(x => x.id).join('|');
                tbody.insertAdjacentHTML('beforeend', `
                <tr>
                  <td colspan="3" class="text-center py-3" style="background: color-mix(in srgb, var(--danger-color) 7%, transparent);">
                    <span class="me-2">${oldItems.length} mục đã ở thùng rác quá ${TRASH_RETENTION_DAYS} ngày.</span>
                    <button class="btn btn-sm btn-outline-danger" onclick="purgeOldTrash('${category}', '${ids}')">
                      <i class="fa-solid fa-broom"></i> Dọn hết
                    </button>
                  </td>
                </tr>`);
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center py-5 text-muted">Thùng rác trống.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="3" class="text-center py-5 text-danger">Lỗi tải dữ liệu: ${e.message}</td></tr>`;
    }
}

// Dọn hàng loạt các mục đã quá hạn giữ. Xóa vĩnh viễn nên bắt gõ xác nhận, không chỉ bấm OK.
async function purgeOldTrash(category, idsJoined) {
    const ids = String(idsJoined || '').split('|').filter(Boolean);
    if (ids.length === 0) return;

    const result = await Swal.fire({
        title: `Xóa vĩnh viễn ${ids.length} mục?`,
        html: `Các mục này đã ở thùng rác quá ${TRASH_RETENTION_DAYS} ngày.<br><b>Không thể hoàn tác.</b><br>Gõ <code>XOA</code> để xác nhận:`,
        icon: 'warning',
        input: 'text',
        inputPlaceholder: 'XOA',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Xóa vĩnh viễn',
        cancelButtonText: 'Hủy',
        inputValidator: (value) => (value || '').trim().toUpperCase() !== 'XOA' ? 'Gõ đúng chữ XOA để xác nhận.' : null
    });
    if (!result.isConfirmed) return;

    let ok = 0, fail = 0;
    for (const id of ids) {
        try {
            const r = await callGAS('hardDeleteItem', { tableName: category, id, groupKey: activeGroup });
            if (r.status === 'success') ok++; else fail++;
        } catch (err) { fail++; }
    }

    showToast(fail === 0 ? `Đã dọn ${ok} mục.` : `Đã dọn ${ok} mục, ${fail} mục lỗi.`, fail === 0 ? 'success' : 'error');
    loadTrashItems();
}

async function restoreItemClick(category, id) {
    const result = await Swal.fire({
        title: 'Xác nhận khôi phục',
        html: `Khôi phục hả ku? Chắc chưa`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Khôi phục đi bruh',
        cancelButtonText: 'Nghĩ lại ồi',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d'
    });
    
    if (!result.isConfirmed) return;        
    
    try {
        const response = await callGAS('restoreItem', { tableName: category, id: id, groupKey: activeGroup });
        if (response.status === 'success') {
            showToast('Khôi phục thành công!', 'success');
            loadTrashItems();
            
            // Reload lại giao diện nếu đang ở tab đó
            if (category === 'files') {
                if (typeof loadFileList === 'function') loadFileList();
            } else if (category === 'projects' || category === 'tasks') {
                if (typeof loadProgressList === 'function') loadProgressList();
            } else if (category === 'events') {
                if (typeof loadCalendarData === 'function') loadCalendarData();
            }
        } else {
            showToast('Khôi phục thất bại: ' + response.message, 'error');
        }
    } catch (e) {
        showToast('Lỗi: ' + e.message, 'error');
    }
}

async function hardDeleteItemClick(category, id) {
    const result = await Swal.fire({
        title: 'Xác nhận xóa vĩnh viễn',
        html: `Bro chắc chưa? Xóa rùi là mất đó nha`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Xóa vĩnh viễn',
        cancelButtonText: 'Nghĩ lại ồi',
        confirmButtonColor: '#d9534f',
        cancelButtonColor: '#6c757d'
    });
    
    if (!result.isConfirmed) return;
    
    try {
        const response = await callGAS('hardDeleteItem', { tableName: category, id: id, groupKey: activeGroup });
        if (response.status === 'success') {
            showToast('Đã xóa vĩnh viễn!', 'success');
            loadTrashItems();
        } else {
            showToast('Xóa thất bại: ' + response.message, 'error');
        }
    } catch (e) {
        showToast('Lỗi: ' + e.message, 'error');
    }
}

// --- LOGIC HÌNH NỀN LOGIN ---
window.handleLoginBgUpload = function(input) {
    if (input.files && input.files[0]) {
        var file = input.files[0];
        if (file.size > 700 * 1024) { Swal.fire('Ảnh nặng quá!', 'Ảnh lưu vào Firestore (giới hạn 1MB/document) nên cần dưới 700KB.', 'warning'); return; }
        
        var reader = new FileReader();
        reader.onload = function(e) {
            db.collection('settings').doc('login_theme').set({
                backgroundImage: e.target.result,
                updatedBy: auth.currentUser ? auth.currentUser.email : 'Unknown',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).then(() => {
                Swal.fire({ icon: 'success', title: 'Đã đổi nền!', text: 'Hình nền Login đã được cập nhật.', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
            }).catch(err => {
                Swal.fire('Lỗi', err.message, 'error');
            });
        }
        reader.readAsDataURL(file);
    }
};

window.confirmResetTheme = function() {
    Swal.fire({
        title: 'Reset giao diện?', text: "Xóa ảnh nền và quay về mặc định?", icon: 'question',
        showCancelButton: true, confirmButtonColor: '#d33', cancelButtonText: 'Khoan...', confirmButtonText: 'Ok, xóa đi ní!'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection('settings').doc('login_theme').update({
                backgroundImage: firebase.firestore.FieldValue.delete()
            }).then(() => {
                Swal.fire({ icon: 'success', title: 'Đã Reset!', toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
            });
        }
    });
};
