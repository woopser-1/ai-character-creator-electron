---
description: Commit pending work, bump version, push, tag, build, and reinstall AI Character Creator locally
argument-hint: "[patch|minor|major] (default: patch)"
---

# Release Pipeline

Run the full release flow for this Electron app end to end. The single argument controls the SemVer bump kind:

- `$ARGUMENTS`: `patch`, `minor`, or `major`
- Default: `patch`

Execute every step in order. If a step fails, stop and report what succeeded, what failed, and the current repo state.

## Preflight

Run these checks first, preferably in parallel:

```bash
git status --porcelain
git diff --stat
git log --oneline -5
rg '^  "version"' package.json
git remote -v
git rev-parse --abbrev-ref HEAD
```

Determine:

- Pending changes: any modified, added, deleted, or relevant untracked files outside the release bump.
- Current version: the existing `version` value in `package.json`.
- Current branch: normally `main`.

If the current branch is not `main`, ask the user before proceeding.

If the working tree is clean and the last commit is already `chore(release): bump version to ...`, abort with:

```text
Nothing to release: last commit is already a release bump.
```

Reject invalid bump arguments. Only `patch`, `minor`, and `major` are valid.

## Plan

Before making changes, state the release plan:

- Previous version and planned new version.
- Branch and remote to push.
- Whether a work commit is needed before the version bump.
- Build command selected for the current OS.
- Whether local reinstall will run.

Ask before proceeding if:

- The branch is not `main`.
- Pending changes include files that look unrelated to the intended release.
- Pending changes include secrets, `.env`, credentials, `*.key`, `*.pem`, `credentials*`, or `secrets*`.
- A tag named `v<new>` already exists locally or remotely.

## Commands

### Commit Pending Work

Skip this section if there are no pending non-`package.json` changes.

If pending work exists:

1. Read `git diff` and `git diff --cached` if anything is staged.
2. Draft a Conventional Commit message such as `feat:`, `fix:`, `chore:`, `refactor:`, or `docs:`.
3. Stage only the relevant paths explicitly by name.
4. Create a normal commit.

Do not use `git add -A`, `git add .`, or `git add --all`.

Do not add Claude attribution. If the user explicitly asks for assistant attribution, use:

```text
Co-authored-by: Codex <codex@openai.com>
```

If a hook fails, fix the issue, stage the affected paths explicitly, and create a new commit. Do not amend and do not skip hooks.

### Bump Version

Compute the next SemVer from the current version and the bump argument:

| Bump | Transformation |
| --- | --- |
| `patch` | `x.y.(z+1)` |
| `minor` | `x.(y+1).0` |
| `major` | `(x+1).0.0` |

Edit only the `version` field in `package.json`.

Commit the bump:

```bash
git add package.json
git commit -m "chore(release): bump version to <new>"
```

Capture the release-bump commit SHA:

```bash
git rev-parse --short HEAD
```

### Push Branch

Push the current branch:

```bash
git push origin <current-branch>
```

### Tag Release

Before creating the tag, verify it does not exist locally or remotely:

```bash
git tag --list "v<new>"
git ls-remote --tags origin "refs/tags/v<new>"
```

If either command finds an existing tag, stop and report it.

Create and push the tag:

```bash
git tag "v<new>"
git push origin "v<new>"
```

### Local Build

Detect the OS:

```bash
uname -sm
```

Choose the matching build command:

| OS | Command |
| --- | --- |
| Darwin | `bun run dist:mac` |
| Linux | `bun run dist:linux` |
| MINGW, MSYS, or CYGWIN | `bun run dist:win` |

Run the build with a 10 minute timeout.

After the build, list artifacts for the new version:

```bash
ls -lh release/ | rg "<new>"
```

### Reinstall Locally

Only run this section on macOS.

Quit any running app instance:

```bash
osascript -e 'tell application "AI Character Creator" to quit' 2>/dev/null
pkill -f "AI Character Creator" 2>/dev/null
sleep 1
```

Pick the build directory:

| Architecture | Source app |
| --- | --- |
| `arm64` | `release/mac-arm64/AI Character Creator.app` |
| `x86_64` | `release/mac/AI Character Creator.app` |

Replace the installed app and clear quarantine:

```bash
rm -rf "/Applications/AI Character Creator.app"
cp -R "<source-app-path>" "/Applications/"
xattr -dr com.apple.quarantine "/Applications/AI Character Creator.app"
```

Verify the installed version:

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "/Applications/AI Character Creator.app/Contents/Info.plist"
```

If the printed version does not equal `<new>`, stop and report the mismatch.

On non-macOS systems, skip reinstall and print the installer paths under `release/`.

## Verification

Verify after the operations:

```bash
git status --porcelain
git log --oneline -3
git tag --list "v<new>"
git ls-remote --tags origin "refs/tags/v<new>"
ls -lh release/ | rg "<new>"
```

On macOS, also verify:

```bash
/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "/Applications/AI Character Creator.app/Contents/Info.plist"
```

## Summary

Return a compact release recap:

```text
Release Result
- Version: <old> -> <new>
- Work commit: <sha or skipped>
- Release commit: <sha>
- Tag: v<new>
- Branch pushed: origin/<branch>
- Artifacts: <paths>
- Installed version: <version or skipped>
```

If anything failed, include:

```text
Failure
- Completed: <steps>
- Failed: <step and command>
- Repo state: <branch, status, tag state>
- Next action: <smallest safe recovery step>
```

## Next Steps

After a successful release:

- If GitHub Releases are automated from tags, confirm the release appears on GitHub.
- If artifacts are local only, upload the new installer files from `release/`.
- If the installed app was updated, launch it once and confirm the main window opens.

## Safety Rules

- Never skip hooks with `--no-verify` or `--no-gpg-sign`.
- Never force-push to `main`.
- Never use `git add -A`, `git add .`, or `git add --all`.
- Never use `git commit --amend`.
- Never overwrite an existing tag.
- Never commit `.env`, credentials, files matching `*.key` or `*.pem`, `credentials*`, or `secrets*`.
- Never commit generated release artifacts from `release/`.
