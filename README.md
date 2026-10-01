# Beat Pad 3D

A playable 3D drum machine for the browser — numpad keys, knobs, fader, roller, jog wheel and a 16-step
sequencer — built with Next.js (App Router), TypeScript and three.js. All sounds are synthesised with the
Web Audio API; there are no audio files.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start
```

## Controls

| | |
|---|---|
| Keys | every key is a sound (numpad, or `0–9 . + − / x` on the main keyboard) |
| `○` / Space | play / stop |
| `●` / R | tap to record; **hold + 1–9** to switch between 9 patterns |
| `del` / Backspace | tap clears the pattern; hold + a key erases that sound |
| Step lights | click one, then press keys to add / remove sounds at that step (Esc to leave) |
| Knobs | filter, echo, pitch, swing — drag up/down or scroll |
| Fader | volume (detent at 80 %) · Roller: kit · Jog wheel: tempo (spin it) |
| Drag empty space / scroll / double-click | orbit / zoom / reset the camera |

Patterns, tempo, kit and knob positions autosave to `localStorage`. **export wav** renders the current
pattern (two loops plus echo tail) faster than real time.

**daily challenge** — a new brief every day (kit, tempo, a sound limit, a must-use sound and a twist),
generated from the date so everyone gets the same one; rules tick off live, entries share with a link, and
finished days build a streak (`lib/challenge.ts`). **starter beats** load six presets into a free slot
(`lib/starters.ts`). **customise keys** — click a key to change its sound (23 voices), tune and length, and
pick a keycap colourway (`lib/keyconfig.ts`). **guide** replays the first-visit walkthrough.

**share beat** copies a link (or opens the share sheet on phones) with the current pattern and its sound
settings packed into the URL hash — no server involved. Opening a link loads the beat into the first empty
pattern slot. Links also carry custom key sounds, the keycap colourway and challenge entries. Format: `lib/share.ts`.

## Layout

```
app/                    layout (fonts, metadata), page, global styles
components/
  BeatPadLoader.tsx     client wrapper — loads the instrument with ssr: false
  BeatPad.tsx           canvas + mount/cleanup of the 3D app
  Overlay.tsx           readouts, step buttons, hover label (React, reads lib/store)
  Preloader.tsx         boot screen with real load progress
lib/
  audio.ts              synth voices, effects graph, offline WAV render
  sequencer.ts          patterns, scheduler, swing, editing, autosave
  keys.ts               key map (layout, legends, synth voice, keyboard codes)
  store.ts              tiny external store bridging the engine to React
  share.ts              encode / decode beats for share links
  theme.ts              light / dark, applied before first paint
  three/
    stage.ts            renderer, studio environment, lights, ambient occlusion, camera + intro
    materials.ts        bead-blasted aluminium, glossy keys, panels
    geometry.ts         rounded slabs, tapered keycaps, knob teeth, legend drawing
    device.ts           builds the instrument and returns typed handles
    interaction.ts      pointer / wheel / keyboard handling, HUD labels
    app.ts              startBeatPad(): wires it together and runs the frame loop
public/2d.html          the earlier flat 2D prototype
types/n8ao.d.ts         typings for the n8ao ambient-occlusion package
```

## Performance

- The scene renders **on demand**: nothing is drawn while the device is idle; frames are drawn only while the
  camera, a key, knob, jog, LED or light is actually changing.
- The shadow map is re-rendered only while parts that cast shadows move.
- Quality tiers (`lib/three/quality.ts`): every tier keeps reflections and soft shadows; slower devices give up
  resolution first. **auto** picks high (≤1.75× pixel ratio, AO, bloom, 2K shadows) on capable devices and lower
  tiers on weak / mobile GPUs, and a governor steps down if active frames average under ~33 fps. **ultra**
  (2×, full-res AO, 4K shadows) is opt-in from the **?** menu.
- The studio environment is rendered into a 1024 px cubemap before prefiltering (three's `fromScene` is fixed at
  256 px), which is what keeps reflections on keys, metal and the jog crisp.
- Small static parts are merged into one draw call per material, the 16 LEDs are two instanced draws, and
  decorative details live on a layer the reflection and shadow passes skip.
- Add `?perf` to the URL to expose render counters on `window.__bp` for profiling.

The engine (audio, sequencer, three.js scene) is plain TypeScript with no React inside it; React only renders
the overlay and owns mount/unmount. `three`, `postprocessing` and `n8ao` are pinned to versions known to work
together.
