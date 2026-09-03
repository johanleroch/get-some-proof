# Separate public proof from private moderation data

The hosted Public Wall and Embedded Wall read the same purpose-built Public Projection rather than querying moderation records directly. Only Published Testimonials enter that projection, and it excludes submitter email, consent evidence, audit details, tenant identifiers, and all private moderation data; this accepts an extra projection boundary to make accidental public disclosure harder and keep a future headless API from redefining publication rules.
