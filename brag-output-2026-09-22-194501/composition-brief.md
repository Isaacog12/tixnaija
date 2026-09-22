# Hyperframes Composition Brief: TixNaija

## Objective
Create a short launch-style brag video for TixNaija.

## Output
- Composition directory: `c:/Users/User-Pc/tixnaija/brag-output-2026-09-22-194501/composition/`
- Rendered video: `c:/Users/User-Pc/tixnaija/brag-output-2026-09-22-194501/brag.mp4`
- Format: vertical — 1080x1920
- Duration: 30 seconds

## Source Material
- Project root: `c:/Users/User-Pc/tixnaija/`
- Primary files read: `src/routes/index.tsx`, `src/styles.css`, `package.json`
- Product name: TixNaija
- Tagline / strongest claim: Buy tickets. Turn up.
- Key UI or visual moment to recreate: The search bar typing "Find the hottest events in town" and the QR ticket.
- Copy that must appear verbatim:
  - Buy tickets.
  - Turn up.
  - QR tickets, zero drama.
  - Pay with ease
  - Because turning up shouldn't be stressful.

## Creative Direction
- Tone preset: app-store
- Creative direction: clean, premium iOS-style app showcase
- Interpretation: smooth transitions, bright colors against dark background, snappy motion without chaos.
- Angle: The feeling of zero friction when buying a ticket to the hottest event in Lagos. It's clean, modern, and instantly secure with cryptographic QR tickets.
- Hook: Big text: "Buy tickets." (Hold) "Turn up." (Ember glow sweeps across the text).
- Outro / punchline: "Selling out has never been this easy." (TixNaija logo glow).
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign

## Visual Identity
- Background: oklch(0.14 0.02 40)
- Text: oklch(0.97 0.02 80)
- Accent: oklch(0.85 0.15 85)
- Display font: Cinzel, serif
- Body font: Inter, sans-serif
- Visual references from the project: The ember orange glow and glass UI cards from `styles.css`.

## Storyboard
Use the storyboard in `c:/Users/User-Pc/tixnaija/brag-output-2026-09-22-194501/brag-plan.md` as the creative contract.

Scene summary:
1. Hook — 3s — Big display text "Buy tickets." appears. Then "Turn up." fades in below with the ember orange gradient.
2. Search — 4s — The search bar from the hero section slides up. The text "Find the hottest events in town" is typed into the search bar.
3. Payment — 4s — A glass UI card with "Pay with ease" slides in, followed by logos/text for Cards, transfers, USSD.
4. QR Ticket — 4s — A digital ticket card with a large QR code scales in. Text reads "QR tickets, zero drama."
5. Outro — 3s — The TixNaija brand name appears in Cinzel font, glowing brightly. "Because turning up shouldn't be stressful."

## Audio
- Audio role: warm bed
- Audio arc: A clean, modern track supports a premium UI showcase with satisfying interaction sounds.
- Music: [to be selected by Hyperframes or use a bundled track]
- Music treatment: consistent volume, fade out at the end. Duck volume to 0.12–0.15 for voiceover.
- Music cue guidance: detect at composition via analyze_music_cues.py / hyperframes beats
- Audio-reactive treatment: subtle; background glow pulses slightly with the beat
- Audio-coupled moments:
  - Scene 2 — typing
  - Scene 3 — card sequence
  - Scene 4 — single confident pop or ping
- SFX selection guidance: moderate; swooshes for slides, pop for the QR ticket, key ticks for typing
- SFX analysis guidance: use lower high-frequency-risk sounds for repeated or polished moments
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `c:/Users/User-Pc/tixnaija/brag-output-2026-09-22-194501/composition/assets/`

## Voiceover (Explicitly Requested)
- Generate the voiceover for the script in `brag-plan.md` using `npx hyperframes tts "<path-to-script>" --voice af_heart --output c:/Users/User-Pc/tixnaija/brag-output-2026-09-22-194501/composition/assets/voiceover.wav`.
- Wire it into the composition on its own track. Music ducks to 0.12–0.15 for the duration of the voiceover.
- Adjust scene durations to match the generated audio.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`, `hyperframes-animation`, `hyperframes-creative`, `hyperframes-keyframes`, and `hyperframes-cli`.
Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer unless audio was explicitly disabled or documented as intentionally silent.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability, scene pacing, or the product story.
- Run `hyperframes check` before render — it is brag's single gate.
