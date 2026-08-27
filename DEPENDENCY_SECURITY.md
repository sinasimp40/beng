# Dependency security status

Last reviewed: 2026-08-27

## Current status

- Production dependency audit: no known vulnerabilities.
- Full dependency audit: no critical, high, or low findings.
- The full audit retains one moderate development-tool advisory, reported as four linked package entries in `npm audit`.

## Deferred advisory

`drizzle-kit@0.31.10` still depends on `@esbuild-kit/esm-loader`, which pins an old `esbuild` through `@esbuild-kit/core-utils`. The advisory applies to an esbuild development server accepting cross-origin requests; this project does not run that transitive esbuild copy in production.

The automated fix proposes downgrading Drizzle Kit to `0.18.1`. That release predates the current Drizzle configuration and migration workflow and is not a safe compatibility change. The latest stable Drizzle Kit release still carries the deprecated loader chain, and overriding its internal esbuild across incompatible `0.x` versions could break schema tooling. Keep Drizzle Kit current and remove this exception when upstream replaces `@esbuild-kit/esm-loader`.

## Upgrade decisions

- Drizzle ORM was upgraded to the first patched release for identifier escaping. `drizzle-zod` remains on the Zod 3-compatible adapter because the newer adapter emits Zod 4 schema types.
- Nodemailer was upgraded to the patched major release; the app uses the stable SMTP transport, verification, and `sendMail` APIs.
- Vite was upgraded to the latest secure 7.x release instead of 8.x. Vite 7 removes the affected dependency chain while remaining compatible with the existing React, Tailwind, and Replit plugins.
- Patched transitive versions are pinned with npm overrides only where the current direct parent has no newer compatible release.