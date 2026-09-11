# Media inventory audit

Run from a checkout with dependencies installed and an authenticated Convex CLI:

```sh
pnpm media:audit --deployment <deployment-name>
```

Supply `MUX_TOKEN_ID` and `MUX_TOKEN_SECRET` in the process environment using your usual secret manager. Use credentials for the intended Mux environment. The command does not load secrets from project files or print them. To audit only Convex, explicitly add `--skip-mux`.

The command reads the live application table inventory, paginates Convex storage and Mux assets, and scans every application table for references, including nested values, playback URLs, upload IDs and pending Mux correlation IDs. Matching happens inside the readonly Convex query; application document contents are not exported. No backend deployment is needed. Existing automatic cleanup jobs are separate from this command.

The JSON report defaults to `output/media-audit.json` (ignored by Git), is created with owner-only permissions, and will not overwrite an existing file. Set `--output <path>` for another run. Files younger than 24 hours are protected; `--min-age-hours` can change this, with a minimum of 2 hours.

Report statuses:

- `referenced`: a reference exists, including historical records and expired jobs.
- `recent_or_unknown_age`: too recent or missing reliable age metadata.
- `orphan_candidate`: no reference found in the selected application's tables.
- `unreferenced_scope_unverified`: Mux asset without a reference; it may belong to another Convex deployment or application sharing the Mux environment.

This is a conservative audit, not a deletion manifest. It cannot prove absence of references outside the selected application. Mounted component storage, remote image hosts and other providers are not covered. Reads are paginated, not a single atomic snapshot, so concurrent updates can affect results. Revalidate each candidate and ownership before any future cleanup. The command contains no deletion mode.

Large inventories require multiple passes (200 identifiers per batch, 25 documents per query) and consume database reads. A failed page aborts without writing a complete report. The CLI's readonly query facility is required (this repository pins Convex 1.45.0).

Provider API: [Mux paginated requests](https://www.mux.com/docs/core/make-api-requests).
