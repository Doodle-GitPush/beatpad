'use client';

import { useEffect, useRef } from 'react';
import { startBeatPad } from '@/lib/three/app';
import { ui } from '@/lib/store';
import Overlay from './Overlay';
import s from './BeatPad.module.css';

// startups are queued so a quick unmount/remount (React dev double-mount) never builds two scenes on one canvas
let bootQueue: Promise<void> = Promise.resolve();

export default function BeatPad() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    let stop: (() => void) | undefined;
    let cancelled = false;

    bootQueue = bootQueue.then(async () => {
      if (cancelled) return;
      // canvas text (key legends, panel labels) needs the web font loaded before it is drawn
      ui.set({ progress: 0.42, loadStage: 'loading fonts' });
      const family = getComputedStyle(document.body).fontFamily;
      try {
        await Promise.race([document.fonts.load(`400 40px ${family}`), new Promise((r) => setTimeout(r, 1500))]);
      } catch { /* fall back to system font */ }
      if (cancelled) return;
      try {
        const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
        if (!gl) throw new Error('WebGL is not available in this browser');
        stop = await startBeatPad(canvas, family, (progress, loadStage) => ui.set({ progress, loadStage }), () => cancelled);
        ui.set({ error: null });
      } catch (err) {
        console.error(err);
        ui.set({ error: err instanceof Error ? err.message : String(err) });
      }
    });

    return () => { cancelled = true; stop?.(); };
  }, []);

  return (
    <>
      <canvas ref={ref} className={s.canvas} tabIndex={0} />
      <Overlay />
    </>
  );
}
