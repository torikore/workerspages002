-- Migration number: 0003
-- Description: Add tetris game

INSERT INTO games (slug, title, description, path, sort_order) VALUES
  ('tetris', 'テトリス', 'シンプルなテトリス。ラインを揃えて高スコアを目指せ！', '/games/tetris/', 4);
