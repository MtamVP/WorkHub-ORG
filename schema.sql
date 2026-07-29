-- Bảng lưu trữ tin nhắn chat
CREATE TABLE public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    text TEXT NOT NULL,
    uid TEXT NOT NULL,
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_pinned BOOLEAN DEFAULT FALSE,
    group_key TEXT NOT NULL,
    reply_to JSONB,
    reactions JSONB DEFAULT '{}'::jsonb
);

-- Bật Realtime cho bảng messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Bảng lưu trữ trạng thái người dùng (Presence)
CREATE TABLE public.user_status (
    uid TEXT PRIMARY KEY,
    state TEXT,
    last_changed TIMESTAMPTZ DEFAULT NOW(),
    display_name TEXT,
    email TEXT,
    photo_url TEXT,
    current_group TEXT
);

-- Bật Realtime cho bảng user_status
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_status;
