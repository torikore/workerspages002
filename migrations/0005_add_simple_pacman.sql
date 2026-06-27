-- Migration number: 0005
-- Description: Add simple-pacman game

INSERT INTO games (slug, title, description, path, sort_order) VALUES
  ('simple-pacman', 'シンプルパックマン', '1面だけのシンプルなパックマン。ドットを全部食べてゴーストを避けよう！', '/games/simple-pacman/', 5);
