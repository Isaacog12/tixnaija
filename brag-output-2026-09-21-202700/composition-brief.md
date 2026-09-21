# Hyperframes Composition Brief: TixNaija

## Objective
Create a short launch-style brag video for TixNaija.

## Output
- Composition directory: `c:\Users\User-Pc\tixnaija\brag-output-2026-09-21-202700\composition\`
- Rendered video: `c:\Users\User-Pc\tixnaija\brag-output-2026-09-21-202700\brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18 seconds

## Source Material
- Project root: `c:\Users\User-Pc\tixnaija`
- Primary files read: `src/routes/index.tsx`, `src/styles.css`, `package.json`
- Product name: TixNaija
- Tagline / strongest claim: "Buy tickets. Turn up."
- Key UI or visual moment to recreate: The glowing ember search bar and the glowing QR code bento box.
- Copy that must appear verbatim:
  - "Buy tickets."
  - "Turn up."
  - "QR tickets, zero drama."
  - "Selling out has never been this easy."

## Creative Direction
- Tone preset: cinematic
- Creative direction: Premium, dramatic trailer showcasing the sleek interface and high-end event experience.
- Interpretation: Pacing should be deliberate, visually rich with glowing transitions, emphasizing the Apple-grade typography and ember colors. Not rushed.
- Angle: Modern ticketing has arrived in Naija—no more boring platforms. It's sleek, fast, and high-quality.
- Hook: A dark screen with a slowly expanding ember orb leading into the hero text.
- Outro / punchline: The logo with "Selling out has never been this easy."
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `oklch(0.14 0.02 40)` (dark mode base)
- Text: `oklch(0.97 0.02 80)` (dark mode foreground)
- Accent: `oklch(0.66 0.22 40)` (Locked ember orange / primary)
- Display font: `Cinzel`
- Body font: `Inter`
- Visual references from the project: Glowing orbs (`bg-primary/20 blur-[120px]`), gradient-sunset text, glassmorphic cards (`bg-card/80 backdrop-blur-xl border-border/30`).

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

Scene summary:
1. The Hook — 3s — Ember orb expands, "Buy tickets. Turn up." text appears.
2. The UI Reveal — 5s — Search bar is typed into, transitioning into a glassmorphic event card.
3. The Flex — 6s — Fast cuts of "Pay with ease" and glowing "QR tickets".
4. The Outro — 4s — TixNaija logo, "Selling out has never been this easy."

## Audio
- Audio role: cinematic support
- Audio arc: Starts low and mysterious, swells as the UI is revealed, hits hard during the feature cuts, and peaks right before the logo hold.
- Music: Cinematic trailer track (from Hyperframes default assets)
- Music treatment: Swell into scene 2, hard cuts in scene 3 synced to beats, fade out after the outro.
- Music cue guidance: detect at composition via analyze_music_cues.py / hyperframes beats
- Audio-reactive treatment: subtle; the glowing orbs in the background should pulse subtly with the low-end frequencies of the track.
- Audio-coupled moments:
  - Scene 2 typing — typing SFX
  - Scene 2 button click — UI click SFX
  - Scene 3 cuts — bass hits/whooshes
- SFX selection guidance: Deep trailer hits, clean UI clicks, low rumbling whooshes.
- SFX analysis guidance: none
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core` (composition contract + `data-*` timing), `hyperframes-animation` (motion), `hyperframes-creative` (design spec, beats, audio-reactive), `hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli` (lint/check/render). /brag is its own workflow: do not enter the `hyperframes` entry-point intent interview and do not route into its generic promo / launch-video workflow. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Run `hyperframes check` before render.
