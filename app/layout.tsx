import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

const sans = Geist({ variable: '--font-sans', subsets: ['latin'] });
const mono = Geist_Mono({ variable: '--font-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Beat Pad 3D',
  description: 'A 3D drum machine you can play in the browser: numpad keys, knobs, fader, jog wheel and a 16-step sequencer.',
  openGraph: {
    title: 'Beat Pad 3D',
    description: 'Make a beat on a 3D drum machine in your browser — and share it with a link.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#d6d5d2',
  colorScheme: 'light dark',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" data-theme="light" className={`${sans.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* sets data-theme before first paint so there is no light/dark flash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
