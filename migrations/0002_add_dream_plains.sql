-- Migration number: 0002
-- Description: Add dream-plains platformer game

INSERT INTO games (slug, title, description, path, sort_order) VALUES
  ('dream-plains', 'ドリーム平原 1面', 'マリオ2風の横スクロールアクション。敵を踏んで投げ、ゴールを目指せ！', '/games/dream-plains/', 3);
