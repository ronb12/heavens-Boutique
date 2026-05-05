-- Track Stripe-funded gift card purchases for idempotent webhook fulfillment.
ALTER TABLE gift_cards
  ADD COLUMN IF NOT EXISTS purchased_via_payment_intent_id TEXT UNIQUE;

COMMENT ON COLUMN gift_cards.purchased_via_payment_intent_id IS 'Stripe PaymentIntent id when this card was bought online (webhook inserts once).';
