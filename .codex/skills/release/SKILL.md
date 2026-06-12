---
name: release
description: Run the AI Character Creator Electron release workflow. Use when the user asks to release, bump a version, create a release tag, build installers, publish a local Electron release, or invokes /release with patch, minor, or major.
---

# AI Character Creator Release

Use this skill for release requests in this repository. Prefer the project slash command at `.codex/commands/release.md` as the source of truth.

## Workflow

1. Read `.codex/commands/release.md`.
2. Apply the requested SemVer bump: `patch`, `minor`, or `major`. Default to `patch`.
3. Follow the command steps exactly: preflight, plan, commit pending work if needed, bump `package.json`, push, tag, build, reinstall locally when on macOS, verify, then summarize.
4. Stop on the first failure and report the completed steps, failed command, repo state, and smallest safe recovery step.

## Repository-Specific Defaults

- Package manager: Bun.
- Release scripts: `bun run dist:mac`, `bun run dist:linux`, `bun run dist:win`.
- App name: `AI Character Creator`.
- macOS install target: `/Applications/AI Character Creator.app`.
- Build output: `release/`.
- Git remote: `origin`.
- Normal branch: `main`.

## Guardrails

- Stage explicit files only.
- Do not commit generated artifacts under `release/`.
- Do not commit secrets or environment files.
- Do not force-push, amend commits, skip hooks, or overwrite tags.
- Do not add Claude attribution to release commits.
