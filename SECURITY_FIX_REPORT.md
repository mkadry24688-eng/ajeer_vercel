# Scoped security fixes — 2026-09-29

## Scope and evidence

No audit document was present in the workspace. This work addresses confirmed source findings in the three requested categories: exposed backups, unsafe static files, and XSS. No database operations, authentication changes, dependency installation, or production restart were performed.

The working tree already contained edits to database, login, configuration, and contract files. Those edits were preserved. SHA-256 comparisons against the beginning of this work confirmed that SQL, authentication/login, environment/configuration generation, Supabase configuration, and storage implementation files remained unchanged by this task.

## Changes

- `server.js` now serves only paths enumerated in `public-files.json`. Backups, environment files, Git metadata, SQL, server/build source, reports, and tests return 404. Existing public pages, assets, and extensionless routes are retained. Malformed encodings, null bytes, backslashes, and decoded traversal segments return 400. Symlinks are rejected and responses use `X-Content-Type-Options: nosniff`.
- `.gitignore` excludes backup suffixes and editor backup files. Existing local backups were retained for recovery; the static allowlist blocks access without deleting their contents.
- `.vercelignore` limits deployment uploads to the current public file list and Vercel configuration. Future public assets must be added to both lists. Vercel deployment behavior was not exercised.
- Dashboard and both verification renderers escape untrusted text, including invalid date values returned by date formatters. Dashboard IDs are encoded in links, and block/delete buttons use function callbacks instead of interpolating IDs into executable inline handlers. Backup/import result text is escaped.
- Contract barcode labels escape data. QR images and links are constructed with DOM methods, and link protocols are restricted to HTTP(S).
- Scanner status messages escape text before HTML insertion.

## Validation

`node tests/security.test.js`: six tests passed. Tests invoke the actual static request handler with local streams, checking six public routes/assets, eleven private paths, and four malformed/traversal paths. XSS checks cover escaping in all five modified browser scripts and hostile values in both verification renderers, including their error messages. No live database or authentication calls were made.

`git diff --check` passed. These are source-level regression checks, not a full browser or production deployment test.

## Remaining limits and rollout

Changes are local and require deployment or restart of the Node service to protect a running instance. An external web server serving the repository directly must use an equivalent public-file restriction; Node rules cannot protect files served by another process. Existing deployed copies and caches were not changed.

Authentication rendering and authentication policy were deliberately left untouched, including the dynamic HTML in `shared/js/auth.js`; this report does not claim all application XSS is eliminated. Database permissions, schema, credentials, and authentication findings remain outside scope. If secrets were previously downloaded from exposed backups, blocking future downloads does not revoke them; credential rotation requires separate work.
