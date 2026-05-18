# Product

## Register

product

## Users

A single user — the author. An indie, technically fluent maker who is comfortable with a CLI, runs the app from `bun run dev`, and uses it on a personal Mac. They sit down to author rich AI characters end-to-end (identity, personality, intimacy profile, scenarios, scene prompts) and iterate on them across sessions. They are the only customer; there is no growth funnel, no onboarding cohort, no support inbox. The app exists to make a craft workflow feel good for one person who knows exactly what they want.

## Product Purpose

A personal Electron studio that orchestrates Claude to generate and refine the many small documents that make up a fully realized AI character. The user steers the generation through a conversational agent, reviews structured drafts (light identity, scenario, personality, extras, visual prompts, scenes), and ships finished character files to their downstream tooling. Success is measured by how confidently and quickly the author can take a vague idea ("a tired detective who keeps a diary") to a complete, internally consistent character profile they actually want to use — without ever fighting the interface.

## Brand Personality

**Three words:** confident, intimate, crafted.

A private studio, not a public product. The voice is direct and a little wry — speaks to the user as a collaborator, not a customer. Comfortable with the subject matter (intimate character work) but never lurid about it. Treats the user as the expert and itself as a precise instrument. Closest spiritual references: Linear's craft and density, Arc's willingness to have a personality, a hint of editorial-fashion typography for the long-form review surfaces. The interface should feel like something the author would want to keep open on a second monitor at night.

## Anti-references

- **Character.ai / anime chat clones.** No waifu-card grids, anime gradients, neon hearts, sparkle particles, gacha-style "rarity" framings, gamified XP/streak chrome, kawaii icon sets, or pastel rainbow accents. The subject matter is intimate; the chrome must be the opposite of lurid.
- **Generic AI-product shell.** No ChatGPT-clone layout pretending to be the only surface, no "AI magic" gradient overlays sold as features, no sparkle-on-button-press confetti. The agent is a tool, not a personality cosplay.
- **Corporate SaaS dashboard.** No hero-metric cards, no "activate your workspace" empty states, no marketing-page typography inside the app, no blue-CTA energy, no Stripe/Notion clone shells.
- **Consumer onboarding theatrics.** No tooltips that explain obvious controls, no "Welcome back!" first-name banners, no progress-toward-account-completion bars. This is a single-user authoring tool; the user already knows why they opened it.

## Design Principles

1. **Author's tool, not consumer product.** Optimize every screen for the second hour of use, not the first minute. Density, keyboard reachability, and reversibility outrank tour-guide affordances. No feature exists to teach the user what the app does.
2. **Tasteful intimacy.** The work is sensitive; the chrome is restrained. Confidence comes from typography, spacing, and tone — never from suggestive imagery, color, or copy. If a control could read as lurid in a screenshot, restate it as if a stranger were looking over the shoulder.
3. **Show the work, not the magic.** Generation is the product, so surface it: streaming text, the agent's tool calls, the structured drafts as they form. Hide the messy parts only when they are genuinely noise. Never frame Claude as a black-box wizard.
4. **Every generation is reversible.** Authoring is iteration. Regenerate, refine, replay, and quick-edit are first-class affordances, not buried buttons. The user should never fear destroying a draft.
5. **One opinion per surface.** Each page commits to a single layout idea (long-form review, conversational create, gallery grid, settings list) and executes it precisely. No mode toggles that pretend the screen can be two things at once.

## Accessibility & Inclusion

Single-user personal app, so no formal WCAG target — but the dark, low-chroma theme must still pass ~4.5:1 contrast on all body and label text against `--background` and `--card`. Respect `prefers-reduced-motion` for every transition listed in `styles.css` (message-in, tool-in, thinking-dot, shimmer) and for any future motion work. Keep all primary actions reachable by keyboard, including dialogs, the chat dock, and the stepper. Avoid color-only state encoding; pair every status color with an icon or label so the app stays legible if the author ever cranks down saturation or works in bright daylight.
