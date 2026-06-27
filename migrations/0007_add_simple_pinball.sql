-- Migration number: 0007
-- Description: Add simple-pinball game

INSERT INTO games (slug, title, description, path, sort_order) VALUES
  ('simple-pinball', 'シンプルピンボール', 'シンプルな1台ピンボール。バンパーを叩いて高スコアを目指せ！', '/games/simple-pinball/', 7);
