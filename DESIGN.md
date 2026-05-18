---
name: AI Character Creator
description: A dark Electron studio with a committed violet voice; atmosphere, accent, and glow are all one color.
colors:
  background: "oklch(0.11 0.02 295)"
  foreground: "oklch(0.97 0.006 295)"
  card: "oklch(0.16 0.024 295)"
  popover: "oklch(0.16 0.024 295)"
  secondary: "oklch(0.22 0.028 295)"
  muted: "oklch(0.19 0.024 295)"
  muted-foreground: "oklch(0.62 0.025 295)"
  accent-surface: "oklch(0.24 0.04 300)"
  primary: "oklch(0.72 0.25 305)"
  primary-bright: "oklch(0.8 0.28 303)"
  primary-foreground: "oklch(0.99 0 0)"
  destructive: "oklch(0.66 0.22 25)"
  border: "oklch(1 0 0 / 9%)"
  input: "oklch(1 0 0 / 11%)"
  ring: "oklch(0.78 0.27 305)"
  ambient-glow-primary: "oklch(0.72 0.25 305 / 0.18)"
  ambient-glow-deep: "oklch(0.55 0.2 280 / 0.12)"
  ambient-glow-rim: "oklch(0.82 0.16 200 / 0.05)"
typography:
  display:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.15rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.01em"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.85rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "0.45rem"
  md: "0.6rem"
  lg: "0.75rem"
  xl: "1.05rem"
  2xl: "1.35rem"
  pill: "9999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
  2xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
    typography: "{typography.label}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
    typography: "{typography.label}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
    typography: "{typography.label}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0 0.625rem"
    height: "2rem"
    typography: "{typography.label}"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "1rem"
    typography: "{typography.body}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.foreground}"
    rounded: "{rounded.lg}"
    padding: "0.25rem 0.625rem"
    height: "2rem"
    typography: "{typography.body}"
  pill:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
    height: "1.75rem"
    typography: "{typography.label}"
---

# Design System: AI Character Creator

## 1. Overview

**Creative North Star: "The Violet Hour"**

That moment late at night when the only light in the room is the screen, and the air itself takes a slight violet cast. Everything sits in that wash, and the things you touch hum back. The system is not restrained: it lets the brand color carry atmosphere, surfaces, accents, and signals as one continuous voice. Where the old direction kept violet rare and the room candle-lit, this one turns the room itself violet and lets the work glow inside it.

Tonally: the page sits on a deeper, more chromatic dark (low-lightness violet-tinted neutral, hue ~295). The body background carries an ambient wash of Studio Violet that's much stronger than before, plus a deep blue undertow and a faint cool rim near the horizon, so the room reads as inhabited light. Studio Violet itself is brighter and more saturated, with a partner token (Bright Violet) reserved for moments that should feel alive. Glow stops being a focus-only privilege and becomes the system's signature device: ambient on the page, rim-lit on cards, halo'd on primary controls, intensified on the thing you're acting on. Elevation is still tonal layering plus a 1px ring; the ring now subtly tints toward primary so surfaces feel rim-lit rather than ink-cut.

The system explicitly rejects the visual vocabulary of consumer AI chat apps and character.ai clones, even now that violet is the dominant voice: no neon hearts, no kawaii icon sets, no anime gradients, no gacha-rarity card grids, no sparkle confetti on button press, no "AI magic" gradient overlays sold as features. The neon here is architectural ambient light, not iconography. The room is glowing; the controls are glowing; nothing is decorated to look "magical."

**Key Characteristics:**
- Dark violet-tinted neutrals on hue 295 with a high-chroma Studio Violet that carries the brand voice (color strategy: **Committed**, ~40-50% of any given surface participates in the violet wash)
- Atmospheric ambient glow on every page: three layered radial gradients (primary wash, deep undertow, cool rim)
- Tonal layering + violet-tinted rings for elevation; no drop shadows on chrome
- Expanded glow vocabulary (xs, sm, md, lg, ring, rim) used as the system's signature device
- Pure system sans-serif type, scale-and-weight hierarchy; type stays quiet so color and glow can be loud
- Ease-out-expo motion (`cubic-bezier(0.16, 1, 0.3, 1)`) for entrances; glow does not strobe or pulse decoratively

## 2. Colors

A deep violet-leaning dark palette where the brand hue is the room's atmosphere AND the system's accent. The strategy is **Committed**: Studio Violet is allowed to carry 30-60% of the visible surface across washes, accents, glows, and rim-lit edges.

### Primary
- **Studio Violet** (`oklch(0.72 0.25 305)`): the system's dominant chromatic voice. Carries primary CTAs, focus rings, ambient page wash, glow halos, link color, active states, the ring tint on elevated surfaces, the focus marker on inputs. This is no longer a rare-and-precious accent: it is the room's light.
- **Bright Violet** (`oklch(0.8 0.28 303)`): a higher-lightness, higher-chroma sibling reserved for moments that need to feel **alive**. Use cases: the focus ring on the primary CTA, the active step in the stepper, the "you just generated this" moment on a newly arrived character card, the rim of a focused dialog, hover-elevated buttons. Never use Bright Violet for ambient atmosphere; it is a signal hue.

### Deep Undertow (atmospheric secondary)
- **Deep Violet-Blue** (`oklch(0.55 0.2 280 / 0.12)`): only ever used as a low-alpha radial gradient stop on the body background, paired with the ambient Studio Violet wash. Adds depth to the room without becoming a second brand color anywhere in the UI. **It does not appear on any component.**

### Cool Rim (atmospheric tertiary)
- **Cool Cyan-Violet** (`oklch(0.82 0.16 200 / 0.05)`): an even fainter atmospheric gradient stop at the page's bottom-right horizon to add the suggestion of a second light source. Same restriction: gradients only, never on components.

### Neutral
- **Deep Night** (`oklch(0.11 0.02 295)`): page background. Darker and more chromatic than before; the violet is in the substrate, not added on top.
- **Desk Surface** (`oklch(0.16 0.024 295)`): card and popover background. One step up; carries a 1px ring with a faint violet tint to feel rim-lit, not ink-cut.
- **Lifted Surface** (`oklch(0.22 0.028 295)`): secondary buttons, accent surfaces. The "second layer up" surface.
- **Muted Surface** (`oklch(0.19 0.024 295)`): pill chips, disabled fills, agent-tool callouts. A hair below Lifted on the same hue.
- **Ink** (`oklch(0.97 0.006 295)`): primary text and headings. Soft white tinted toward the family hue.
- **Half-Ink** (`oklch(0.62 0.025 295)`): muted text, helper copy, secondary labels, placeholder text.
- **Wire** (`oklch(1 0 0 / 9%)` border / `oklch(1 0 0 / 11%)` input): all hairlines. Pure white at low alpha so they tint with whatever surface they sit on.

### Status
- **Alarm Red** (`oklch(0.66 0.22 25)`): destructive actions and error states only. Never decorative. The only saturated hue in the system besides Studio Violet, and only in destructive contexts.

### Named Rules

**The Violet Hour Rule.** Studio Violet is the system's continuous voice, not a rare accent. It is allowed to carry 30-60% of any given screen across atmosphere (background wash), structure (rim-lit surface rings), accent (primary CTAs, links, active state), and signal (focus rings, glow halos). The dosage check is no longer "did I use too much" but "did I use it without intent." If the violet is decorative (a gradient just to look cool, a halo on something the user isn't acting on), remove it. If it earns its place as atmosphere or signal, leave it.

**The Bright-Violet-Is-Signal Rule.** Bright Violet (`oklch(0.8 0.28 303)`) is reserved for moments of intentful focus or alive-ness: the primary CTA's focus halo, the active stepper pill, the just-arrived character card, the rim of a focused dialog. Never use Bright Violet for ambient atmosphere or for components at rest. Studio Violet is the room; Bright Violet is the spark inside it.

**The Tinted-Neutral Rule.** Every neutral is shifted toward hue 295 with chroma 0.02-0.028. Pure grayscale is forbidden (it breaks the violet family). Pure `#fff` and `#000` are forbidden by the project's OKLCH doctrine.

**The Architectural Glow Rule.** The neon in this system is architectural: it is room light, surface rim light, and focus halo, never iconography. No glowing hearts, no glowing kawaii faces, no glowing sparkle particles, no animated halo pulses, no Blade-Runner CRT scanlines. The glow is the work's environment; it is never decoration applied on top of it.

## 3. Typography

**Display / Body / Label Font:** the system-sans stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`).
**Mono Font:** the system-mono stack (`ui-monospace, SFMono-Regular, Menlo, monospace`).

**Character:** typography stays deliberately quiet, because the color and glow are now loud. A custom display face or a serif would push the system toward cyberpunk-game UI cliché (one of our anti-references); we want the violet room to feel inhabited by humans doing real authoring work, not by a video-game HUD. The OS sans gives the chrome a calm voice that lets the atmosphere do its job.

### Hierarchy
- **Display** (weight 600, ~1.5rem, line-height 1.15, tracking -0.01em): top-of-page titles, character name on detail, page-level greetings. One per surface.
- **Headline** (weight 600, ~1.15rem, line-height 1.25, tracking -0.005em): section headers in long-form review, modal titles, named regions.
- **Title** (weight 500, ~1rem, line-height 1.4): card titles, dialog headers, the active step label in the stepper.
- **Body** (weight 400, ~0.875rem, line-height 1.55): all running prose, chat messages, profile review text. Cap measure at 65-75ch in long-form review surfaces; the chat dock is naturally narrower and self-constrains.
- **Label** (weight 500, ~0.75rem, tracking +0.01em): button labels, pill text, status chips, form labels, sub-header pills.
- **Mono** (weight 400, ~0.85rem): inline `code` and `pre` blocks inside markdown, tool-call argument previews, file paths in error states.

### Named Rules

**The Quiet-Type-Loud-Light Rule.** Color and glow carry the brand voice; typography stays unobtrusive. Do not introduce a display serif, a script for emphasis, or a separate UI font for buttons. Do not letterspace headings beyond -0.01em. Type is the structure that holds the violet light; the light is the personality.

**The 65ch Rule.** Any block of running prose longer than three lines is capped at 65-75ch. This applies to the profile review surfaces, the long-form sections inside CharacterDetail, and any future documentation pages. Streaming chat is exempt because the dock width already constrains it.

## 4. Elevation

This system has **no drop shadows on chrome.** Elevation is carried by three devices, ordered from quietest to loudest:

1. **Tonal layering.** Surfaces step up in lightness on the same hue: Deep Night (0.11) → Desk Surface (0.16) → Lifted Surface (0.22). Two visible layers above the page is the maximum.
2. **Violet-tinted rim rings.** Every elevated surface carries a 1px ring at `oklch(1 0 0 / 10%)` (still white at low alpha so it doesn't fight the violet substrate). On hover or focus, the ring shifts to a violet-tinted variant (`oklch(0.78 0.27 305 / 0.25)`) so the surface reads as rim-lit by the room's light. This is the new default, replacing the previous "neutral ring only" pattern.
3. **The glow vocabulary.** Significantly expanded. Glow is now the system's signature device, not a focus-only privilege.

### Glow Vocabulary (expanded)

The system has six named glow utilities, each with a specific role:

- **glow-xs** (`box-shadow: 0 0 12px oklch(0.72 0.25 305 / 0.1)`): the quietest. Input focus accompaniment, hover on quiet buttons. Visible only if you're looking for it.
- **glow-sm** (`box-shadow: 0 0 20px oklch(0.72 0.25 305 / 0.22)`): hover on primary CTA, the active scenario card, the message currently being streamed by the agent.
- **glow-md** (`box-shadow: 0 0 40px oklch(0.72 0.25 305 / 0.28)`): focused dialog, the just-generated character card on first appearance.
- **glow-lg** (`box-shadow: 0 0 64px oklch(0.8 0.28 303 / 0.35)`): the hero CTA at rest. The "press me" button on Create. Uses Bright Violet because this is an alive state.
- **glow-ring** (`box-shadow: 0 0 0 1px oklch(0.72 0.25 305 / 0.4), 0 0 24px oklch(0.72 0.25 305 / 0.2)`): selected state on pills and stepper steps. Replaces the focus ring entirely on these elements. Stronger ring component than before.
- **glow-rim** (`box-shadow: 0 0 0 1px oklch(0.78 0.27 305 / 0.25), 0 0 16px oklch(0.72 0.25 305 / 0.08)`): the new default for elevated card hover. A subtle violet rim around the surface, hinting that the room's light is touching its edge.

### Named Rules

**The No-Drop-Shadow Rule.** Chrome surfaces still do not use `box-shadow` for grey-tone depth. They use Desk Surface + 1px ring + (on state) glow. A black drop shadow under a card would immediately read as Material-3 or Bootstrap-era SaaS and would break the violet atmosphere.

**The Glow-Is-the-Voice Rule.** Glow has been promoted from focus-only signal to the system's signature device. It carries atmosphere on the page, rim-light on elevated surfaces, halos on primary controls, and intensified halos on the thing the user is acting on. Use the glow vocabulary generously but never decoratively: if the glow is on something the user isn't acting on, about to act on, or that isn't load-bearing structure, remove it.

**The Two-Layer Rule.** Page → Desk Surface → Lifted Surface is the maximum depth. Nesting a card inside a card inside a card is always wrong; flatten with internal spacing.

**The No-Pulse Rule.** Glow does not strobe, pulse, breathe, or animate on its own. It eases on hover (200-300ms ease-out-expo) and fades on state change. Animated pulsing glow reads as cyberpunk game HUD and breaks the inhabited-room atmosphere.

## 5. Components

### Buttons
- **Shape:** rounded-lg (0.6rem), 32px tall default. Icon variants square at the same heights.
- **Primary:** Studio Violet fill, white-ish primary-foreground text, label typography. Carries `glow-sm` permanently (it's a load-bearing CTA and the room's light is touching it). On hover the glow boosts to `glow-md` and the fill brightens 5% via Bright Violet overlay at low alpha. On `:active` translates 1px down. Focus-visible adds `glow-ring` plus a Bright Violet border at the ring color.
- **Hero CTA** (signature, new): the primary button on Create's "Generate character" surface uses `glow-lg` instead of `glow-sm` at rest. It is the moment in the flow where the user spends the most attention and where the system's voice should be loudest. There is exactly one Hero CTA per flow.
- **Secondary:** Lifted Surface fill, Ink text, no border at rest. Hover dims fill `/80` and gains a faint `glow-xs`.
- **Ghost:** transparent at rest, Muted Surface on hover. No glow. Used inside chrome where a fill or glow would compete.
- **Outline:** transparent fill, Wire border, Ink text. Hover gains `glow-xs` plus a violet-tinted border.
- **Destructive:** destructive at 10% alpha fill, destructive text, no glow ever. Destructive actions stay quiet; the urgency is carried by the text color, not by atmosphere.
- **Link:** Studio Violet text, underlined on hover with 4px offset. Permanently inherits a slight glow context from the page atmosphere; no additional treatment.

### Pills (signature)
- **Style:** fully rounded, Lifted Surface fill, Half-Ink text at the label scale. 28px tall, 10px horizontal padding.
- **At rest:** no glow. Just the neutral fill.
- **Hover:** text shifts to Ink, plus `glow-xs`.
- **Active:** carries `glow-ring` (uses Bright Violet because active is an alive state).
- **Where:** sub-header chrome (`AutopilotPill`, `DifficultyPill`, `ImageModelPill`, `MessageLengthPill`). Pills express state; buttons trigger action.

### Cards / Containers
- **Corner Style:** rounded-xl (1.05rem).
- **Background:** Desk Surface.
- **Default rim:** 1px ring at `oklch(1 0 0 / 10%)` (neutral white-alpha; tints toward the substrate violet automatically).
- **Hover rim:** ring shifts to violet-tinted (`oklch(0.78 0.27 305 / 0.25)`) and gains `glow-rim`. The surface reads as rim-lit by the room's light.
- **Active / focused** (for clickable cards): `glow-rim` upgrades to `glow-sm` and the ring intensifies.
- **Internal Padding:** 1rem vertical, 1rem horizontal. Size="sm" variant collapses to 0.75rem.

### Inputs / Fields
- **Style:** transparent background, Wire border, rounded-lg, 32px tall.
- **Focus:** border shifts to Bright Violet AND adds `glow-xs`. The input now glows back when you reach it; this is the system's most personality-rich micro-moment.
- **Error / Disabled:** error uses destructive ring at 20% alpha (no glow); disabled drops to 50% opacity with input/50 fill.

### Dialogs
- **Surface:** Desk Surface with the same 1px ring as cards, but the ring is violet-tinted (`oklch(0.78 0.27 305 / 0.25)`) because dialogs are inherently focused/active.
- **Resting glow:** `glow-md` permanently. The dialog hovers in the violet wash and the wash hugs it.
- **Backdrop:** Deep Night at ~50% alpha plus a violet wash (`oklch(0.72 0.25 305 / 0.08)`) so the room behind the dialog feels even more saturated.
- **Motion:** the message-in / tool-in keyframes for entrance (0.3s ease-out-expo).

### Chat Surface (signature)
- **Message bubbles:** still no bubbles. Agent and user messages share the surface and are distinguished by leading icon, alignment, and a tinted gutter, never by colored speech-bubble shapes.
- **User message gutter:** the existing `bg-muted` gets a faint inner violet rim ring on focus or selection. No fill change.
- **Agent message:** flat on the surface; the chat-markdown blockquote stripe (3px violet/40%) is the only sanctioned side-stripe in the system.
- **Streaming feedback:** the `.animate-thinking-dot` pulse and the `.animate-shimmer` overlay are the agreed vocabulary for "the agent is working." The dots use Studio Violet at 0.7 alpha (slightly brighter than before to read against the warmer atmosphere). Do not invent additional spinners.
- **Tool calls:** rendered as `.animate-tool-in` cards inside the stream using the Card vocabulary (Desk Surface + ring). Tool cards are first-class content and inherit hover rim-glow like any other card.

### Page Atmosphere (signature)
- **Body background:** the room's light is implemented as **three** stacked radial gradients on the `<body>`, fixed-attached:
  1. **Primary wash** (top, large): `radial-gradient(ellipse 90% 60% at 50% -5%, oklch(0.72 0.25 305 / 0.18), transparent 65%)`
  2. **Deep undertow** (bottom-left): `radial-gradient(ellipse 70% 50% at 0% 100%, oklch(0.55 0.2 280 / 0.12), transparent 60%)`
  3. **Cool rim** (bottom-right): `radial-gradient(ellipse 50% 40% at 100% 100%, oklch(0.82 0.16 200 / 0.05), transparent 55%)`

The combined effect: the page reads as a dim room lit by a Studio Violet source overhead with a deep violet undertow and the faintest cool reflection at the horizon. This is **not** an "AI magic" gradient; it is interior lighting, fixed in place behind everything.

### Markdown Body (signature)
The `chat-markdown` block: italic shifts text toward Half-Ink, blockquotes use a 3px **left border** in Studio Violet at 40% alpha. This is the only sanctioned left-stripe in the entire system, permitted because blockquotes are a textual primitive with a 400-year-old convention. Code and pre blocks use the Mono stack on a `white/4-6%` tinted surface.

## 6. Do's and Don'ts

### Do:
- **Do** use Studio Violet (`oklch(0.72 0.25 305)`) generously: ambient page wash, primary CTAs, focus rings, link color, active state, rim-lit card edges. The Violet Hour Rule replaces the old One Violet Rule; the dosage check is intent, not absence.
- **Do** reserve Bright Violet (`oklch(0.8 0.28 303)`) for alive moments: focus halos on the primary CTA, active stepper pills, just-arrived character cards, focused dialog rims.
- **Do** rim-light elevated surfaces: cards, dialogs, popovers carry violet-tinted rings on hover/focus so they feel touched by the room's light.
- **Do** layer surfaces tonally: Deep Night → Desk Surface → Lifted Surface.
- **Do** use the glow vocabulary as the system's signature: ambient on the page, rim on cards, halo on CTAs, intensified on the focused thing. Match the glow weight (xs/sm/md/lg/ring/rim) to the surface's role.
- **Do** reach for a pill for *state* and a button for *action*. Pills carry `glow-ring` when active.
- **Do** use the ease-out-expo curve (`cubic-bezier(0.16, 1, 0.3, 1)`) for entrances and glow transitions. Things settle into place; glow eases in.
- **Do** cap long-form prose at 65-75ch.
- **Do** honor `prefers-reduced-motion` for every animation and for glow easing.
- **Do** surface the agent's tool calls and streaming as first-class, glow-able content.

### Don't:
- **Don't** ship anything that reads as a character.ai clone, an anime chat app, or a waifu card gallery. Specifically: no glowing heart icons, no neon kawaii faces, no gacha-rarity card framings, no sparkle particles on action, no glowing emoji, no anime-pink-and-cyan rainbow gradients. The neon here is architectural ambient light; it is never iconography or decoration that reads as anime/character.ai.
- **Don't** add a second saturated brand color. The system has Studio Violet (with Bright Violet as its alive sibling) and destructive red for errors. No emerald success, no amber warning, no sky info; semantic state is conveyed by the violet vocabulary plus icons and labels.
- **Don't** use drop shadows on cards, dialogs, popovers, or dock panels. Elevation is tonal layering + ring + glow.
- **Don't** use a colored side-stripe (`border-left` >1px) on any callout, list item, alert, or card. The single exception is the blockquote inside chat-markdown.
- **Don't** use `background-clip: text` with a gradient for headings, CTAs, or hero copy. Gradient text is banned everywhere.
- **Don't** use `#000` or `#fff`. The project is OKLCH-doctrine; use Deep Night and Ink.
- **Don't** animate glow on its own. No pulsing halos, no breathing CTAs, no strobing focus rings, no CRT scanlines. Glow eases on hover/focus (200-300ms ease-out-expo) and fades on state change. Static or transitional, never decorative.
- **Don't** introduce a serif display face, a script, or a third font family. Quiet-Type-Loud-Light: type is structure, color is voice.
- **Don't** add hero-metric tiles, "activate your workspace" empty states, marketing-page hero typography, or onboarding tour overlays.
- **Don't** use an em dash in UI copy (`—` or `--`). Use commas, colons, semicolons, periods.
- **Don't** nest a card inside a card inside a card.
- **Don't** use the atmospheric gradients (primary wash, deep undertow, cool rim) anywhere except on the body. They are interior lighting, not a component pattern. Putting them on a card or section would make the design read as "AI magic gradient overlay" (an explicit anti-reference).
