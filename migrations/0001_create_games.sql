-- Migration number: 0001
-- Description: Create games table and seed sample games

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  path TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1
);

INSERT INTO games (slug, title, description, path, sort_order) VALUES
  ('tap-counter', 'タップカウンター', '制限時間内にいくらタップできるか', '/games/tap-counter/', 1),
  ('number-guess', '数字当て', '1〜100の数字を当てよう', '/games/number-guess/', 2);
