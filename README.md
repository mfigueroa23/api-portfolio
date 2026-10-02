# Portfolio API
Backend for [marco.figueroa-sanchez.com](https://marco.figueroa-sanchez.com), Marco Figueroa's personal portfolio. It serves the site content (about, experience, projects, testimonials), the resume and the profile image, and handles the contact form.

Live at [api.figueroa-sanchez.com](https://api.figueroa-sanchez.com).

## Stack
- [NestJS](https://nestjs.com) 12 on Express, TypeScript (strict, ESM)
- PostgreSQL
- Vitest for unit and e2e tests, oxlint and Prettier for code quality
- pnpm as package manager

The frontend lives in the sibling [`web`](../web) project (Angular 22).

## Getting started
```bash
pnpm install
pnpm start:dev        # http://localhost:3000 (override with PORT)
```

## Scripts
| Command | Description |
|---|---|
| `pnpm start:dev` | Run in watch mode |
| `pnpm build` | Compile to `dist/` |
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
