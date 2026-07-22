// Helper chống XSS: escape dữ liệu trước khi chèn vào innerHTML
window.escapeHtml = function (value) {
    return String(value === null || value === undefined ? '' : value).replace(/[&<>"']/g, function (ch) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
};

// Escape chuỗi khi nhúng vào tham số JS trong thuộc tính onclick
window.escapeJs = function (value) {
    return String(value === null || value === undefined ? '' : value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"');
};

// Supabase config
const SUPABASE_URL = "https://gqsbsqaxzpzcloaopzvv.supabase.co";
const SUPABASE_KEY = "sb_publishable_sl9uOpcIzfzN9NZ5D_ZdsQ_FQZchyUR";

// Tránh lỗi nếu chưa nhúng thư viện trong HTML
const sbClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null;
window.supabaseClient = sbClient;

// Helper: Convert Base64 sang Blob để upload Storage
function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

// Hàm hỗ trợ lấy User ID (UUID) từ email/username
async function getUserId(emailOrUsername) {
    if (!sbClient) return null;
    const { data } = await sbClient.from('users')
        .select('id').or(`nickname.eq.${emailOrUsername},email.eq.${emailOrUsername}`).single();
    return data ? data.id : null;
}

// ==========================================
// API LAYER (Rewrite dùng Supabase)
// ==========================================
const API = {
    auth: {
        getRealEmail: async (username) => {
            if (!sbClient) return null;
            const { data, error } = await sbClient.from('users')
                .select('email').or(`nickname.eq.${username},email.eq.${username}`).single();
            if (error || !data) return null;
            return data.email;
        },
        getUserGroup: async (email) => {
            if (!sbClient) return 'guest';
            const { data, error } = await sbClient.from('users').select('group_key').eq('email', email).single();
            if (error || !data) return 'guest';
            return data.group_key;
        },
        getUserMap: async () => {
            if (!sbClient) return {};
            const { data, error } = await sbClient.from('users').select('email, nickname');
            if (error) return {};
            let map = {};
            data.forEach(u => map[u.email] = u.nickname);
            return map;
        },
        getAllUsers: async (groupKey) => {
            if (!sbClient) return [];
            let query = sbClient.from('users').select('email, name:nickname');
            if (groupKey && groupKey !== 'all') query = query.eq('group_key', groupKey);
            const { data } = await query;
            return data || [];
        },
        getUserInfo: async (email) => {
            if (!sbClient) return { group: 'guest', name: '' };
            const { data, error } = await sbClient.from('users').select('name:nickname, group:group_key').eq('email', email).single();
            if (error || !data) return { group: 'guest', name: '' };
            return data;
        },
        updateNickname: async (email, newNickname) => {
            const { error } = await sbClient.from('users').update({ nickname: newNickname }).eq('email', email);
            if (error) throw error;
            return "Success";
        },
        getWallpaper: async (email) => {
            if (!sbClient) return null;
            const { data } = await sbClient.from('users').select('wallpaper').eq('email', email).single();
            return data ? data.wallpaper : null;
        },
        updateWallpaper: async (email, wallpaperUrl) => {
            const { error } = await sbClient.from('users').update({ wallpaper: wallpaperUrl }).eq('email', email);
            if (error) throw error;
            return "Đã cập nhật ảnh nền";
        }
    },
    project: {
        list: async (groupKey, searchName = "") => {
            if (!sbClient) return [];
            let query = sbClient.from('projects').select('*, users!owner_id(nickname)').order('updated_at', { ascending: false });

            if (groupKey === 'all') {
                query = query.or('group_key.eq.all,is_shared.eq.true');
            } else {
                query = query.eq('group_key', groupKey);
            }
            if (searchName) {
                query = query.ilike('name', `%${searchName}%`);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Map data về chuẩn cũ
            return data.map(p => ({
                id: p.id,
                name: p.name,
                owner: p.users ? p.users.nickname : 'Unknown',
                percent: p.percent,
                status: p.status,
                lastUpdated: p.updated_at,
                isShared: p.is_shared,
                originGroup: p.group_key
            }));
        },
        create: async (projectData, groupKey) => {
            const id = "PJ_" + Date.now();
            const ownerId = await getUserId(projectData.owner);

            const { error } = await sbClient.from('projects').insert({
                id: id,
                name: projectData.name,
                owner_id: ownerId,
                status: projectData.status || "Planning",
                group_key: groupKey
            });
            if (error) throw error;
            return "Đã tạo dự án mới!";
        },
        updateNote: async (projectId, newNote, groupKey) => {
            const { error } = await sbClient.from('projects').update({ description: newNote }).eq('id', projectId);
            if (error) throw error;
            return "Đã cập nhật ghi chú thành công!";
        },
        share: async (projectId, groupKey) => {
            const { error } = await sbClient.from('projects').update({ is_shared: true }).eq('id', projectId);
            if (error) throw error;
            return "Đã chia sẻ thành công!";
        },
        delete: async (projectId, groupKey) => {
            // Delete all tasks associated with this project first
            await sbClient.from('tasks').delete().eq('project_id', projectId);
            
            // Then delete the project
            const { error } = await sbClient.from('projects').delete().eq('id', projectId);
            if (error) throw error;
            return "Đã xóa dự án!";
        },
        listWithStats: async (groupKey, searchName = "") => {
            const projects = await API.project.list(groupKey, searchName);
            if (!projects || projects.length === 0) return [];
            
            // Get all tasks for these projects
            const projectIds = projects.map(p => p.id);
            const { data: tasks } = await sbClient.from('tasks').select('project_id, status').in('project_id', projectIds);
            
            // Map tasks to projects
            for (let p of projects) {
                p.taskStats = { done: 0, working: 0, stuck: 0 };
                if (tasks) {
                    const pTasks = tasks.filter(t => t.project_id === p.id);
                    pTasks.forEach(t => {
                        let st = String(t.status).toLowerCase();
                        if (st === 'done') p.taskStats.done++;
                        else if (st === 'working on it') p.taskStats.working++;
                        else if (st === 'stuck') p.taskStats.stuck++;
                    });
                }
            }
            return projects;
        },
        recalculate: async (projectId, groupKey) => {
            const { data: tasks } = await sbClient.from('tasks').select('status').eq('project_id', projectId);
            if (!tasks || tasks.length === 0) return 0;
            const doneTasks = tasks.filter(t => String(t.status).toLowerCase() === 'done').length;
            const percent = Math.round((doneTasks / tasks.length) * 100);
            await sbClient.from('projects').update({ percent }).eq('id', projectId);
            return percent;
        }
    },
    task: {
        list: async (projectId, groupKey) => {
            const { data, error } = await sbClient.from('tasks').select('*').eq('project_id', projectId);
            if (error) throw error;
            
            // Map assignees to names
            const { data: users } = await sbClient.from('users').select('email, nickname');
            if (users && data) {
                data.forEach(task => {
                    if (task.assignees) {
                        const emails = task.assignees.split(',').map(e => e.trim().toLowerCase());
                        const names = [];
                        emails.forEach(email => {
                            const u = users.find(user => user.email && user.email.toLowerCase() === email);
                            if (u && u.nickname) names.push(u.nickname);
                            else names.push(email.split('@')[0]);
                        });
                        task.assigneeNames = names;
                    }
                });
            }
            return data;
        },
        delete: async (taskId, projectId, groupKey) => {
            const { error } = await sbClient.from('tasks').delete().eq('id', taskId);
            if (error) throw error;
            return "Đã xóa task!";
        },
        deleteFile: async (taskId, fileId, groupKey) => {
            if (!sbClient) throw new Error("Chưa setup Supabase");
            
            const { data: task, error: fetchError } = await sbClient.from('tasks').select('attachments').eq('id', taskId).single();
            if (fetchError) throw fetchError;
            
            let attachments = typeof task.attachments === 'string' ? JSON.parse(task.attachments || '[]') : task.attachments;
            if (!Array.isArray(attachments)) attachments = [];
            
            const fileToDelete = attachments.find(f => f.id === fileId);
            if (!fileToDelete) throw new Error("Không tìm thấy file trong task này.");
            
            if (fileToDelete.id.startsWith("TF_")) {
                const urlParts = fileToDelete.url.split('/general_bucket/');
                if (urlParts.length > 1) {
                    const filePath = decodeURIComponent(urlParts[1]);
                    const { error: deleteError } = await sbClient.storage.from('general_bucket').remove([filePath]);
                    if (deleteError) console.error("Lỗi xóa file storage:", deleteError);
                }
            }
            
            const newAttachments = attachments.filter(f => f.id !== fileId);
            const { error: updateError } = await sbClient.from('tasks').update({ attachments: newAttachments }).eq('id', taskId);
            if (updateError) throw updateError;
            
            return newAttachments;
        },
        save: async (taskData, groupKey) => {
            const { error } = await sbClient.from('tasks').upsert({
                id: taskData.id || "T_" + Date.now(),
                project_id: taskData.projectId,
                name: taskData.name,
                status: taskData.status,
                priority: taskData.priority,
                due_date: taskData.dueDate,
                description: taskData.description,
                attachments: typeof taskData.attachments === 'string' ? JSON.parse(taskData.attachments || '[]') : taskData.attachments,
                assignees: Array.isArray(taskData.assignees) ? taskData.assignees.join(', ') : taskData.assignees
            });
            if (error) throw error;
            return "Đã lưu task!";
        },
        uploadFile: async (fileData, fileName, mimeType, taskId, groupKey, description, uploaderEmail) => {
            if (!sbClient) return { success: false, message: "Chưa setup Supabase" };

            if (fileData.includes('base64,')) fileData = fileData.split('base64,')[1];
            const blob = b64toBlob(fileData, mimeType);
            const fileId = "TF_" + Date.now();
            const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `tasks/${taskId}/${fileId}_${safeFileName}`;
            const bucketName = 'general_bucket';

            const { error: uploadError } = await sbClient.storage.from(bucketName).upload(filePath, blob, { contentType: mimeType });
            if (uploadError) throw uploadError;

            // Cập nhật mảng attachments trong task
            const { data: task, error: fetchError } = await sbClient.from('tasks').select('attachments').eq('id', taskId).single();
            if (fetchError) throw fetchError;

            let attachments = typeof task.attachments === 'string' ? JSON.parse(task.attachments || '[]') : task.attachments;
            if (!Array.isArray(attachments)) attachments = [];

            attachments.push({
                id: fileId,
                name: fileName,
                url: `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${filePath}`,
                mimeType: mimeType,
                uploader: uploaderEmail || "unknown",
                date: new Date().toLocaleString('vi-VN')
            });

            await sbClient.from('tasks').update({ attachments }).eq('id', taskId);
            return attachments;
        }
    },
    file: {
        list: async (groupKey, filters) => {
            if (!sbClient) return [];
            let query = sbClient.from('files').select('*, users!uploader_id(email)').order('created_at', { ascending: false });
            if (groupKey === 'all') {
                query = query.or('group_key.eq.all,is_shared.eq.true');
            } else {
                query = query.eq('group_key', groupKey);
            }
            const { data, error } = await query;
            if (error) throw error;

            return data.map(f => {
                let folderPath = "/";
                if (f.storage_path) {
                    const parts = f.storage_path.split('/');
                    if (parts.length > 2) {
                        folderPath = parts.slice(1, -1).join('/') + '/';
                    }
                }
                return {
                    id: f.id,
                    name: f.name,
                    description: f.description,
                    folderPath: folderPath,
                    uploader: f.users ? f.users.email : 'Unknown',
                    date: new Date(f.created_at).toLocaleString('vi-VN'),
                    url: `${SUPABASE_URL}/storage/v1/object/public/${f.storage_path}`,
                    mimeType: f.mime_type,
                    isShared: f.is_shared,
                    groupKey: f.group_key
                };
            });
        },
        delete: async (fileId, groupKey) => {
            // Lấy thông tin file để biết storage_path
            const { data: fileData, error: fetchError } = await sbClient.from('files').select('storage_path').eq('id', fileId).single();
            if (fetchError) throw fetchError;

            if (fileData && fileData.storage_path) {
                // storage_path có dạng: "bucketName/filePath"
                const parts = fileData.storage_path.split('/');
                const bucketName = parts[0];
                const filePath = parts.slice(1).join('/');

                if (bucketName && filePath) {
                    const { error: storageError } = await sbClient.storage.from(bucketName).remove([filePath]);
                    if (storageError) console.error("Lỗi xóa file từ storage:", storageError);
                }
            }

            // Xóa record trong DB
            const { error } = await sbClient.from('files').delete().eq('id', fileId);
            if (error) throw error;
            return "Đã xóa file!";
        },
        share: async (fileId, groupKey) => {
            const { error } = await sbClient.from('files').update({ is_shared: true }).eq('id', fileId);
            if (error) throw error;
            return "Đã share file!";
        },
        getRecentFilesForDashboard: async (groupKey) => {
            return API.file.list(groupKey, {});
        },
        upload: async (fileData, fileName, mimeType, groupKey, description, uploaderEmail, folderPath = "") => {
            if (!sbClient) throw new Error("Supabase chưa được cấu hình.");

            // Xóa header base64 nếu có
            if (fileData.includes('base64,')) fileData = fileData.split('base64,')[1];

            const blob = b64toBlob(fileData, mimeType);
            const fileId = "F_" + Date.now() + Math.floor(Math.random()*1000); // add random to prevent fast loop conflicts
            const safeFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
            const filePath = `${fileId}_${safeFileName}`;
            const bucketName = groupKey === 'finance' ? 'finance_bucket' :
                (groupKey === 'science' ? 'science_bucket' : 'general_bucket');

            const fullStoragePath = folderPath ? `${folderPath}/${filePath}` : filePath;

            // 1. Upload vào Storage
            const { error: uploadError } = await sbClient.storage.from(bucketName).upload(fullStoragePath, blob, { contentType: mimeType });
            if (uploadError) throw uploadError;

            // 2. Ghi metadata vào CSDL
            const uploaderId = await getUserId(uploaderEmail);
            const { error: dbError } = await sbClient.from('files').insert({
                id: fileId,
                name: fileName,
                storage_path: `${bucketName}/${fullStoragePath}`,
                mime_type: mimeType,
                uploader_id: uploaderId,
                group_key: groupKey,
                description: description || ''
            });

            if (dbError) throw dbError;
            return `File "${fileName}" đã được tải lên thành công!`;
        }
    },
    calendar: {
        getEvents: async (startDate, endDate, calendarType, groupKey, email) => {
            let query = sbClient.from('events')
                .select('*')
                .gte('start_time', startDate)
                .lte('end_time', endDate)
                .eq('group_key', groupKey);

            if (calendarType) {
                query = query.eq('calendar_type', calendarType);
                if (calendarType === 'personal' && email) {
                    query = query.eq('created_by', email);
                }
            }

            const { data, error } = await query;

            if (error) throw error;

            return data.map(ev => ({
                id: ev.id,
                title: ev.title,
                startTime: ev.start_time,
                endTime: ev.end_time,
                isImportant: ev.is_important,
                location: ev.location,
                description: ev.description
            }));
        },
        create: async (eventData, calendarType, groupKey, email) => {
            const { error } = await sbClient.from('events').insert({
                id: "EV_" + Date.now(),
                title: eventData.title,
                start_time: eventData.startDate + ' ' + eventData.startTime,
                end_time: eventData.endDate + ' ' + eventData.endTime,
                description: eventData.description,
                location: eventData.location,
                calendar_type: calendarType,
                group_key: groupKey,
                created_by: email
            });
            if (error) throw error;
            return "Tạo sự kiện thành công!";
        },
        deleteEvent: async (eventId, calendarType, groupKey, email) => {
            let query = sbClient.from('events').delete().eq('id', eventId);
            if (calendarType === 'personal' && email) {
                query = query.eq('created_by', email);
            }
            const { error } = await query;
            if (error) throw error;
            return "Xóa sự kiện thành công!";
        },
        toggleImportant: async (eventId, isImportant, calendarType, groupKey, email) => {
            let query = sbClient.from('events').update({ is_important: isImportant }).eq('id', eventId);
            if (calendarType === 'personal' && email) {
                query = query.eq('created_by', email);
            }
            const { error } = await query;
            if (error) throw error;
            return "Cập nhật thành công!";
        }
    },
    // ==========================================
    // MODULE: FINANCE (Asset, Note, Stock)
    // ==========================================
    asset: {
        getAssetData: async (email) => {
            if (!sbClient) return { status: 'success', cash: 0, debt: 0, data: [] };
            const userId = await getUserId(email);
            const { data, error } = await sbClient.from('finance_assets').select('*').eq('user_id', userId).single();
            if (error || !data) return { status: 'success', cash: 0, debt: 0, data: [] };
            return { status: 'success', cash: data.cash, debt: data.debt, data: data.data };
        },
        saveAssetData: async (email, rawData) => {
            const parsed = JSON.parse(rawData);
            const cash = parsed.cash || 0;
            const debt = parsed.debt || 0;
            const items = parsed.items || [];

            let nav = cash - debt;
            items.forEach(item => { nav += (item[8] || 0); }); // item[8] là gttt

            const userId = await getUserId(email);
            if (!userId) throw new Error("User không tồn tại");

            const { error } = await sbClient.from('finance_assets').upsert({
                user_id: userId,
                cash: cash,
                debt: debt,
                nav: nav,
                data: items
            }, { onConflict: 'user_id' });
            if (error) throw error;
            return "Đã lưu danh mục đầu tư!";
        },
        getTeamSummary: async () => {
            const { data, error } = await sbClient.from('finance_assets').select('*, users!inner(nickname, email)');
            if (error) throw error;

            const totalNav = data.reduce((sum, row) => sum + Number(row.nav), 0);

            let result = data.map(row => ({
                name: row.users.nickname || row.users.email,
                nav: Number(row.nav).toLocaleString('en-US'),
                percent: totalNav > 0 ? ((Number(row.nav) / totalNav) * 100).toFixed(1) + '%' : '0%'
            }));

            result.push({
                name: "TỔNG CỘNG",
                nav: totalNav.toLocaleString('en-US'),
                percent: "100%"
            });
            return result;
        },
        getMemberList: async () => {
            const { data } = await sbClient.from('users').select('email').eq('group_key', 'finance');
            return data ? data.map(d => d.email) : [];
        },
        getMemberDetail: async (email) => {
            const userId = await getUserId(email);
            const { data, error } = await sbClient.from('finance_assets').select('*').eq('user_id', userId).single();
            if (error || !data) return [];

            let table = [];
            table.push([email, "", "", "", "", "", "", "", "", ""]);
            table.push(["STT", "Danh mục", "Vol", "CK giao dịch", "CK HCCN", "Giá vốn", "Giá TT", "GT vốn", "GTTT", "Lãi/lỗ"]);

            const items = data.data || [];
            items.forEach((item) => {
                table.push(item.map(val => typeof val === 'number' ? val.toLocaleString('en-US') : val));
            });

            table.push(["TỔNG DANH MỤC", "", "", "", "", "", "", 0, 0, 0]);
            table.push(["Tiền mặt", "", "", "", "", "", "", Number(data.cash).toLocaleString('en-US'), "", ""]);
            table.push(["Dư nợ", "", "", "", "", "", "", Number(data.debt).toLocaleString('en-US'), "", ""]);
            table.push(["NAV", "", "", "", "", "", "", Number(data.nav).toLocaleString('en-US'), "", ""]);
            return table;
        }
    },
    note: {
        getFinanceUsers: async () => {
            const { data } = await sbClient.from('users').select('email').eq('group_key', 'finance');
            return data ? data.map(d => d.email) : [];
        },
        addFinanceNote: async (payload) => {
            const authorId = await getUserId(payload.author);
            const { error } = await sbClient.from('finance_notes').insert({
                id: "FN_" + Date.now(),
                author_id: authorId,
                title: payload.title || 'Note',
                content: payload.content,
                color: payload.color
            });
            if (error) throw error;
            return "Thêm ghi chú thành công!";
        },
        getFinanceNotes: async () => {
            const { data, error } = await sbClient.from('finance_notes').select('*, users!inner(email)').order('created_at', { ascending: false });
            if (error) throw error;
            return data.map(n => ({
                id: n.id,
                author: n.users.email,
                title: n.title,
                content: n.content,
                color: n.color,
                date: new Date(n.created_at).toLocaleDateString('vi-VN')
            }));
        }
    },
    stock: {
        getStockList: async () => {
            const { data } = await sbClient.from('finance_stocks').select('symbol');
            return data ? data.map(d => d.symbol) : [];
        },
        getStockDetail: async (symbol) => {
            const { data } = await sbClient.from('finance_stocks').select('data').eq('symbol', symbol).single();
            return data ? data.data : {};
        },
        saveStockValuation: async (payload) => {
            const { error } = await sbClient.from('finance_stocks').upsert({
                symbol: payload.symbol,
                data: payload
            });
            if (error) throw error;
            return "Lưu định giá thành công!";
        }
    },
    // ==========================================
    // OTHER MOCKS & SETTINGS
    // ==========================================
    settings: {
        getSetting: async (key) => {
            if (!sbClient) return null;
            const { data } = await sbClient.from('app_settings').select('value').eq('key', key).single();
            return data ? data.value : null;
        },
        updateSetting: async (key, value, userEmail) => {
            const { error } = await sbClient.from('app_settings').upsert({
                key: key,
                value: value,
                updated_by: userEmail,
                updated_at: new Date().toISOString()
            });
            if (error) throw error;
        },
        getColors: async () => ({})
    },
    notification: { get: async () => ([]) },
    lounge: { sync: async () => "Synced" }
};

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================
window.callGAS = async function (action, params = {}) {
    console.log(`[Supabase Router] Gọi hành động: ${action}`, params);
    try {
        let result = null;
        switch (action) {
            // -- USER --
            case 'updateNickname': result = await API.auth.updateNickname(params.email, params.newNickname); break;
            case 'getAllUsers': result = await API.auth.getAllUsers(params.groupKey); break;
            case 'getUserGroup': result = await API.auth.getUserGroup(params.email); break;

            // -- FILE & DRIVE --
            case 'getRecentFilesForDashboard': result = await API.file.getRecentFilesForDashboard(params.groupKey); break;
            case 'getFileList': result = await API.file.list(params.groupKey, params); break;
            case 'deleteFile': result = await API.file.delete(params.fileId, params.groupKey); break;
            case 'uploadFile': result = await API.file.upload(params.fileData, params.fileName, params.mimeType, params.groupKey, params.description, params.email, params.folderPath); break;
            case 'shareFile': result = await API.file.share(params.fileId, params.groupKey); break;

            // -- CALENDAR --
            case 'getEvents': result = await API.calendar.getEvents(params.startDate, params.endDate, params.calendarType, params.groupKey, params.email); break;
            case 'createEvent': result = await API.calendar.create(params, params.calendarType, params.groupKey, params.email); break;
            case 'deleteEvent': result = await API.calendar.deleteEvent(params.eventId, params.calendarType, params.groupKey, params.email); break;
            case 'toggleImportant': result = await API.calendar.toggleImportant(params.eventId, params.isImportant, params.calendarType, params.groupKey, params.email); break;

            // -- PROJECTS --
            case 'getProjectList': result = await API.project.list(params.groupKey, params.searchName); break;
            case 'getProjectListWithTaskStats': result = await API.project.listWithStats(params.groupKey, params.searchName); break;
            case 'createProject': result = await API.project.create(params, params.groupKey); break;
            case 'updateProject': result = await API.project.updateNote(params.projectId, params.newNote, params.groupKey); break;
            case 'shareProject': result = await API.project.share(params.projectId, params.groupKey); break;
            case 'deleteProject': result = await API.project.delete(params.projectId, params.groupKey); break;

            // -- TASKS --
            case 'getTaskList': result = await API.task.list(params.projectId, params.groupKey); break;
            case 'saveTask': result = await API.task.save(params, params.groupKey); break;
            case 'deleteTask': result = await API.task.delete(params.taskId, params.projectId, params.groupKey); break;
            case 'deleteFileFromTask': result = await API.task.deleteFile(params.taskId, params.fileId, params.groupKey); break;
            case 'uploadFileToTask': result = await API.task.uploadFile(params.fileData, params.fileName, params.mimeType, params.taskId, params.groupKey, params.description, params.email); break;

            // -- FINANCE ASSETS --
            case 'getAssetData':
                return await API.asset.getAssetData(params.email); // Không bọc trong {status, data} vì hàm đã trả về đúng form
            case 'saveAssetData': result = await API.asset.saveAssetData(params.email, params.data); break;
            case 'getTeamSummary': result = await API.asset.getTeamSummary(); break;
            case 'getMemberList': result = await API.asset.getMemberList(); break;
            case 'getMemberDetail': result = await API.asset.getMemberDetail(params.email); break;

            // -- FINANCE NOTES --
            case 'getFinanceUsers': result = await API.note.getFinanceUsers(); break;
            case 'getFinanceNotes': result = await API.note.getFinanceNotes(); break;
            case 'addFinanceNote': result = await API.note.addFinanceNote(params); break;

            // -- FINANCE STOCKS --
            case 'getStockList': result = await API.stock.getStockList(); break;
            case 'getStockDetail': result = await API.stock.getStockDetail(params.symbol); break;
            case 'saveStockValuation': result = await API.stock.saveStockValuation(params); break;

            // -- OTHER --
            case 'getNotifications': result = await API.notification.get(params.groupKey, params.limit); break;
            case 'syncLounge': result = await API.lounge.sync(params); break;

            default:
                console.warn(`[Supabase Router] Chưa hỗ trợ action: ${action}`);
                return { status: 'success', data: [], message: `Chưa cấu hình hành động ${action}` };
        }
        const finalMessage = typeof result === 'string' ? result : 'OK';
        return { status: 'success', data: result, message: finalMessage };
    } catch (error) {
        console.error(`[Supabase Router] Lỗi tại ${action}:`, error);
        return { status: 'error', data: null, message: error.message || String(error) };
    }
};

// ==========================================
// KÍCH HOẠT PWA (SERVICE WORKER)
// ==========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('[PWA] Đã kích hoạt thành công. Phạm vi:', reg.scope))
            .catch(err => console.error('[PWA] Lỗi kích hoạt:', err));
    });
}
