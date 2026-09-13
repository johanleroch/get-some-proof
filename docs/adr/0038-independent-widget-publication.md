# Publish independent Widgets from current public proof

**Delivery amendment:** ADR 0040 replaces visitor-time hydration with complete public publications in KV and removes the 60-second open-page clearing behavior. Private draft/configuration ownership, stable IDs, selections and templates below remain. The implementation notes describe the pre-migration state.

Studio Widgets keep their own bounded selection, order, appearance and draft/published configuration. Publishing replaces the configuration atomically, while stable public identifiers survive rename and template changes. The older Proof Block specification vocabulary maps to Widget in the product.

A published snapshot stores references, never copied testimonial content. Every public read resolves the current Public Projection, visibility and account eligibility through the existing protected server boundary. Withdrawal, archival, revision and deletion therefore remove proof from new widget responses without traversing every Widget. Workspace deletion removes Widget records through its existing bounded cleanup workflow.

The default Public Wall and Embedded Wall retain their shared Curated Order (ADR 0032). Independent Widgets deliberately extend that model rather than changing those destinations. Preview and embed share the iframe-free renderer and runtime; customer typography inherits by default. Highlights display only existing marked phrases, separated with ellipses, and preserve the full original Testimonial in the Inbox.

This implementation does not activate the separate Cloudflare cache rollout (#67/#70). Widget responses are no-store and use both global lookup and per-project admission. Open embeds expire after 60 seconds and require an explicit reload, keeping ADR 0026’s existing bound without an automatic polling loop. The five-minute CDN proposal remains a future operational change and is not advertised as implemented.
