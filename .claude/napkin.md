# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-27] Keep Next.js security patches current**
   Do instead: run a production-only npm audit before publishing and prefer compatible Next.js patch upgrades; do not use a major downgrade suggested by npm audit.
2. **[2026-07-27] Validate both deployment targets**
   Do instead: run the domain tests, lint, Vinext build/render checks, and native Next.js build before publishing to Sites and Vercel.
3. **[2026-07-27] Preserve the existing dual-build architecture**
   Do instead: keep `vinext build` for Sites and `next build` for Vercel; verify both whenever client-only dependencies change.

## Domain Behavior Guardrails
1. **[2026-07-27] Keep receipt processing ephemeral and on-device**
   Do instead: process receipt images in the browser, retain no server copy, and clear derived data when the user deletes the account.
2. **[2026-07-27] Treat OCR output as untrusted input**
   Do instead: parse conservatively and require users to review names, quantities, and prices before assigning consumption.
3. **[2026-07-27] Preserve proportional tip allocation**
   Do instead: calculate each attendee's tip from their consumption subtotal and reconcile rounding without changing the final paid total.

## Source Control & Publishing
1. **[2026-07-27] Continue work on the active feature branch**
   Do instead: stage only scoped files, commit tersely, push over SSH, and update the existing draft pull request.
2. **[2026-07-27] Reuse the existing Sites project**
   Do instead: read `.openai/hosting.json`, push the exact validated source state, save a version, and deploy it privately.

## Shell & Command Reliability
1. **[2026-07-27] Avoid the user npm cache**
   Do instead: set `npm_config_cache=/private/tmp/la-justa-npm-cache` for installs and audits because the default cache contains permission-conflicted entries.
