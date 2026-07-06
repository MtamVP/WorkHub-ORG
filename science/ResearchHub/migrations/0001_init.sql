CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT
);

CREATE INDEX idx_topics_updated_at ON topics(updated_at);
