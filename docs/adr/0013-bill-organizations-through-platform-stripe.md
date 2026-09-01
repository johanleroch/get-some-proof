# Bill Organizations through one Platform Stripe Account

The deployed SaaS uses one Platform Stripe Account owned by its operating company, and each Organization buys its own fixed-price subscription from that account. Organization-owned Stripe Connect accounts are deliberately excluded: the starter is selling its Premium Plan to Organizations, not processing payments on their behalf, so billing remains Organization-scoped while Stripe credentials remain deployment-wide and server-only.
