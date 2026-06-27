-- Migration number: 0004
-- Description: Remove tap-counter and dream-plains games

DELETE FROM games WHERE slug IN ('tap-counter', 'dream-plains');
