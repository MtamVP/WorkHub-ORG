window.WORKHUB_SYNC_CONFIG = {
    dbFile: 'sqlite:workhub-org-cache.db',
    // Actions eligible for optimistic local UI patching on offline write (small allowlist —
    // everything else in MUTATING_ACTIONS still queues+replays correctly, it just won't
    // reflect in the UI instantly while offline).
    optimisticActions: ['saveTask', 'deleteTask'],
    describeAction: function (action, params) {
        var labels = {
            saveTask: 'Lưu công việc "' + (params.name || '') + '"',
            deleteTask: 'Xoá công việc',
            createProject: 'Tạo dự án "' + (params.name || '') + '"',
            updateProject: 'Cập nhật dự án',
            deleteProject: 'Xoá dự án',
            setProjectArchived: 'Lưu trữ dự án',
            createEvent: 'Tạo sự kiện',
            updateEvent: 'Cập nhật sự kiện',
            deleteEvent: 'Xoá sự kiện',
            addMilestone: 'Thêm cột mốc',
            toggleMilestone: 'Cập nhật cột mốc',
            deleteMilestone: 'Xoá cột mốc',
            addTaskComment: 'Thêm bình luận công việc',
            addChecklistItem: 'Thêm mục checklist',
            deleteChecklistItem: 'Xoá mục checklist',
            uploadFile: 'Tải lên tệp',
            deleteFile: 'Xoá tệp'
        };
        return labels[action] || action;
    }
};
