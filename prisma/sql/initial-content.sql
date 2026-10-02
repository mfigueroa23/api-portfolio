-- Initial site content: the content that was hardcoded in the web sections
-- (experience, about, hero and contact), copied literally and in the same order
-- (position = index in the original array). This is not a migration and nothing
-- runs it automatically: the owner loads it once into a freshly migrated
-- database, e.g.
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/sql/initial-content.sql
BEGIN;

INSERT INTO experience (position, period, role, company, description, technologies, current) VALUES
  (0, 'Sep 2026 — Present', 'Intern — Systems & Technology, AI Solutions', 'Autofin Chile', 'Developing AI solutions with Python and FastAPI exposed through REST APIs, orchestrating agents and workflows with LangGraph to automate internal processes, and building Next.js interfaces to consume the AI services. Task management and technical documentation in Jira under Scrum.', ARRAY['Python', 'FastAPI', 'LangGraph', 'Next.js', 'Jira']::text[], true),
  (1, 'Mar 2025 — Apr 2025', 'Technical Support Agent', 'E-Cert Chile', 'Handled and resolved customer technical requests by phone following company protocols, tracking cases and escalating them to specialized teams when required.', ARRAY['Technical Support', 'Incident Management']::text[], false),
  (2, 'Jul 2023 — Oct 2024', 'TLS/SSL Operator — System Administrator', 'E-SIGN S.A.', 'Administered and maintained critical production systems, monitoring Windows, Linux and database assets to ensure service uptime. Managed TLS/SSL digital certificates and applied documented preventive and corrective improvements, working under Scrum with CI/CD and Kubernetes.', ARRAY['Linux', 'Windows Server', 'TLS/SSL', 'Kubernetes', 'CI/CD']::text[], false),
  (3, 'Dec 2021 — Apr 2023', 'Customer Service — Technical & Sales Support', 'E-SIGN S.A.', 'Provided technical and sales support to customers by phone and in person, following up on their requests.', ARRAY['Technical Support', 'Customer Service']::text[], false);

INSERT INTO highlight (position, icon, title, description) VALUES
  (0, 'fa-solid fa-code', 'Clean Code', 'Writing maintainable, scalable code that is easy to read and evolve.'),
  (1, 'fa-solid fa-server', 'Reliable Systems', 'Operating critical Linux and Windows services with a focus on uptime.'),
  (2, 'fa-solid fa-rocket', 'DevOps', 'Automating builds and deployments with CI/CD, Docker and Kubernetes.'),
  (3, 'fa-solid fa-users', 'Collaboration', 'Working with agile teams under Scrum to ship value iteratively.');

INSERT INTO social_link (position, icon, href) VALUES
  (0, 'fa-brands fa-github', 'https://github.com/mfigueroa23'),
  (1, 'fa-brands fa-linkedin', 'https://www.linkedin.com/in/mfigueroa23'),
  (2, 'fa-brands fa-x-twitter', 'https://x.com/marcoo_f23'),
  (3, 'fa-brands fa-instagram', 'https://www.instagram.com/marcoo.f23'),
  (4, 'fa-brands fa-soundcloud', 'https://soundcloud.com/devsonic');

INSERT INTO technology (position, name) VALUES
  (0, 'Angular'),
  (1, 'TypeScript'),
  (2, 'Node.js'),
  (3, 'NestJS'),
  (4, 'React'),
  (5, 'JavaScript'),
  (6, 'PostgreSQL'),
  (7, 'MySQL'),
  (8, 'Docker'),
  (9, 'Kubernetes'),
  (10, 'Linux'),
  (11, 'Bash'),
  (12, 'GitHub Actions'),
  (13, 'Git'),
  (14, 'Tailwind CSS'),
  (15, 'Nginx'),
  (16, 'Ubuntu Server'),
  (17, 'Cloudflare'),
  (18, 'Terraform'),
  (19, 'AWS'),
  (20, 'Vercel'),
  (21, 'Grafana'),
  (22, 'Python'),
  (23, 'Spring Boot'),
  (24, '.NET'),
  (25, 'SQL Server'),
  (26, 'Windows Server'),
  (27, 'n8n'),
  (28, 'GitHub'),
  (29, 'Jira'),
  (30, 'Confluence');

INSERT INTO contact_info (position, icon, label, value, href) VALUES
  (0, 'fa-solid fa-envelope', 'Email', 'marco@figueroa-sanchez.com', 'mailto:marco@figueroa-sanchez.com'),
  (1, 'fa-solid fa-location-dot', 'Location', 'Santiago, Chile', '/#contact');

-- project: no rows today.

-- testimonial: no rows today.

COMMIT;
