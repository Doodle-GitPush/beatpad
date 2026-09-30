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

## Layout

```
app/                    layout (fonts, metadata), page, global styles
components/
  BeatPadLoader.tsx     client wrapper — loads the instrument with ssr: false
  BeatPad.tsx           canvas + mount/cleanup of the 3D app
  Overlay.tsx           readouts, step buttons, hover label (React, reads lib/store)
lib/
  audio.ts              synth voices, effects graph, offline WAV render
  sequencer.ts          patterns, scheduler, swing, editing, autosave
  keys.ts               key map (layout, legends, synth voice, keyboard codes)
  store.ts              tiny external store bridging the engine to React
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

The engine (audio, sequencer, three.js scene) is plain TypeScript with no React inside it; React only renders
the overlay and owns mount/unmount. `three`, `postprocessing` and `n8ao` are pinned to versions known to work
together.
