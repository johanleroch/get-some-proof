# Split application and video ownership across Convex, Vercel, and Mux

**Delivery amendment:** ADR 0040 records the accepted Cloudflare runtime/media allocation. The paragraph below describes the earlier boundary; its Next.js embed hosting and Mux thumbnail delivery allocation are superseded for the migration. Convex product authority and Mux video processing/playback remain.

The single Next.js application and versioned embed runtime run on Vercel, Convex owns persistence, authorization, transactional product rules, and backend workflows, and Mux owns video ingest, processing, playback renditions, thumbnails, and media deletion. A Video Asset has a lifecycle separate from Testimonial moderation, so provider callbacks can change media availability without making private proof public; this provider boundary accepts Mux lock-in for video while keeping publication and entitlement policy in the application domain.
