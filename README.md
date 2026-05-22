# AI Character Creator

> **Disclaimer.** This project is purely a personal **test and side project**. I built it to experiment with integrating [Claude](https://claude.com) into a small Electron app — nothing more. It is not a product, not a service, and not maintained for anyone but me.
>
> **Not responsible for your Claude subscription.** The app shells out to the locally installed `claude` CLI and consumes whatever Claude plan or API access you have configured on your own machine. **I take no responsibility for any usage, charges, rate limits, or terms-of-service issues tied to your Claude account.** You are the only person responsible for your subscription and how this tool uses it.

An Electron desktop app for creating AI characters end-to-end (identity, personality, intimacy profile, mood axes, scenarios, scene image prompts) using Claude as the generation engine.

## Installing from a Release

### macOS — "AI Character Creator is damaged and can't be opened"

This **does not mean the file is damaged**. The app is built without a paid
Apple Developer certificate, so macOS Gatekeeper flags it on first launch
after downloading from the internet. The wording is misleading; the actual
issue is "unsigned by an identified developer + quarantined".

After downloading the `.dmg` from the Releases page, run **once** in Terminal:

```sh
xattr -cr ~/Downloads/AI-Character-Creator-*.dmg
```

Then open the `.dmg`, drag the app to `/Applications`, and launch it. If you
ever see the same message again on the installed app, strip the attribute
from the installed `.app` too:

```sh
xattr -cr "/Applications/AI Character Creator.app"
```

This is a one-time operation per download — macOS won't re-quarantine the
file afterwards. If you'd rather not run a shell command, the only
alternative is for the project to pay for Apple Developer ID + notarization
($99/year), which isn't planned for this side project.

### Windows

Windows SmartScreen may also flag the unsigned `.exe` on first launch.
Click **More info → Run anyway**.

### Linux

Make the AppImage executable, then run it:

```sh
chmod +x AI-Character-Creator-*-Linux-x64.AppImage
./AI-Character-Creator-*-Linux-x64.AppImage
```

## Running the project from source — a step-by-step for non-developers

You don't need to know how to code to run this app from source. You do need to follow a handful of one-time setup steps in **Terminal** (on macOS, find it under `Applications → Utilities → Terminal`, or press `⌘ + Space` and type `Terminal`). On Windows, use **PowerShell** (press `⊞ Win`, type `PowerShell`).

When the steps below ask you to "run a command", that means: copy the line that starts with `$` (without the `$` itself), paste it into Terminal, and press `Enter`.

---

### Step 1 — Install Claude Code

Claude Code is the official CLI from Anthropic. This app talks to Claude through it.

**macOS / Linux:**

```sh
$ curl -fsSL https://claude.ai/install.sh | bash
```

**Windows (PowerShell, run as Administrator the first time):**

```powershell
$ irm https://claude.ai/install.ps1 | iex
```

Verify it worked by running:

```sh
$ claude --version
```

If you see a version number, you're good. If you see "command not found", close and reopen Terminal and try again — the installer sometimes needs a fresh shell to pick up the new PATH.

Official install docs (in case the link above moves): <https://docs.claude.com/en/docs/claude-code/setup>

---

### Step 2 — Log in to Claude

The app does NOT log you in for you. **You must already be logged in to Claude through the CLI before the app can do anything.** This is what the disclaimer at the top means by "consumes whatever Claude plan or API access you have configured on your own machine" — the app uses YOUR Claude account.

Run:

```sh
$ claude
```

The first time, it opens your browser and asks you to sign in to your Claude account. Follow the prompts. Once you're back at the Terminal prompt and Claude is running, you can type `/exit` or press `Ctrl + C` to quit — the login is saved.

You only do this once. After that, the app and the CLI both use the saved login.

> ⚠️ **You need an active Claude plan** (Pro, Max, Team, or an Anthropic API key with credits) for the app to work. Generation costs are billed against YOUR account — see the disclaimer at the top of this README.

---

### Step 3 — Install Bun

Bun is the runtime and package manager this project uses (instead of Node.js + npm). It's a single binary, fast to install.

**macOS / Linux:**

```sh
$ curl -fsSL https://bun.sh/install | bash
```

**Windows (PowerShell):**

```powershell
$ powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify it worked:

```sh
$ bun --version
```

If you see a version number, you're good. If "command not found", close and reopen Terminal.

Official install docs: <https://bun.sh/docs/installation>

---

### Step 4 — Download this project

Two ways. If you don't know git, use the ZIP option.

**Option A — ZIP download (easiest):**

1. Go to <https://github.com/woopser-1/ai-character-creator-electron> in your browser.
2. Click the green **Code** button → **Download ZIP**.
3. Unzip the file. You'll get a folder called `ai-character-creator-electron-main` (or similar).
4. In Terminal, navigate into that folder. The easy way: type `cd ` (with a trailing space), then DRAG the folder from Finder/Explorer onto the Terminal window — the path appears automatically. Press `Enter`.

**Option B — git clone (if you have git):**

```sh
$ git clone https://github.com/woopser-1/ai-character-creator-electron.git
$ cd ai-character-creator-electron
```

---

### Step 5 — Install the project's dependencies and start the app

From inside the project folder, run:

```sh
$ bun install
```

This downloads everything the app needs (a few minutes the first time).

Then start the app:

```sh
$ bun run dev
```

A desktop window should open within 10-30 seconds. That's it — the app is running.

To stop the app, close the window, or go back to Terminal and press `Ctrl + C`.

Next time you want to use the app, just `cd` into the project folder again and run `bun run dev` — steps 1-4 are one-time setup.

---

## Requirements (summary)

- **An active Claude account** with a Pro/Max/Team plan or an Anthropic API key with credits (the app uses your subscription)
- [**Claude Code CLI**](https://docs.claude.com/en/docs/claude-code/setup) installed and logged in
- [**Bun**](https://bun.sh) installed
- macOS, Linux, or Windows (the build script targets macOS first; the dev workflow runs on all three)

## Other useful commands (optional)

These are extras for people who want to dig deeper. You don't need them to use the app.

```sh
bun run dev:quiet   # dev mode without debug logging
bun run build       # production build (no window)
bun run start       # preview the built app
bun run check       # lint the code
bun run fix         # auto-fix lint issues
bun run dist:mac    # package a macOS arm64 .app/.dmg installer
```

### About the Claude binary

The app spawns `claude` from your `PATH` (the list of locations your shell searches for commands). If your `claude` binary lives somewhere unusual, point the app at it explicitly:

```sh
CLAUDE_BIN=/full/path/to/claude bun run dev
```

You can find the full path to your `claude` binary with:

```sh
$ which claude       # macOS / Linux
$ Get-Command claude # Windows PowerShell
```

## Usage, modifications & contributions

You are obviously free to **clone the repo, build the app, and use it** for your own purposes. I also authorize **any modification of the code** and **any sharing or redistribution** — feel free to fork, tweak, ship, mix it into something else.

That said, this is a side project I work on for myself, so:

- I likely **won't review or respond to issues**.
- I likely **won't merge pull requests**.
- No support, no roadmap, no guarantees.

If you want to take it somewhere, fork it and run with it.

## License

Do whatever you want with the code. No warranty, no liability — use at your own risk.
