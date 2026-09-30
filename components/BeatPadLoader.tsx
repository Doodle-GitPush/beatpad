'use client';

import dynamic from 'next/dynamic';

// three.js + Web Audio only exist in the browser, so skip server rendering for the instrument
const BeatPad = dynamic(() => import('./BeatPad'), { ssr: false });

export default function BeatPadLoader() {
  return <BeatPad />;
}
