# AI Character Creator

> **Disclaimer.** This project is purely a personal **test and side project**. I built it to experiment with integrating [Claude](https://claude.com) into a small Electron app — nothing more. It is not a product, not a service, and not maintained for anyone but me.
>
> **Not responsible for your Claude subscription.** The app shells out to the locally installed `claude` CLI and consumes whatever Claude plan or API access you have configured on your own machine. **I take no responsibility for any usage, charges, rate limits, or terms-of-service issues tied to your Claude account.** You are the only person responsible for your subscription and how this tool uses it.

An Electron desktop app for creating AI characters end-to-end (identity, personality, intimacy profile, mood axes, scenarios, scene image prompts) using Claude as the generation engine.

## Requirements

- [**Bun**](https://bun.sh) — used as the package manager and runtime
- [**Claude Code CLI**](https://claude.com/claude-code) installed and authenticated on your system (the app shells out to the `claude` binary)
- macOS (the build script targets `--mac --arm64`; the dev workflow should work on Linux/Windows but isn't tested)

## Running the project with Bun

```sh
# Install dependencies
bun install

# Start the app in dev mode (Electron + Vite, with HMR)
bun run dev
```

Other useful scripts:

```sh
bun run dev:quiet   # dev mode without DEBUG_CLAUDE logging
bun run build       # production build
bun run start       # preview the built app
bun run check       # lint with Ultracite
bun run fix         # auto-fix lint issues
bun run dist:mac    # package a macOS arm64 .app/.dmg
```

### About the Claude binary

The main process spawns `claude` from your `PATH`. If your binary lives elsewhere, set:

```sh
CLAUDE_BIN=/full/path/to/claude bun run dev
```

You must already be logged in to Claude through the CLI (`claude` once, follow the auth flow) — the app does not handle authentication itself.

## Usage, modifications & contributions

You are obviously free to **clone the repo, build the app, and use it** for your own purposes. I also authorize **any modification of the code** and **any sharing or redistribution** — feel free to fork, tweak, ship, mix it into something else.

That said, this is a side project I work on for myself, so:

- I likely **won't review or respond to issues**.
- I likely **won't merge pull requests**.
- No support, no roadmap, no guarantees.

If you want to take it somewhere, fork it and run with it.

## License

Do whatever you want with the code. No warranty, no liability — use at your own risk.
