# Portfolio API
Backend for [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com), Marco Figueroa's personal portfolio. It serves the site content (about, experience, projects, certifications, blog posts, testimonials), renders their Markdown bodies, stores uploaded images and PDFs, and handles the contact form.

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
| `POST /contact` | — | Sends the contact form via Brevo (5 per IP per hour) |
| `POST /auth/google` | — | Exchanges a Google ID token `{ credential }` of the authorized account for `{ accessToken, expiresIn: 3600 }` (5 attempts per IP per hour) |
| `GET /content/<collection>` | — | Lists a collection ordered by `position` |
| `POST /content/<collection>` | Bearer | Creates an item |
| `PUT /content/<collection>/:id` | Bearer | Replaces an item |
| `DELETE /content/<collection>/:id` | Bearer | Deletes an item |
| `POST /markdown/render` | Bearer | `{ markdown }` (≤ 100,000 characters) → `{ html, toc, readingMinutes }`, used by the panel preview |
| `POST /files?name=<name>` | Bearer | Uploads the raw request body (PNG, JPEG, GIF, WebP, SVG up to 5 MiB; PDF up to 10 MiB) → 201 `{ id, name, mime, size, createdAt, url }` |
| `GET /files?page=&type=image\|pdf` | Bearer | File library, 50 per page, newest first → `{ items, page, totalPages, total }` |
| `GET /files/:id` | — | Serves the file bytes (see [Files](#files)) |
| `GET /files/:id/references` | Bearer | Items whose fields contain the file URL, drafts included → `[{ collection, id, title, status? }]` |
| `DELETE /files/:id` | Bearer | Deletes a file (204) |

`<collection>` is one of `testimonials`, `highlights`, `social-links`, `technologies`, `contact-info` and `certifications`, plus `experiences` (same routes, ordered by `current` first, then `startDate` descending with undated entries last). Projects and posts have their own routes (see [Projects and posts](#projects-and-posts)). Errors always have the shape `{ error, fields? }`. CORS only allows the origins enabled in the `cors_origin` table (see [CORS origins](#cors-origins)).

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

### Markdown
Bodies (projects, experience, posts) are Markdown rendered only by the API (`markdown-it` with raw HTML disabled, plus `highlight.js`): tables, task lists, strikethrough, highlighted code, `mermaid` fences as escaped source inside `figure.md-mermaid` (drawn by the web and panel), external links in a new tab, lazy images, unique `id`s on h2/h3 for the table of contents, and a reading time of words outside code / 200, at least 1 minute. JSON bodies may be up to 512 KiB on the content routes that carry Markdown and on `/markdown/render`, 16 KiB elsewhere.

### Files
Uploads are stored in the `file` table (`bytea`), not on disk or an external service. The type is detected from the content (magic bytes), never from the name or `Content-Type`. File URLs are absolute, built from `API_PUBLIC_URL` (default `https://api.figueroa-sanchez.com`; set it in `.env` for local runs, e.g. `http://localhost:3000`) and never change. `GET /files/:id` is public and answers with the exact type, `X-Content-Type-Options: nosniff`, a `Content-Security-Policy` ending in `sandbox` (so scripts in an uploaded SVG never run when its URL is opened), `Cache-Control: public, max-age=31536000, immutable` and `Cross-Origin-Resource-Policy: cross-origin`.

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
| `brevo_api_key` | Sending the contact email through Brevo. Missing → `POST /contact` answers 500. |
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

## CI/CD
- **API Tests** (`.github/workflows/test.yaml`): lint, format check, unit and e2e tests, and build on every push and on pull requests to `main`.
- **API Release** (`.github/workflows/release.yaml`): on push to `main`, verifies the code, builds a multi-platform Docker image (`linux/amd64`, `linux/arm64`), pushes it to Docker Hub and rolls it out to Kubernetes.

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
