# Security Policy

## Supported versions
Only the live API at [api.figueroa-sanchez.com](https://api.figueroa-sanchez.com) and the latest `main` branch receive security fixes.

## Reporting a vulnerability
Please **do not** open a public issue for security problems. Instead, email [marco@figueroa-sanchez.com](mailto:marco@figueroa-sanchez.com) with:

- A description of the vulnerability
- Steps to reproduce it
- The potential impact

## What to expect
- An acknowledgement within 72 hours.
- Updates as the report is triaged and fixed.
- Credit for the discovery once it's resolved, if you'd like it.

## Scope
**In scope:**
- All API endpoints, for example input validation bypasses, SQL injection or unauthorized data changes
- The contact endpoint, for example injection in the contact email template or abuse of the endpoint
- Resume and profile image delivery, for example path traversal or access to unintended files
- Leaks of secrets, stack traces or internal data in responses

**Out of scope:**
- The frontend (see the [`portfolio`](../portfolio) project's policy)
- Third-party services the API depends on (e.g. Brevo, hosting provider)
- Denial-of-service or high-volume testing
