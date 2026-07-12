CREATE TABLE IF NOT EXISTS children (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  grade INTEGER NOT NULL,
  avatar TEXT NOT NULL DEFAULT '🐣',
  archived INTEGER NOT NULL DEFAULT 0,
  wish_reward_id INTEGER REFERENCES rewards(id)
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
  points_awarded INTEGER,
  started_at TEXT,
  completed_at TEXT,
  scored_at TEXT
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_plan_child_template
  ON daily_plan(child_id, template_id);

CREATE TABLE IF NOT EXISTS bonus_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  points INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS task_bonus (
  task_instance_id INTEGER NOT NULL REFERENCES task_instances(id),
  bonus_item_id INTEGER NOT NULL REFERENCES bonus_items(id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_task_bonus ON task_bonus(task_instance_id, bonus_item_id);

CREATE TABLE IF NOT EXISTS scoring_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  on_time_bonus INTEGER NOT NULL DEFAULT 3,
  error_penalty INTEGER NOT NULL DEFAULT 2,
  min_points INTEGER NOT NULL DEFAULT 1
);
