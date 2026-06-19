# Agent Instructions

This repository contains two independent Next.js hackathon templates. Read the root README.md and hackathon-projects.json before making changes.

## Repository boundaries

- pdp-growth-kit and competitor-x-ray are independent applications.
- Run npm commands inside the affected project directory.
- Do not introduce runtime imports across project directories.
- Preserve the shared Team One × ACA visual identity.

## Secrets

- Never read, print, copy, commit, upload, or expose .env.local or another .env file.
- Only .env.example may be tracked, and it must contain placeholders.
- Never add real OpenAI or Tavily keys to source, fixtures, tests, logs, screenshots, exports, or documentation.
- API calls that require secrets must remain server-side.
- Before committing, inspect staged files and scan for likely sk- and tvly- credentials.
- If a credential is found in Git history, stop. Revoke and rotate it before rewriting history or pushing.

## Required verification

For the changed project, run:

~~~bash
npm run typecheck
npm run lint
npm test
npm run build
~~~

Run npm run test:e2e for user-facing flows. Playwright may require npx playwright install chromium.

## Environment

Use .env.example as the contract. Local values belong in .env.local.

- Both projects require OPENAI_API_KEY.
- OPENAI_MODEL defaults to gpt-5.4-mini.
- pdp-growth-kit supports OPENAI_IMAGE_MODEL, default gpt-image-2.
- competitor-x-ray optionally supports TAVILY_API_KEY.

Do not assume optional keys are present. Competitor X-Ray must retain its local extraction fallback when Tavily is unavailable.

## Safety constraints

- Keep SSRF protection, redirect validation, response-size limits, timeouts, and content-type validation intact.
- Do not bypass login walls, CAPTCHAs, robots, or bot protection.
- Do not claim actual conversion, revenue, or competitor performance from visible PDP evidence.
- Do not persist screenshot binaries, generated image data, raw HTML, or secrets in localStorage.
- Public deployment requires authentication, rate limiting, and spend controls.

## Documentation

When environment variables, commands, ports, prerequisites, or provider behavior change, update:

1. root README.md
2. project README.md
3. project .env.example
4. root hackathon-projects.json
