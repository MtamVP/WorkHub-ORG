// Helper chống XSS: escape dữ liệu trước khi chèn vào innerHTML
window.escapeHtml = function (value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
};
// Escape chuỗi khi nhúng vào tham số JS trong thuộc tính onclick (dùng kèm escapeHtml)
window.escapeJs = function (value) {
    return String(value === null || value === undefined ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
};

const GAS_API_URL ="https://script.google.com/macros/s/AKfycbzV19PGd4RyByv0r_l7GVwAM0OjLlTGvqc7J-yHZLVPpvo1CBMdGZeMDUngNeua3tAM/exec";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(action, params = {}, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const url = new URL(GAS_API_URL);
            url.searchParams.append("action", action);

            Object.keys(params).forEach(key => {
                if (params[key] !== null && params[key] !== undefined) {
                    const val = typeof params[key] === 'object' ? JSON.stringify(params[key]) : params[key];
                    url.searchParams.append(key, val);
                }
            });

            if (attempt === 1) console.log(`[GET] Calling: ${action}`, params);
            else console.log(`[GET Retry ${attempt}/${retries}] Calling: ${action}`);

            const response = await fetch(url.toString(), {
                method: "GET",
                headers: { "Content-Type": "text/plain;charset=utf-8" }
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
            
            const result = await response.json();
            
            if (result.status === 'error') throw new Error(result.message);
            
            return result.data !== undefined ? result.data : result.message;

        } catch (error) {
            const errorMsg = error.toString();
            if (attempt < retries && (errorMsg.includes("Dịch vụ bị lỗi") || errorMsg.includes("Service error") || errorMsg.includes("HTTP Error"))) {
                console.warn(`[API GET Intermittent Error] ${action}: Bắt được lỗi thoáng qua (${errorMsg}). Tự động thử lại sau 1.5s...`);
                await sleep(1500);
            } else {
                console.error(`[API GET Error] ${action}:`, error);
                throw error;
            }
        }
    }
}

async function postRequest(action, body = {}, retries = 3) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (attempt === 1) console.log(`[POST] Calling: ${action}`);
            else console.log(`[POST Retry ${attempt}/${retries}] Calling: ${action}`);

            const payload = { action: action, ...body };

            const response = await fetch(GAS_API_URL, {
                method: "POST",
                mode: "cors",
                body: JSON.stringify(payload),
                headers: { "Content-Type": "text/plain;charset=utf-8" }
            });

            if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

            const result = await response.json();
            
            if (result.status === 'error') throw new Error(result.message);
            
            return result.data !== undefined ? result.data : result.message;

        } catch (error) {
            const errorMsg = error.toString();
            if (attempt < retries && (errorMsg.includes("Dịch vụ bị lỗi") || errorMsg.includes("Service error") || errorMsg.includes("HTTP Error"))) {
                console.warn(`[API POST Intermittent Error] ${action}: Bắt được lỗi thoáng qua (${errorMsg}). Tự động thử lại sau 1.5s...`);
                await sleep(1500);
            } else {
                console.error(`[API POST Error] ${action}:`, error);
                throw error;
            }
        }
    }
}

const API = {
    auth: {
        getRealEmail: (username) => request('getRealEmail', { username }),
        getUserGroup: (email) => request('getUserGroup', { email }),
        getUserMap: () => request('getUserMap'),
        getAllUsers: (groupKey) => request('getAllUsers', { groupKey }),
        getUserInfo: (email) => postRequest('getUserInfo', { email: email }),
        updateNickname: (email, newNickname) => postRequest('updateNickname', { email, newNickname }) 
    },
    project: {
        list: (groupKey, searchName = "") => request('getProjectList', { groupKey, searchName }),
        create: (data, groupKey) => postRequest('createProject', { ...data, groupKey }), 
        updateNote: (projectId, newNote, groupKey) => postRequest('updateProject', { projectId, newNote, groupKey }), 
        share: (projectId, groupKey) => postRequest('shareProject', { projectId, groupKey }), 
        delete: (projectId, groupKey) => postRequest('deleteProject', { projectId, groupKey }), 
        listWithStats: (groupKey, searchName = "") => request('getProjectListWithTaskStats', { groupKey, filters: { searchName } }),
        recalculate: (projectId, groupKey) => postRequest('recalculatePercent', { projectId, groupKey })
    },
    task: {
        list: (projectId, groupKey) => request('getTaskList', { projectId, groupKey }),
        delete: (taskId, projectId, groupKey) => postRequest('deleteTask', { taskId, projectId, groupKey }),
        deleteFile: (taskId, fileId, groupKey) => postRequest('deleteFileFromTask', { taskId, fileId, groupKey }),
        
        save: (taskData, groupKey) => postRequest('saveTask', { ...taskData, groupKey }),
        uploadFile: (fileData, fileName, mimeType, taskId, groupKey, description) => 
            postRequest('uploadFileToTask', { fileData, fileName, mimeType, taskId, groupKey, description })
    },
    file: {
        list: (groupKey, filters) => request('getFileList', { groupKey, ...filters }),
        delete: (fileId, groupKey) => postRequest('deleteFile', { fileId, groupKey }), 
        share: (fileId, groupKey) => postRequest('shareFile', { fileId, groupKey }), 
        getRecentFilesForDashboard: (groupKey) => request('getRecentFilesForDashboard', { groupKey }),
        
        upload: (fileData, fileName, mimeType, groupKey, description, uploaderEmail) => 
            postRequest('uploadFile', { 
                fileData: fileData,  
                fileName: fileName,  
                mimeType: mimeType, 
                groupKey: groupKey, 
                description: description, 
                email: uploaderEmail 
            })
    },
    calendar: {
        getEvents: (startDate, endDate, calendarType, groupKey) => request('getEvents', { startDate, endDate, calendarType, groupKey }),
        create: (eventData, calendarType, groupKey) => postRequest('createEvent', { ...eventData, calendarType, groupKey }),
        deleteEvent: (eventId, calendarType, groupKey) => postRequest('deleteEvent', { eventId, calendarType, groupKey }),
        toggleImportant: (eventId, isImportant, calendarType, groupKey) => postRequest('toggleImportant', { eventId, isImportant, calendarType, groupKey })
    },
    settings: {
        getColors: (groupKey) => request('getBoardSettings', { groupKey })
    },
    notification: {
        get: (limit, groupKey) => request('getNotifications', { groupKey, limit })
    },
    asset: {
        get: (email) => postRequest('getAssetData', { email }),
        save: (email, data) => postRequest('saveAssetData', { email, data }),
        getTeamSummary: () => postRequest('getTeamSummary'),
        saveValuation: (data) => postRequest('saveStockValuation', data),
        getStockList: () => postRequest('getStockList'),
        getStockDetail: (symbol) => postRequest('getStockDetail', { symbol }),
        getMembers: () => postRequest('getMemberList'),
        getMemberData: (email) => postRequest('getMemberDetail', { email })
    },
    note: {
        getUsers: () => postRequest('getFinanceUsers'),
        add: (data) => postRequest('addFinanceNote', data),
        getAll: () => postRequest('getFinanceNotes')
    },
    lounge: {
        sync: (data) => postRequest('syncLounge', data)
    }
};

window.callGAS = async function(action, params = {}) {

    const postActions = [
        'uploadFile', 
        'uploadFileToTask', 
        'saveTask',
        'createProject',
        'updateProject',
        'deleteProject',
        'shareProject',
        'recalculatePercent',
        'deleteFile',
        'shareFile',
        'deleteFileFromTask',
        'deleteTask',
        'createEvent',
        'deleteEvent',
        'toggleImportant',
        'updateNickname',
        'getNotifications',
        'getAssetData',
        'saveAssetData',
        'getTeamSummary',
        'saveStockValuation',
        'getStockList',   
        'getStockDetail',
        'getMemberList',   
        'getMemberDetail',
        'getFinanceUsers',
        'addFinanceNote',
        'getFinanceNotes',
        'syncLounge',
        'getUserInfo',
        'getProjectListWithTaskStats'
    ];

    try {
        let rawResult;
        
        if (postActions.includes(action)) {
            rawResult = await postRequest(action, params);
        } else {
            rawResult = await request(action, params);
        }

        let responseData = rawResult;
        let responseMessage = "Thành công";

        if (typeof rawResult === 'string') {
            responseMessage = rawResult;
            responseData = rawResult; 
        }

        return { 
            status: 'success', 
            data: responseData, 
            message: responseMessage 
        };

    } catch (error) {
        console.warn(`callGAS Failed [${action}]:`, error);
        return { 
            status: 'error', 
            message: error.message || "Lỗi kết nối Server" 
        };
    }
};

window.google = {
    script: {
        run: {
            withSuccessHandler: function(callback) {
                this.successCallback = callback;
                return this;
            },
            withFailureHandler: function(callback) {
                this.failureCallback = callback;
                return this;
            },
            

            // 1. Auth & User
            getRealEmail: (user) => handleLegacyRun('getRealEmail', { username: user }),
            updateNicknameInSheet: (email, nick) => handleLegacyRun('updateNickname', { email: email, newNickname: nick }),

            deleteCalendarEvent: (id, type, group) => handleLegacyRun('deleteEvent', { 
                eventId: id, 
                calendarType: type, 
                groupKey: group 
            }),
            createCalendarEvent: (data, type, group) => handleLegacyRun('createEvent', { 
                ...data, 
                calendarType: type, 
                groupKey: group 
            }),

            // 3. Project
            createNewProject: (data, group) => handleLegacyRun('createProject', { 
                ...data, 
                groupKey: group 
            }),
            updateProjectDescription: (id, note, group) => handleLegacyRun('updateProject', { 
                projectId: id, 
                newNote: note, 
                groupKey: group 
            }),
            deleteProjectAndTasks: (id, group) => handleLegacyRun('deleteProject', { 
                projectId: id, 
                groupKey: group 
            }),

            // 4. Task
            saveTask: (data, group) => handleLegacyRun('saveTask', { 
                ...data, 
                groupKey: group 
            }),
            deleteTask: (taskId, projId, group) => handleLegacyRun('deleteTask', { 
                taskId: taskId, 
                projectId: projId, 
                groupKey: group 
            }),

            // 5. File
            deleteFile: (fileId, group) => handleLegacyRun('deleteFile', { 
                fileId: fileId, 
                groupKey: group 
            }),
            shareFileToGeneral: (fileId, group) => handleLegacyRun('shareFile', { 
                fileId: fileId, 
                groupKey: group 
            }),
            
        }
    }
};
function handleLegacyRun(action, params) {
    const context = window.google.script.run;
    window.callGAS(action, params).then(res => {
        if(res.status === 'success' && context.successCallback) context.successCallback(res.data);
        else if(res.status === 'error' && context.failureCallback) context.failureCallback(new Error(res.message));
    });
}

console.log("Gọi API thành công!");


// ==========================================
// KÍCH HOẠT PWA (SERVICE WORKER) TOÀN HỆ THỐNG
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Đăng ký file sw.js ở thư mục gốc
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] Đã kích hoạt thành công. Phạm vi:', reg.scope))
            .catch(err => console.error('[PWA] Lỗi kích hoạt:', err));
    });
}


