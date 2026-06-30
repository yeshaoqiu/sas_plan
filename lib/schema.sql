CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🐣',
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  default_minutes INTEGER NOT NULL,
  base_points INTEGER NOT NULL,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_instances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id),
  template_id INTEGER NOT NULL REFERENCES task_templates(id),
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  actual_minutes INTEGER,
  focused INTEGER,
  used_scaffold INTEGER,
  did_check INTEGER,
  error_count INTEGER,
  note TEXT,
  points_awarded INTEGER
);

CREATE TABLE IF NOT EXISTS point_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id),
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  task_instance_id INTEGER REFERENCES task_instances(id),
  reward_id INTEGER REFERENCES rewards(id),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rewards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  cost INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS daily_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  child_id INTEGER NOT NULL REFERENCES children(id),
  template_id INTEGER NOT NULL REFERENCES task_templates(id)
);
