# Portfolio API
Backend for [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com), Marco Figueroa's personal portfolio. It serves the site content (about, experience, projects, certifications, blog posts, testimonials), renders their Markdown bodies, stores uploaded images and PDFs, and handles the contact form and visitor testimonial submissions.

Live at [api.figueroa-sanchez.com](https://api.figueroa-sanchez.com).

## Stack
- [NestJS](https://nestjs.com) 12 on Express, TypeScript (strict, ESM)
- PostgreSQL through [Prisma](https://www.prisma.io) 7 (`@prisma/adapter-pg`), with versioned migrations
- Vitest for unit and e2e tests, oxlint and Prettier for code quality
- pnpm as package manager

The frontend lives in the sibling [`web`](../web) project (Angular 22).

## Getting started
```bash
pnpm install
cp .env.example .env  # then set the database password (see Database)
pnpm prisma migrate deploy
pnpm start:dev        # http://localhost:3000 (override with PORT)
```

## Endpoints
| Method & route | Auth | Description |
|---|---|---|
| `GET /` | — | Health check `{ status: 'ok' }` |
| `POST /contact?lang=` | — | Sends the contact form via Brevo (5 per IP per hour); messages in Spanish with `lang=es` |
| `POST /testimonials?lang=` | — | Visitor testimonial `{ name, role, email, testimonial }` → 201, stored as pending for review (3 per IP per rolling 24 hours); see [Testimonials](#testimonials) |
| `POST /auth/google` | — | Exchanges a Google ID token `{ credential }` of the authorized account for `{ accessToken, expiresIn: 3600 }` (5 attempts per IP per hour) |
| `GET /content/<collection>?lang=` | — | Lists a collection ordered by `position`, localized (see [Languages](#languages)) |
| `GET /content/<collection>/all` | Bearer | Owner list of `experiences`, `certifications`, `highlights`, `contact-info` (and `testimonials`): raw rows with the Spanish fields and `translated` |
| `POST /content/<collection>` | Bearer | Creates an item |
| `PUT /content/<collection>/:id` | Bearer | Replaces an item |
| `DELETE /content/<collection>/:id` | Bearer | Deletes an item |
| `POST /markdown/render` | Bearer | `{ markdown }` (≤ 100,000 characters) → `{ html, toc, readingMinutes }`, used by the panel preview |
| `POST /files?name=<name>` | Bearer | Uploads the raw request body (PNG, JPEG, GIF, WebP, SVG up to 5 MiB; PDF up to 10 MiB) → 201 `{ id, name, mime, size, createdAt, url }` |
| `GET /files?page=&type=image\|pdf` | Bearer | File library, 50 per page, newest first → `{ items, page, totalPages, total }` |
| `GET /files/:id` | — | Serves the file bytes (see [Files](#files)) |
| `GET /files/:id/references` | Bearer | Items whose fields contain the file URL, drafts included, plus one `resume` entry per language the file is the resume of → `[{ collection, id, title, status? }]` |
| `DELETE /files/:id` | Bearer | Deletes a file (204); 409 `File is the current resume.` while it is assigned as a resume |
| `GET /resume?lang=en\|es` | — | The current resume PDF (see [Resume](#resume)); 404 when none is assigned, 400 for another `lang` |
| `GET /resume/assignments` | Bearer | `{ en, es }`, each `{ file: { id, name, mime, size, createdAt, url }, assignedAt }` or `null` |
| `PUT /resume/assignments/:lang` | Bearer | `{ fileId }` of a PDF in the library → 200 with the full assignment |
| `DELETE /resume/assignments/:lang` | Bearer | Clears a language (204); the file stays in the library |

`<collection>` is one of `testimonials` (with review routes, see [Testimonials](#testimonials)), `highlights`, `social-links`, `technologies`, `contact-info` and `certifications`, plus `experiences` (same routes, ordered by `current` first, then `startDate` descending with undated entries last). Projects and posts have their own routes (see [Projects and posts](#projects-and-posts)). Errors always have the shape `{ error, fields? }`. CORS only allows the origins enabled in the `cors_origin` table (see [CORS origins](#cors-origins)).

- **Experience** (`ExperienceDto`): no `position`; `startDate` (`YYYY-MM`, required, stored as the 1st of the month and returned as `YYYY-MM`, or `null` for entries created before Spec 003) and an optional Markdown `body`; the list adds `bodyHtml`.
- **Certifications** (`CertificationDto`): `position`, `name`, `issuer`, `issueDate` and optional `expiryDate` as `YYYY-MM-DD` (calendar dates, returned unchanged; an expiry before the issue date is a field error on `expiryDate`), optional `credentialId`, `verificationUrl` and `fileUrl` (http(s)).

### Projects and posts
Projects and posts are drafts until published. Public routes never return drafts; the owner reads everything through `/all`. Slugs are 1–100 lowercase letters, digits and single hyphens, unique per collection (409 `This slug is already in use.` with a `slug` field error); `tag` and `page` are reserved for posts. A draft needs only its title and slug; publishing (and saving a published item) requires `description` and `image` for projects and `summary` and `body` for posts, answering 400 with one field error per empty field. The first publication date is kept when an item is unpublished and published again.

| Method & route | Auth | Description |
|---|---|---|
| `GET /content/projects?limit=` | — | Published projects (`limit` 1–50), `publishedAt` desc then `id` desc, without `body` |
| `GET /content/projects/all` | Bearer | Every project, drafts first |
| `GET /content/projects/:slug` | — | A published project with `bodyHtml`; 404 for drafts and unknown slugs |
| `GET /content/posts?page=&tag=` | — | 10 published posts per page → `{ items, page, totalPages, total, tag }`; items carry `readingMinutes` and no `body`; `tag` filters by its key ignoring case; 404 past the last page or for a tag without published posts |
| `GET /content/posts/feed` | — | The 20 most recent published posts |
| `GET /content/posts/all` | Bearer | Every post, drafts first |
| `GET /content/posts/:slug` | — | A published post with `bodyHtml`, `toc`, `readingMinutes` and `references`; 404 otherwise |
| `POST /content/{projects,posts}` · `PUT …/:id` · `DELETE …/:id` | Bearer | Create (always a draft), replace, delete |
| `POST /content/{projects,posts}/:id/publish` · `…/unpublish` | Bearer | Publish (200 item, 400 missing fields) or return to draft |

Post tags (up to 10, 1–30 letters, digits, spaces or hyphens) are trimmed and deduplicated ignoring case; `tagKeys` holds their keys (lowercase, spaces as hyphens), which the web uses in `/blog/tag/<key>`. References are up to 30 `{ title, url }` pairs.

### Languages
The site is in English and Spanish (Spec 004). Every text visitors read has an English field and an optional Spanish `<field>Es` with the same validators and limits (`""` stored as null); names, companies, issuers, technologies, tags, URLs, dates, images and files are shared. Content from before Spec 004 is English with no Spanish version.

| Collection | Spanish fields |
|---|---|
| projects | `titleEs`, `descriptionEs`, `bodyEs`, `slugEs` |
| posts | `titleEs`, `summaryEs`, `bodyEs`, `slugEs`, `references[].titleEs` |
| experiences | `periodEs`, `roleEs`, `descriptionEs`, `bodyEs` |
| certifications | `nameEs` |
| highlights | `titleEs`, `descriptionEs` |
| contact-info | `labelEs` |
| testimonials | `quoteEs`, `roleEs` |

- **`?lang=en|es`** on every public read (lists, details, `posts/feed`; anything else is English): an item is returned in Spanish only when it is *translated* (every bilingual field with an English value has a Spanish one, and every reference title a `titleEs`); otherwise every field is English. Each item carries `lang` (`"en"` or `"es"`) and never the `*Es` fields; Markdown, `toc` and `readingMinutes` come from the body shown. Tags are shared, so `?tag=` lists the same posts in both languages.
- **Owner lists** (`…/all`, Bearer) return the raw rows with the `*Es` fields and `translated`, which the panel shows as "Missing Spanish".
- **Spanish slugs:** projects and posts accept an optional `slugEs` (same format and reserved words as `slug`, allowed without `titleEs` and equal to the item's own slug). The Spanish URL slug is `slugEs ?? slug` and is unique per collection (unique index on `coalesce(slug_es, slug)`): a collision answers 409 `This slug is already in use.` on `slugEs`. `GET /content/{projects,posts}/:slug?lang=es` matches the Spanish URL slug first, then an English slug whose item has a different `slugEs` (returned so the web can redirect); public responses carry `slug` and `slugEs`.
- **Forms:** `POST /contact?lang=es` and `POST /testimonials?lang=es` answer every message in Spanish (success, honeypot, 400, malformed body, 429, 500, 502; table K-1 of the spec); without `lang` or with another value they answer in English. The owner's emails stay in English with a `Language: English|Spanish` line. A Spanish testimonial is stored as `roleEs`/`quoteEs` with empty English `role`/`quote`, which the owner must fill to approve it (400 with `fields`); an approved testimonial always keeps its English text.
- The content DTOs are mirrored in `panel/lib/collections.ts`: any change to these fields updates that registry under the same spec.

### Testimonials
Visitors submit testimonials with `POST /testimonials`; nothing they send is public until the owner approves it.

- **Submission:** `?lang=es` stores the role and text as their Spanish versions and answers in Spanish (see [Languages](#languages)). Every field is trimmed; `name` and `role` are 1–100 characters on one line with at least one letter or digit, `email` a valid address of up to 200, `testimonial` 1–500 (line breaks kept). Any invalid field or a malformed body answers 400 `Please fill in all the fields with valid values.` and stores nothing; success answers 201 `Thanks! Your testimonial will appear once it has been reviewed.` A filled `website` honeypot gets the same 201 and nothing is stored or sent. The `testimonial` rate-limit bucket allows 3 submissions per IP in a rolling 24 hours (counted before the honeypot and validation, separate from the contact form) and answers 429 `Too many submissions. Please try again later.`
- **Notification:** the owner receives an email from "Portfolio Testimonials" with the visitor as reply-to. If it cannot be sent (provider error or missing `brevo_api_key`), the testimonial is still stored, the visitor still gets 201 and the row is marked `notified: false`.
- **Review:** a submission is stored with `status: "pending"`, `position: null`, its `email`, `language` and `submittedAt`. Public reads return only approved items (`id, position, quote, author, role, avatar, createdAt, updatedAt`), never the email or review fields.

| Method & route | Auth | Description |
|---|---|---|
| `GET /content/testimonials` | — | Approved testimonials by `position`, then `id` |
| `GET /content/testimonials/all` | Bearer | Pending items first (newest submission first), then approved ones by `position`, with `status`, `email`, `language`, `notified` and `submittedAt` |
| `GET /content/testimonials/pending-count` | Bearer | `{ count }` of pending items |
| `POST /content/testimonials` | Bearer | Owner create `{ quote, author, role, avatar? }` (no `position`): public at once and placed first |
| `PUT /content/testimonials/:id` | Bearer | Edit (`position?` too); never changes `status` or `email`, so a pending item stays pending |
| `POST /content/testimonials/:id/approve` | Bearer | Stores the form values, deletes the email and places the item first (200); an approved item is returned unchanged; 400 field errors, 404 missing |
| `DELETE /content/testimonials/:id` | Bearer | Delete; for a pending item this is the rejection (204, 404 missing) |

Placing an item first shifts every approved item down one position in the same transaction, so the owner's relative order is kept. `quote` is limited to 500 characters on every write (older, longer quotes are kept until edited); `avatar` is optional (an http(s) URL of up to 500 characters, `""` stored as null).

### Markdown
Bodies (projects, experience, posts) are Markdown rendered only by the API (`markdown-it` with raw HTML disabled, plus `highlight.js`): tables, task lists, strikethrough, highlighted code, `mermaid` fences as escaped source inside `figure.md-mermaid` (drawn by the web and panel), external links in a new tab, lazy images, unique `id`s on h2/h3 for the table of contents, and a reading time of words outside code / 200, at least 1 minute. JSON bodies may be up to 512 KiB on the content routes that carry Markdown and on `/markdown/render`, 16 KiB elsewhere.

### Emails
The owner's emails go through Brevo from the `mail` module (`src/app/mail`): `MailService` reads `brevo_api_key` on every send and `BrevoClient` posts the email from `contact@figueroa-sanchez.com` with a display name per form (`Portfolio Contact`) to the owner, with the visitor as reply-to. Every email uses one HTML layout (`mail/templates/email-layout.ts`) with the web's dark palette, `color-scheme: only dark` metadata and an explicit background on every cell so Apple Mail does not invert it, text contrast of at least 4.5:1 (checked by its spec), no remote images, a `Language:` line and a footer linking to the site, plus a plain-text part with the same content.

### Files
Uploads are stored in the `file` table (`bytea`), not on disk or an external service. The type is detected from the content (magic bytes), never from the name or `Content-Type`. File URLs are absolute, built from `API_PUBLIC_URL` (default `https://api.figueroa-sanchez.com`; set it in `.env` for local runs, e.g. `http://localhost:3000`) and never change. `GET /files/:id` is public and answers with the exact type, `X-Content-Type-Options: nosniff`, a `Content-Security-Policy` ending in `sandbox` (so scripts in an uploaded SVG never run when its URL is opened), `Cache-Control: public, max-age=31536000, immutable` and `Cross-Origin-Resource-Policy: cross-origin`.

### Resume
The resume is an ordinary PDF of the file library (uploaded with `POST /files`); the `resume` table only records which file is current for English and for Spanish (Spec 005). `GET /resume` is its stable public URL: it never changes when the PDF is replaced, so the web can link to it once.

- **Languages:** English is the base. `GET /resume` without `lang` serves English, and `?lang=es` falls back to English when no Spanish resume is assigned; English never falls back to Spanish. Any other `lang` (including an empty or repeated one) answers 400 with a `lang` field error, unlike the content reads.
- **Assigning:** `PUT /resume/assignments/:lang` replaces the language's current file; the previous one stays in the library. Assigning the current file again changes nothing (`assignedAt` is kept). Errors: 404 for a file not in the library, 400 on `fileId` for a malformed id or a file whose detected type is not PDF, 400 on `lang` for anything but `en`/`es`, 409 `Assign an English resume first.` for Spanish without English.
- **Clearing:** `DELETE /resume/assignments/:lang` answers 204, also when the language had no resume; clearing English while a Spanish resume is assigned answers 409 `Clear the Spanish resume first.`
- **Caching:** `GET /resume` sends the same protective headers as `GET /files/:id` (`nosniff`, the sandboxing CSP, `Cross-Origin-Resource-Policy: cross-origin`) with `Cache-Control: no-cache` instead of `immutable`, plus an `ETag`: caches revalidate on every request, so a replacement is served at once and an unchanged PDF costs a 304.
- **File library:** a file that is a current resume cannot be deleted (409, also enforced by the `ON DELETE RESTRICT` foreign key) and its references list `{ collection: 'resume', id: 'en' | 'es', title }`. It is still served at its own immutable `/files/:id` URL.

## Database
The only setting that lives in the environment is `DATABASE_URL` (plus `PORT` and, for local runs, the non-secret `API_PUBLIC_URL`). Application secrets live in the `property` table (see [Properties](#properties)).

### Local database
Create the role and the database once (the role needs `CREATEDB` for Prisma's shadow database):
```sql
CREATE ROLE "api-portfolio" LOGIN CREATEDB PASSWORD '<password>';
CREATE DATABASE api_portfolio OWNER "api-portfolio";
```
Then copy `.env.example` to `.env` (gitignored) and set the password. `main.ts` and `prisma.config.ts` load `.env` only when the file exists.

### Docker and Kubernetes
`.env` is excluded from the image (`.dockerignore`), so the variable is passed at run time:
```bash
docker run --env-file .env -p 3000:3000 <image>
docker run -e DATABASE_URL='postgresql://...' -p 3000:3000 <image>
```
In Kubernetes, store the URL in a `Secret` and map it to the container's environment:
```yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: api-portfolio
        key: database-url
```

### Migrations
- `pnpm prisma migrate dev --name <change>`: creates and applies a new migration locally after editing `prisma/schema.prisma`.
- `pnpm prisma migrate deploy`: applies pending migrations. Nothing runs it automatically, so run it against production **before** releasing an API version that brings a migration.
- `pnpm generate`: regenerates the Prisma client in `src/generated/prisma` (gitignored). `lint`, `test`, `test:e2e` and `build` run it first.

### Initial content
`prisma/sql/initial-content.sql` inserts the site content that used to be hardcoded in the web. It is not a migration: load it once into a freshly migrated database (keep a copy as a backup). `psql` does not accept Prisma's `?schema=` parameter, so strip the query string:
```bash
psql "${DATABASE_URL%%\?*}" -v ON_ERROR_STOP=1 -f prisma/sql/initial-content.sql
```

### Release order for DevSecOps (version 6.2.0)
No migration. The owner prepares the repository around the merge:
1. Install the `portfolio-version-bump` GitHub App (the one web uses) on this repository, add `BUMP_APP_ID` as an Actions variable and `BUMP_APP_PRIVATE_KEY` as an Actions secret, and create the labels `dependencies`, `npm`, `github-actions` and `docker`.
2. When the PR is opened, disable CodeQL default setup (`gh api -X PATCH repos/mfigueroa23/api-portfolio/code-scanning/default-setup -f state=not-configured`), since advanced-setup uploads are rejected while it is on.
3. Once `CodeQL`, `SCA` and `API Tests` pass on the PR, add the required checks `Lockfile Scan`, `Analyze (actions)` and `Analyze (javascript-typescript)` and the CodeQL code scanning rule (security alerts `high_or_higher`) to the `Production ruleset`, and enable it. It also requires signed commits and pull requests on `main`.
4. Merge to `main`. The release scans the image before publishing it; if the new steps fail, revert the merge and the previous `release.yaml` publishes as before.
5. Run "Check for updates" for each ecosystem in the dependency graph and check that every Dependabot PR receives its version bump.

### Release order for resume management (version 6.1.0)
1. Run `pnpm prisma migrate deploy` against production **before** merging. The `resume` migration only creates the `resume` table (primary key `lang` with a CHECK for `en`/`es`, and a `file_id` foreign key to `file` with `ON DELETE RESTRICT`); it touches no existing rows and the current version ignores it.
2. Merge to `main`, which releases the API. `GET /resume` answers 404 until a resume is assigned.
3. Assign the resumes with a PDF already in the library: `PUT /resume/assignments/en`, then `/es` (before the panel and web versions that use them).

### Release order for the Spanish version (version 6.0.0)
1. Run `pnpm prisma migrate deploy` against production **before** merging. `bilingual_content` adds the nullable `*_es` columns (existing content stays English), the unique `coalesce(slug_es, slug)` indexes on `project` and `post`, makes the testimonial `quote` and `role` nullable and adds a CHECK that approved testimonials keep them.
2. Merge to `main`, which releases the API (before panel 5.0.0 and web 4.0.0).

### Release order for testimonial review (version 5.0.0)
1. Run `pnpm prisma migrate deploy` against production **before** merging. `testimonial_review` adds the review columns (`status` defaults to `approved`, so every existing testimonial stays public), makes `position` and `avatar` nullable and adds the `language` CHECK constraint. Before releasing, list the quotes the 500-character limit affects with `SELECT id, length(quote) FROM testimonial WHERE length(quote) > 500;` (they are kept until edited).
2. Merge to `main`, which releases the API (before panel 4.0.0 and web 3.1.0).

### Release order for content pages (version 4.0.0)
1. Run `pnpm prisma migrate deploy` against production. `content_pages` publishes every existing project, sets publication dates that keep the old `position` order and proposes slugs from the titles; `drop_content_position` removes `position` from projects and experience.
2. Merge to `main`, which releases the API (before the web and panel versions that use the new endpoints).
3. Review the generated project slugs in the panel and set every experience start date (entries without one are listed last).

## Administrator
The only administrator is the owner, who signs in with Google through the panel (Spec 002); there is no password login. The panel sends the Google ID token to `POST /auth/google`, and the API verifies it with Google against `google_client_id`, requires a verified email equal to `admin_google_email` (trimmed, case-insensitive) and returns its own token. Send it as `Authorization: Bearer <accessToken>`; it expires after one hour.

| Response | When |
|---|---|
| 200 `{ accessToken, expiresIn: 3600 }` | The authorized account signed in |
| 400 `Validation failed.` | `credential` is missing, empty or longer than 4096 characters |
| 401 `Invalid Google sign-in.` | Google does not verify the token (bad signature, expired, issued for another client) |
| 403 `This Google account is not authorized.` | Another account, or an unverified email |
| 429 `Too many attempts. Please try again later.` | 5 attempts from the same IP in the last hour |
| 500 `Sign-in is not available.` | `google_client_id` or `admin_google_email` is missing |

To change the authorized account, update `admin_google_email` with SQL (see [Properties](#properties)); tokens already issued stay valid until they expire.

### Release order for the Google sign-in (version 3.0.0)
1. Insert the `google_client_id` and `admin_google_email` properties and the panel's `cors_origin` row in production (SQL below and in [CORS origins](#cors-origins)). Without the properties, sign-in answers 500 and there is no password fallback.
2. Run `pnpm prisma migrate deploy` against production; the `drop_admin_user` migration drops the old `admin_user` table.
3. Merge to `main`, which releases the API.

## Properties
The `property` table holds the application secrets. They are read on every request, so an update applies without a restart, and no endpoint ever reads or returns them.

| Key | Used for |
|---|---|
| `brevo_api_key` | Sending the owner's emails through Brevo. Missing → `POST /contact` answers 500; `POST /testimonials` still stores the testimonial, marked `notified: false`. |
| `jwt_secret` | Signing and verifying the admin tokens. Missing → sign-in and writes answer 500. Changing it invalidates every issued token. |
| `google_client_id` | OAuth web client ID of the panel, the audience every Google ID token must be issued for. Not secret. Missing → `POST /auth/google` answers 500. |
| `admin_google_email` | Google email of the only authorized administrator. Missing → `POST /auth/google` answers 500. |

Generate a JWT secret with `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64'))"` and insert or update the values with SQL:
```sql
INSERT INTO property (key, value) VALUES ('brevo_api_key', '<brevo key>'), ('jwt_secret', '<secret>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```
The Google sign-in needs two more rows:
```sql
INSERT INTO property (key, value) VALUES
  ('google_client_id', '<client id>.apps.googleusercontent.com'),
  ('admin_google_email', '<owner Google email>')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
```

## CORS origins
The `cors_origin` table lists the origins allowed to call the API from a browser. It is read on every request, so a change applies without a restart, and no endpoint reads or changes it. The migration inserts `https://marco.figueroa-sanchez.com` as enabled. Origins that are missing or disabled get no CORS headers (the browser rejects the response); requests without an `Origin` header, such as `curl` or the web prerender, are served normally.

```sql
-- List the origins
SELECT origin, enabled FROM cors_origin ORDER BY origin;
-- Allow the management panel (production)
INSERT INTO cors_origin (origin, enabled) VALUES ('https://panel.figueroa-sanchez.com', true)
ON CONFLICT (origin) DO UPDATE SET enabled = true, updated_at = now();
-- Allow the local web (only in the local database)
INSERT INTO cors_origin (origin, enabled) VALUES ('http://localhost:4200', true)
ON CONFLICT (origin) DO UPDATE SET enabled = true, updated_at = now();
-- Switch an origin off without deleting it
UPDATE cors_origin SET enabled = false, updated_at = now() WHERE origin = 'http://localhost:4200';
```

## Scripts
| Command | Description |
|---|---|
| `pnpm start:dev` | Run in watch mode |
| `pnpm build` | Generate the Prisma client and compile to `dist/` |
| `pnpm generate` | Generate the Prisma client |
| `pnpm start:prod` | Run the compiled build |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | End-to-end tests |
| `pnpm test:cov` | Unit tests with coverage |
| `pnpm lint` | Lint with oxlint (type-aware) |
| `pnpm format` | Format with Prettier |
| `pnpm run approve-builds` | Approve or deny the build scripts of a new dependency (recorded in `allowBuilds` of `pnpm-workspace.yaml`) |
| `node --test scripts/` | Tests of the CI scripts in `scripts/` |

## CI/CD
- **API Tests** (`.github/workflows/test.yaml`): lint, format check, unit, e2e and script tests, and build on every push and on pull requests to `main`. An install fails on a dependency build script that is not approved in `pnpm-workspace.yaml`.
- **CodeQL** (`.github/workflows/codeql.yaml`): `security-extended` analysis of `actions` and `javascript-typescript` on pull requests, on pushes to `main` and daily. A new high or critical alert blocks the PR through the `main` ruleset.
- **SCA** (`.github/workflows/sca.yaml`): Grype scan of `pnpm-lock.yaml` on pull requests and daily. A critical or high finding with a fixed version fails the `Lockfile Scan` check; the rest are reported in the job summary and in the Security tab.
- **API Release** (`.github/workflows/release.yaml`): on push to `main`, verifies the code and builds a multi-platform Docker image (`linux/amd64`, `linux/arm64`) into a registry local to the job. Both platforms are scanned with the same rule as the lockfile, and only then is the image copied to Docker Hub (`latest`, the version and `sha-<commit>`, with the scanned digest) and rolled out to Kubernetes by digest. A blocking finding stops the release before anything is published. Each release keeps an SPDX SBOM per platform as the `portfolio-api-<version>-sbom` artifact.
- **Dependabot** (`.github/dependabot.yml`): weekly npm, GitHub Actions and Docker base-image updates, minor and patch grouped per ecosystem and majors apart, plus immediate security updates for npm and Actions. Nothing merges on its own.
- **Dependabot Version Bump** (`.github/workflows/dependabot-bump.yaml`): adds one signed `chore(release): Bump version to vX.Y.Z` commit (`main`'s version plus one patch) to every Dependabot PR, and updates it when `main`'s version changes.

Findings that cannot be fixed yet are excepted in `.github/sca-exceptions.json`, one entry per advisory: `{ "id": "GHSA-…", "reason": "…", "expires": "YYYY-MM-DD" }`. An expired entry no longer covers its finding, and an incomplete one fails the check.

## Contributing
Read [`AGENTS.md`](AGENTS.md) and [`docs/constitution.md`](docs/constitution.md) first. New features start from a spec in `docs/specs/NNN-*/spec.md`, and commits follow [Conventional Commits](https://www.conventionalcommits.org).

## Security
See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Contact
- **Email:** [marco@figueroa-sanchez.com](mailto:marco@figueroa-sanchez.com)
- **Website:** [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com)
- **LinkedIn:** [mfigueroa23](https://www.linkedin.com/in/mfigueroa23)

## License
[MIT](LICENSE) © 2026 Marco Antonio Figueroa Sanchez
