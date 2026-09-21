# Hyperframes Composition Brief: TixNaija

## Objective
Create a short launch-style brag video for TixNaija.

## Output
- Composition directory: `brag-output-2026-09-21-211300/composition/`
- Rendered video: `brag-output-2026-09-21-211300/brag.mp4`
- Format: landscape — 1920x1080
- Duration: 20 seconds

## Source Material
- Project root: `c:\Users\User-Pc\tixnaija`
- Primary files read: `src/routes/index.tsx`, `src/styles.css`
- Product name: TixNaija
- Tagline / strongest claim: "Buy tickets. Turn up."
- Key UI or visual moment to recreate: The glowing search bar and the three translucent bento cards ("QR tickets, zero drama", "Pay with ease", "Sell in minutes").
- Copy that must appear verbatim:
  - "Buy tickets."
  - "Turn up."
  - "Find Events"
  - "QR tickets, zero drama"
  - "Pay with ease"
  - "Sell in minutes"
  - "Selling out has never been this ridiculously easy."

## Creative Direction
- Tone preset: polished
- Creative direction: sleek, premium Nigerian event culture
- Interpretation: Smooth, deliberate pacing. Elegant typography with deep dark-mode contrast. Motion is confident but restrained, emphasizing the "zero drama" aspect.
- Angle: The absolute frictionlessness of getting into the best events in Naija. The video frames TixNaija as an elegant, premium, zero-drama gateway to turning up.
- Hook: A giant, elegant serif text "Buy tickets." fades in gracefully. Then, the text "Turn up." slides up with a sunset gradient glow, accompanied by a deep, satisfying bass drop.
- Outro / punchline: "Selling out has never been this ridiculously easy."
- Avoid:
  - Generic SaaS language
  - Abstract filler visuals
  - Unrelated visual redesign
  - Chaotic fast cuts that ruin legibility

## Visual Identity
- Background: oklch(0.14 0.02 40)
- Text: oklch(0.97 0.02 80)
- Accent: oklch(0.85 0.15 85)
- Primary: oklch(0.66 0.22 40)
- Display font: Cinzel
- Body font: Inter
- Visual references from the project: Glowing glass borders, sunset gradients (`--gradient-sunset`), deep warm dark surfaces (`oklch(0.18 0.03 40)`).

## Storyboard
Use the storyboard in `brag-output-2026-09-21-211300/brag-plan.md` as the creative contract.

Scene summary:
1. The Hook — 4s — "Buy tickets." (Hold) "Turn up." (with gradient glow).
2. The Search — 4s — Search bar UI with "Find Events" glowing button getting clicked.
3. Zero Drama Bento — 6s — Three value-prop cards sliding in sequentially on the beat.
4. The Event — 3s — High-fidelity event card with dark cover image and date badge.
5. Outro — 3s — "Selling out has never been this ridiculously easy." fading to "TixNaija" logo.

## Audio
- Audio role: cinematic support with a modern, sophisticated beat
- Audio arc: Smooth anticipation leading to a satisfying drop, steady rhythmic pulse for UI reveals, and an elegant fade-out.
- Music: (Select a polished, driving electronic track from assets if available, or fetch one).
- Music treatment: Smooth fade in, drop at ~0:04, steady rhythm, fade out smoothly at ~0:18.
- Music cue guidance: detect at composition via analyze_music_cues.py / hyperframes beats. Lock the Hook "Turn up" to the first strong cue. Snap the Bento card reveals to sequential beat grid ticks.
- Audio-reactive treatment: subtle; use music RMS/bass to make the sunset gradients on the hook text and the bento cards pulse softly.
- Audio-coupled moments:
  - The Hook — Bass drop aligned with "Turn up." glowing.
  - Zero Drama Bento — sequential card sequence snapping to the beat grid.
- SFX selection guidance: Tactical and sparse. Use premium glass-like ticks for UI actions. A clean "click" for the search button.
- SFX analysis guidance: use lower high-frequency-risk sounds for repeated or polished moments.
- Exact SFX choice: Hyperframes should choose filenames, timestamps, density, and volume based on the implemented animation.
- Audio files: copy the chosen music and any Hyperframes-selected SFX into `brag-output-2026-09-21-211300/composition/assets/`

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills. Prefer native Hyperframes conventions over anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project.
- Keep all text readable in the final render.
- Keep the video within 15-25 seconds.
- Include the planned music/SFX layer.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose SFX after the visual animation exists.
- Treat music cue metadata as optional timing hints. Hyperframes decides exact animation timing and should ignore cues that hurt readability.
- Major reveals may move toward nearby strong cues within about 0.15s. Smaller entrances may align to nearby beat points within about 0.10s.
- Honor planned music treatment such as beat-aligned reveals.
- Consider Hyperframes audio-reactive workflow: extract audio data and use RMS/bass bands for subtle glow pulsing.
- Use local assets for audio.
- Run `hyperframes check` before render.
