-- Richer default copy for the public Shipping page (CMS: content_pages.slug = shipping)

UPDATE content_pages
SET
  title = 'Shipping',
  excerpt = 'How we pack, ship, and keep you informed from checkout to delivery.',
  body = E'We pack every Heaven''s Boutique order with care—so your pieces arrive ready to wear. Shipping options and delivery estimates are calculated at checkout based on your address and the service you choose (for example standard, expedited, or priority where available).\n\nMost orders begin processing within 1–2 business days after payment clears. During launches, holidays, or high-volume weekends, processing may take a little longer—we will communicate delays on the site or by email when they affect your order.\n\nWhen your order ships, you will receive an email with tracking details so you can follow it door-to-door. Please allow time for tracking to activate after the label is created.\n\nCarriers occasionally experience delays due to weather, sorting backlogs, or rural delivery routes. If your package appears stalled, check the carrier''s tracking page first; if it still looks wrong after a few days, contact us with your order number and we will help investigate.\n\nMake sure your shipping address is complete and accurate before you place your order. We cannot always reroute a package once it has left our hands. If you need to update an address, reach out as soon as possible—we will do our best while the order is still being prepared.\n\nQuestions about sizing, timing, or the best option for your event date? Message us before you checkout. We are here to help you feel confident—not just about what you buy, but about when it arrives.',
  updated_at = now()
WHERE slug = 'shipping';
