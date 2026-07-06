CREATE TABLE backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  topic_count INTEGER NOT NULL,
  data TEXT NOT NULL
);

CREATE INDEX idx_backups_created_at ON backups(created_at);
