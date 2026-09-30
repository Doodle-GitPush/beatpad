'use client';

import dynamic from 'next/dynamic';
import Preloader from './Preloader';

// three.js + Web Audio only exist in the browser, so skip server rendering for the instrument.
// The preloader is tiny and renders straight away, while the 3D bundle downloads.
const BeatPad = dynamic(() => import('./BeatPad'), { ssr: false });

export default function BeatPadLoader() {
  return (
    <>
      <BeatPad />
      <Preloader />
    </>
  );
}
