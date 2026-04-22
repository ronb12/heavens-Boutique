-- 014: Homepage CMS content (single-row JSON)

CREATE TABLE IF NOT EXISTS homepage_content (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

