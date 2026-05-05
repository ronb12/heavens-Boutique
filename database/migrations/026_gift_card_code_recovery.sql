-- Encrypted-at-rest copy of gift card codes for authorized admin recovery (lost email / lost code).
ALTER TABLE gift_cards
  ADD COLUMN IF NOT EXISTS code_cipher TEXT;

COMMENT ON COLUMN gift_cards.code_cipher IS 'AES-256-GCM ciphertext (base64); plain code never logged. Null for legacy rows until reissued.';
