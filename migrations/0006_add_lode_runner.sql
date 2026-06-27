-- Migration number: 0006
-- Description: Add lode-runner game

INSERT INTO games (slug, title, description, path, sort_order) VALUES
  ('lode-runner', 'ロードランナー', '1面だけのシンプルロードランナー。穴を掘って敵を避け、金塊を集めよう！', '/games/lode-runner/', 6);
