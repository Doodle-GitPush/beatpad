export type Theme = 'light' | 'dark';

export const THEME_KEY = 'beatpad.theme';

/** Runs in <head> before first paint: saved choice, else the system setting. */
export const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t}catch(e){}})()`;

export const readTheme = (): Theme =>
  document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';

export function applyTheme(t: Theme, persist: boolean) {
  const d = document.documentElement;
  d.setAttribute('data-theme', t);
  d.style.colorScheme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#1c1c1b' : '#d6d5d2');
  if (persist) try { localStorage.setItem(THEME_KEY, t); } catch { /* storage unavailable */ }
}

/** Only follow the OS while the user hasn't picked a theme themselves. */
export function hasSavedTheme() {
  try { const t = localStorage.getItem(THEME_KEY); return t === 'light' || t === 'dark'; } catch { return false; }
}
