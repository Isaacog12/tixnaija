# Hyperframes Composition Brief: TixNaija

## Objective
Create a short launch-style brag video for TixNaija.

## Output
- Composition directory: `brag-output-2026-09-21-205533/composition/`
- Rendered video: `brag-output-2026-09-21-205533/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 18 seconds

## Source Material
- Project root: `c:\Users\User-Pc\tixnaija`
- Primary files read: `src/routes/index.tsx`, `src/styles.css`
- Product name: TixNaija
- Tagline / strongest claim: "QR tickets, zero drama."
- Key UI or visual moment to recreate: The event search bar and the cascading "Coming up next" event cards.
- Copy that must appear verbatim:
  - Buy tickets.
  - Turn up.
  - QR tickets, zero drama.

## Creative Direction
- Tone preset: polished
- Creative direction: slick, high-energy Nigerian event ticketing app
- Interpretation: Transitions will be smooth (slides and soft crossfades), motion will use Apple-grade spring easing, and text will have tight tracking and high legibility.
- Angle: The creative premise is a high-energy, polished Nigerian event launch. We're showcasing how ridiculously easy it is to find an event and get your unique QR ticket. The claim: "QR tickets, zero drama."
- Hook: A bold, warm ivory screen with the Ember Orange glow. The words "Buy tickets." slam in, followed by "Turn up." in the gradient sunset text.
- Outro / punchline: The "QR tickets, zero drama." line alongside a glowing QR code icon.
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: `oklch(0.98 0.008 80)`
- Text: `oklch(0.14 0.02 40)`
- Accent: `oklch(0.66 0.22 40)` (Ember Orange)
- Display font: Cinzel
- Body font: Inter
- Visual references from the project: The sunset gradient (`linear-gradient(135deg, oklch(0.75 0.18 50) 0%, oklch(0.66 0.22 40) 50%, oklch(0.5 0.24 15) 100%)`), floating glass cards with blur.

## Storyboard
Use the storyboard in `brag-plan.md` as the creative contract.

Scene summary:
1. The Hook — 4s — "Buy tickets. Turn up." text drop.
2. Search — 4s — Typing "Concerts in Lagos" and clicking search.
3. Event Cards — 6s — Three event cards slide in sequentially.
4. QR Tickets — 4s — Glowing QR code icon and "QR tickets, zero drama." text.

## Audio
- Audio role: warm bed / professional accents
- Audio arc: Starts energetic with the hook, uses UI sounds to emphasize the search and card reveals, and ends with a satisfying success note.
- Music: `upbeat_corporate.mp3` (or equivalent bundled track)
- Music treatment: Start at 0s, fade out at end.
- Music cue guidance: detect at composition via `hyperframes beats`
- Audio-reactive treatment: subtle; use RMS energy to make the background ember glow pulse.
- Audio-coupled moments:
  - The Hook — beat reveal of text lines
  - Search — typing sounds, UI click
  - Event Cards — sequential card slides
  - QR Tickets — solid UI lock/success chime
- SFX selection guidance: use clean, snappy UI elements; click for typing, soft whoosh for cards.
- SFX analysis guidance: use lower high-frequency-risk sounds for repeated or polished moments
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output-2026-09-21-205533/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills... (since Hyperframes skills might not be available directly, build a standard HTML/CSS/JS Hyperframes-compatible composition using `npx hyperframes init` if possible).

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet.
- Run `hyperframes check` before render.
