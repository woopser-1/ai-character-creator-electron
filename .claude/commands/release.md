---
description: Commit pending work, bump version, push, tag, build, and reinstall locally
argument-hint: "[patch|minor|major]  (default: patch)"
allowed-tools: Bash, Read, Edit, Write
---

# Release pipeline

Run the **full release flow** for this Electron app end-to-end. The single argument controls the SemVer bump kind:

- `$ARGUMENTS` — `patch` | `minor` | `major`. If empty, default to **`patch`**.

You must execute every step in order. If a step fails, STOP and report — do not silently work around failures.

---

## Step 1 — Inspect the working tree

Run these in parallel:
- `git status --porcelain`
- `git diff --stat`
- `git log --oneline -5`
- `grep -E '^  "version"' package.json` (or read line 4 of `package.json`)
- `git remote -v` and `git rev-parse --abbrev-ref HEAD`

From the output, determine:
- **Pending changes**: any non–`package.json` files modified, added, deleted, or untracked-but-relevant.
- **Current version**: the existing `"version"` value in `package.json`.
- **Current branch**: should normally be `main`. If it's not, ASK the user before proceeding.

If the tree is completely clean AND the last commit is already a `chore(release): bump version to …`, ABORT with "Nothing to release — last commit is already a release bump."

---

## Step 2 — Commit pending work (skip if there is none)

If Step 1 found pending non–`package.json` changes:

1. Run `git diff` (and `git diff --cached` if anything is already staged) to understand the changes.
2. Draft a **Conventional Commit** message (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, …) — focus on the *why*, 1–3 lines body.
3. Stage **only the relevant files explicitly** by name. NEVER `git add -A` or `git add .`.
4. Commit using a HEREDOC so the body formats correctly, ending with:

   ```
   Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
   ```

If a pre-commit hook fails: fix the issue, re-stage, create a **NEW** commit. Do NOT `--amend`. Do NOT pass `--no-verify`.

If there are no pending non–`package.json` changes, skip this step and proceed to Step 3 — bumping the version alone is still a valid release.

---

## Step 3 — Bump the version in `package.json`

Compute the next SemVer from the current version and the arg (default `patch`):

| Bump   | x.y.z transformation |
| ------ | -------------------- |
| patch  | `x.y.(z+1)`          |
| minor  | `x.(y+1).0`          |
| major  | `(x+1).0.0`          |

Use `Edit` to change the `"version": "<old>"` line in `package.json` to `"version": "<new>"`. Read the file first (the harness requires it).

Remember the `<new>` value — it's used for the commit message and the tag.

---

## Step 4 — Commit the bump

```
git add package.json
git commit -m "$(cat <<'EOF'
chore(release): bump version to <new>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Step 5 — Push the branch

```
git push origin <current-branch>
```

(For `main`, that's `git push origin main`.)

---

## Step 6 — Tag and push the tag

```
git tag v<new>
git push origin v<new>
```

If the tag already exists, ABORT and tell the user — never force-overwrite an existing tag.

---

## Step 7 — Local build

Detect the OS with `uname -sm` and pick the matching script:

| OS                 | Command              |
| ------------------ | -------------------- |
| Darwin             | `bun run dist:mac`   |
| Linux              | `bun run dist:linux` |
| MINGW/MSYS/CYGWIN  | `bun run dist:win`   |

Run it with a **600000 ms (10 min) timeout** because Electron + electron-builder is slow.

After it finishes, list the produced artifacts:

```
ls -lh release/ | grep -E "<new>"
```

---

## Step 8 — Reinstall locally (macOS only)

If `uname -s` is `Darwin`:

1. Quit any running instance:
   ```
   osascript -e 'tell application "AI Character Creator" to quit' 2>/dev/null
   pkill -f "AI Character Creator" 2>/dev/null
   sleep 1
   ```

2. Pick the right build directory based on `uname -m`:
   - `arm64` → `release/mac-arm64/AI Character Creator.app`
   - `x86_64` → `release/mac/AI Character Creator.app`

3. Replace the installed app and clear quarantine:
   ```
   rm -rf "/Applications/AI Character Creator.app"
   cp -R "<source-app-path>" "/Applications/"
   xattr -dr com.apple.quarantine "/Applications/AI Character Creator.app"
   ```

4. Verify the installed version matches `<new>`:
   ```
   /usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "/Applications/AI Character Creator.app/Contents/Info.plist"
   ```

   If the printed version doesn't equal `<new>`, FAIL loudly — something went wrong.

If `uname -s` is **not** Darwin: skip the reinstall and just print the DMG/installer paths under `release/` so the user can install them manually.

---

## Step 9 — Final recap

Print a compact summary table covering:

- Previous version → New version
- Commit SHAs (work commit if any, release-bump commit)
- Tag pushed
- Artifact paths under `release/`
- Installed version confirmation (Darwin only)

---

## Safety rules — non-negotiable

- NEVER skip hooks (`--no-verify`, `--no-gpg-sign`).
- NEVER force-push (`--force`, `--force-with-lease`) to `main`.
- NEVER `git add -A` / `git add .` / `git add --all` — stage explicit paths.
- NEVER `git commit --amend` — always create new commits.
- NEVER overwrite an existing tag.
- NEVER commit `.env`, credentials, or anything matching `*.key`, `*.pem`, `credentials*`, `secrets*` — warn instead.
- If anything fails mid-pipeline, STOP and report what succeeded, what failed, and what state the repo is in.
