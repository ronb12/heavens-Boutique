-- Richer default copy for the public About page (CMS: content_pages.slug = about)

UPDATE content_pages
SET
  title = 'About Heaven''s Boutique',
  excerpt = 'Curated women''s fashion with a warm, welcoming boutique feel—thoughtful pieces, honest service, and checkout you can trust.',
  body = E'Heaven''s Boutique is a curated destination for women who love femininity, polish, and ease. We believe getting dressed should feel joyful—not stressful—whether you are shopping for everyday staples, a special occasion, or that one piece that makes you feel instantly put together.\n\nOur edit blends timeless silhouettes with modern details: soft textures, flattering cuts, and finishes that feel luxe without fuss. Every drop is chosen with care—quality fabrics, thoughtful construction, and styling that works in real life, not only on a hanger.\n\nShopping with us is designed to feel like a boutique visit from anywhere. Browse on the web or on our iOS app, save favorites, track orders, and reach out when you need sizing help or a second opinion. Secure checkout and clear policies mean you always know what to expect.\n\nWe are building more than a catalog—we are building trust. That means responsive support, transparent shipping and returns information, and a team that genuinely wants you to love what you buy.\n\nThank you for being here. We are glad you found us—and we cannot wait to see how you make these pieces your own.',
  updated_at = now()
WHERE slug = 'about';
