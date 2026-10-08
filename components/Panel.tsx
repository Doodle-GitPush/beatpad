'use client';

import { useEffect, useState } from 'react';
import { audioTime } from '@/lib/audio';
import { isDone, streak, todaysChallenge } from '@/lib/challenge';
import { COLORWAYS, DECAYS, TUNE_RANGE, VOICE_LIST, isDefaultKey, keyConfig, resetAllKeys, resetKey } from '@/lib/keyconfig';
import { KEY_BY_ID } from '@/lib/keys';
import {
  challengeStatus, ensureAudio, keysChanged, setColorway, shareBeat, startChallenge,
} from '@/lib/sequencer';
import { KITS } from '@/lib/audio';
import { voice } from '@/lib/audio';
import { ui, useUi } from '@/lib/store';
import { Disc3, Keyboard, Trophy } from 'lucide-react';
import { CreateMenu, type CreateItem } from './CreateMenu';
import AlbumRail from './AlbumRail';
import s from './Panel.module.css';

type Tab = 'challenge' | 'starters' | 'keys';
const open = (panel: Tab | 'none') => ui.set({ panel });

const isTab = (id: string): id is Tab => id === 'challenge' || id === 'starters' || id === 'keys';

export function Tools() {
  useUi();                                              // the challenge number and its dot follow the day
  const c = todaysChallenge();
  const doneToday = isDone(c.date);
  const items: CreateItem[] = [
    { id: 'challenge', icon: Trophy, label: <>Daily challenge #{c.no}{!doneToday && <i className="bp-dot" aria-label="not done yet" />}</> },
    { id: 'starters', icon: Disc3, label: 'Starter beats' },
    { id: 'keys', icon: Keyboard, label: 'Customise keys' },
  ];
  return (
    <div className={s.tools} id="bp-tools">
      <CreateMenu className="bp-create" anchor="bottom-left" label="Create" panelW={256} items={items}
        onSelect={(id) => { if (isTab(id)) open(id); }} />
    </div>
  );
}

const TITLES: Record<Tab, string> = { challenge: 'Daily Challenge', starters: 'Starter Beats', keys: 'Customise Keys' };

/** the contents of the dock's drawer when it is pulled open: the challenge, the starters or the key editor */
export function DrawerPanel() {
  const u = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' && ui.get().panel !== 'none') open('none'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // what the drawer showed last, so it keeps its contents while it closes
  const [tab, setTab] = useState<Tab>('challenge');
  if (u.panel !== 'none' && u.panel !== tab) setTab(u.panel);
  // bumped on every open and every switch, so the contents remount and blur in again
  const [seen, setSeen] = useState(u.panel);
  const [gen, setGen] = useState(0);
  if (u.panel !== seen) { setSeen(u.panel); if (u.panel !== 'none') setGen(gen + 1); }
  return (
    <div className={s.drawerPane} aria-label={TITLES[tab]}>
      <div key={gen} className={s.swap}>
        <div className={s.head}>
          <h2 className={s.drawerTitle}>{TITLES[tab]}</h2>
          <button type="button" className={s.close} aria-label={`Close ${TITLES[tab]}`} onClick={() => open('none')}>×</button>
        </div>
        {tab === 'challenge' && <ChallengeTab entry={u.challengeEntry} />}
        {tab === 'starters' && <StartersTab />}
        {tab === 'keys' && <KeysTab editKey={u.editKey} colorway={u.colorway} />}
      </div>
    </div>
  );
}

/** sentence case for the generated rule texts */
const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

function ChallengeTab({ entry }: { entry: string | null }) {
  useUi();                                              // re-check the rules on every change
  const c = todaysChallenge();
  const active = entry === c.date;
  const rules = challengeStatus(c);
  const complete = rules.every((r) => r.ok);
  const done = isDone(c.date);
  const days = streak();
  return (
    <>
      <p className={s.sub}>#{c.no} · {c.label} · Same challenge for everyone, new one at midnight
        {days > 0 && <> · <b>{days}-day streak</b></>}</p>
      <ul className={s.rules}>
        {rules.map((r) => (
          <li key={r.id} className={`${s.rule} ${r.ok ? s.ok : ''}`}>
            <span className={s.check} aria-hidden="true">✓</span>
            <span className={s.ruleText}>{cap(r.label)}</span>
            <span className="sr-only">{r.ok ? '(done)' : '(not yet)'}</span>
          </li>
        ))}
      </ul>
      {!active && (
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={startChallenge}>Start challenge</button>
          <span className={s.meta}>Sets {KITS[c.kit].name} · {c.bpm} bpm on an empty pattern</span>
        </div>
      )}
      {active && !complete && <p className={s.meta}>Build your beat — the list ticks off as you go.</p>}
      {active && complete && (
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={async () => { await shareBeat(c.date); ui.set({ rev: ui.get().rev + 1 }); }}>
            Share your entry
          </button>
          {done ? <span className={s.done}>✓ Done today</span> : <span className={s.meta}>All rules met!</span>}
        </div>
      )}
    </>
  );
}

function StartersTab() {
  return (
    <>
      <p className={s.sub}>Pull a record out to play it. It loads into your next empty pattern, so your own patterns are never overwritten without asking.</p>
      <AlbumRail />
    </>
  );
}

function KeysTab({ editKey, colorway }: { editKey: string | null; colorway: number }) {
  useUi();
  const k = editKey ? KEY_BY_ID[editKey] : null;
  const cfg = editKey ? keyConfig[editKey] : null;
  const decayIdx = cfg ? DECAYS.reduce((best, d, i) => (Math.abs(d - cfg.decay) < Math.abs(DECAYS[best] - cfg.decay) ? i : best), 0) : 4;
  const preview = () => { if (!editKey) return; ensureAudio(); voice(editKey, audioTime()); };
  const change = (patch: Partial<typeof keyConfig[string]>) => { if (!editKey) return; Object.assign(keyConfig[editKey], patch); keysChanged(); preview(); };
  const groups = ['drums', 'percussion', 'cymbals', 'synth'] as const;

  return (
    <div className={s.keysGrid}>
      <div>
      {!k || !cfg ? (
        <p className={s.empty}>Click any key on the device (or press it on your keyboard) to change its sound.</p>
      ) : (
        <>
          <p className={s.sub}><span className={s.keyTag}>{k.L.t ?? (k.id === 'enter' ? '↵' : k.id)}</span>Patterns keep working — they just play the new sound</p>
          <label className={s.field}>
            <span className={s.label}>Sound</span>
            <select className={s.select} value={cfg.voice} onChange={(e) => change({ voice: e.target.value })}>
              {groups.map((g) => (
                <optgroup key={g} label={cap(g)}>
                  {VOICE_LIST.filter((v) => v.group === g).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span className={s.label}>Tune <b>{cfg.tune > 0 ? '+' : ''}{cfg.tune} st</b></span>
            <input className={s.range} type="range" min={-TUNE_RANGE} max={TUNE_RANGE} step={1} value={cfg.tune}
              onChange={(e) => change({ tune: Number(e.target.value) })} />
          </label>
          <label className={s.field}>
            <span className={s.label}>Length <b>{Math.round(DECAYS[decayIdx] * 100)}%</b></span>
            <input className={s.range} type="range" min={0} max={DECAYS.length - 1} step={1} value={decayIdx}
              onChange={(e) => change({ decay: DECAYS[Number(e.target.value)] })} />
          </label>
          <div className={s.row}>
            <button type="button" className={s.ghost} onClick={preview}>Preview</button>
            <button type="button" className={s.ghost} disabled={isDefaultKey(editKey!)}
              onClick={() => { resetKey(editKey!); keysChanged(); preview(); }}>Reset key</button>
          </div>
        </>
      )}
      </div>
      <div className={s.keysSide}>
      <div className={s.field}>
        <span className={s.label}>Keycaps</span>
        <div className={s.swatches} role="radiogroup" aria-label="Keycap colourway">
          {COLORWAYS.map((cw, i) => (
            <button key={cw.id} type="button" role="radio" aria-checked={colorway === i} className={`${s.swatch} ${colorway === i ? s.swatchOn : ''}`}
              onClick={() => setColorway(i)}>
              <span className={s.chips} aria-hidden="true">
                {(['white', 'orange', 'dark'] as const).map((r) => <i key={r} className={s.chip} style={{ background: cw.caps[r].cap }} />)}
              </span>
              {cap(cw.name)}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={s.ghost} onClick={() => { if (window.confirm('Reset every key to its original sound?')) { resetAllKeys(); keysChanged(); } }}>
        Reset all sounds
      </button>
      </div>
    </div>
  );
}
