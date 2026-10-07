'use client';

import { useEffect } from 'react';
import { audioTime } from '@/lib/audio';
import { isDone, streak, todaysChallenge } from '@/lib/challenge';
import { COLORWAYS, DECAYS, TUNE_RANGE, VOICE_LIST, isDefaultKey, keyConfig, resetAllKeys, resetKey } from '@/lib/keyconfig';
import { KEY_BY_ID } from '@/lib/keys';
import {
  challengeStatus, ensureAudio, keysChanged, loadStarter, setColorway, shareBeat, startChallenge,
} from '@/lib/sequencer';
import { STARTERS } from '@/lib/starters';
import { KITS } from '@/lib/audio';
import { voice } from '@/lib/audio';
import { ui, useUi } from '@/lib/store';
import { Disc3, Keyboard, Trophy } from 'lucide-react';
import { CreateMenu, type CreateItem } from './CreateMenu';
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
      <CreateMenu className="bp-create" anchor="bottom" label="Create" panelW={256} items={items}
        onSelect={(id) => { if (isTab(id)) open(id); }} />
    </div>
  );
}

export default function Panel() {
  const u = useUi();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape' && ui.get().panel !== 'none') open('none'); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  if (u.panel === 'none') return null;
  const titles: Record<Tab, string> = { challenge: 'daily challenge', starters: 'starter beats', keys: 'customise keys' };
  return (
    <section className={s.panel} aria-label={titles[u.panel]}>
      <div className={s.head}>
        <span className={s.title}>{titles[u.panel]}</span>
        <button type="button" className={s.close} aria-label="Close panel" onClick={() => open('none')}>×</button>
      </div>
      {u.panel === 'challenge' && <ChallengeTab entry={u.challengeEntry} />}
      {u.panel === 'starters' && <StartersTab />}
      {u.panel === 'keys' && <KeysTab editKey={u.editKey} colorway={u.colorway} />}
    </section>
  );
}

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
      <p className={s.sub}>#{c.no} · {c.label} · same challenge for everyone, new one at midnight
        {days > 0 && <> · <b>{days}-day streak</b></>}</p>
      <ul className={s.rules}>
        {rules.map((r) => (
          <li key={r.id} className={`${s.rule} ${r.ok ? s.ok : ''}`}>
            <span className={s.check} aria-hidden="true">✓</span>
            <span className={s.ruleText}>{r.label}</span>
            <span className="sr-only">{r.ok ? '(done)' : '(not yet)'}</span>
          </li>
        ))}
      </ul>
      {!active && (
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={startChallenge}>start challenge</button>
          <span className={s.meta}>sets {KITS[c.kit].name} · {c.bpm} bpm on an empty pattern</span>
        </div>
      )}
      {active && !complete && <p className={s.meta}>build your beat — the list ticks off as you go.</p>}
      {active && complete && (
        <div className={s.row}>
          <button type="button" className={s.btn} onClick={async () => { await shareBeat(c.date); ui.set({ rev: ui.get().rev + 1 }); }}>
            share your entry
          </button>
          {done ? <span className={s.done}>✓ done today</span> : <span className={s.meta}>all rules met!</span>}
        </div>
      )}
    </>
  );
}

function StartersTab() {
  return (
    <>
      <p className={s.sub}>Loads into your next empty pattern — your own patterns are never overwritten without asking.</p>
      <div className={s.list}>
        {STARTERS.map((st) => (
          <div key={st.id} className={s.card}>
            <div><b>{st.name}</b><p>{st.blurb} · {st.bpm} bpm · {KITS[st.kit].name}</p></div>
            <button type="button" className={s.ghost} onClick={() => loadStarter(st.id)}>load</button>
          </div>
        ))}
      </div>
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
    <>
      {!k || !cfg ? (
        <p className={s.empty}>Click any key on the device (or press it on your keyboard) to change its sound.</p>
      ) : (
        <>
          <p className={s.sub}><span className={s.keyTag}>{k.L.t ?? (k.id === 'enter' ? '↵' : k.id)}</span>patterns keep working — they just play the new sound</p>
          <label className={s.field}>
            <span className={s.label}>sound</span>
            <select className={s.select} value={cfg.voice} onChange={(e) => change({ voice: e.target.value })}>
              {groups.map((g) => (
                <optgroup key={g} label={g}>
                  {VOICE_LIST.filter((v) => v.group === g).map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <label className={s.field}>
            <span className={s.label}>tune <b>{cfg.tune > 0 ? '+' : ''}{cfg.tune} st</b></span>
            <input className={s.range} type="range" min={-TUNE_RANGE} max={TUNE_RANGE} step={1} value={cfg.tune}
              onChange={(e) => change({ tune: Number(e.target.value) })} />
          </label>
          <label className={s.field}>
            <span className={s.label}>length <b>{Math.round(DECAYS[decayIdx] * 100)}%</b></span>
            <input className={s.range} type="range" min={0} max={DECAYS.length - 1} step={1} value={decayIdx}
              onChange={(e) => change({ decay: DECAYS[Number(e.target.value)] })} />
          </label>
          <div className={s.row}>
            <button type="button" className={s.ghost} onClick={preview}>preview</button>
            <button type="button" className={s.ghost} disabled={isDefaultKey(editKey!)}
              onClick={() => { resetKey(editKey!); keysChanged(); preview(); }}>reset key</button>
          </div>
        </>
      )}
      <hr className={s.hr} />
      <div className={s.field}>
        <span className={s.label}>keycaps</span>
        <div className={s.swatches} role="radiogroup" aria-label="Keycap colourway">
          {COLORWAYS.map((cw, i) => (
            <button key={cw.id} type="button" role="radio" aria-checked={colorway === i} className={`${s.swatch} ${colorway === i ? s.swatchOn : ''}`}
              onClick={() => setColorway(i)}>
              <span className={s.chips} aria-hidden="true">
                {(['white', 'orange', 'dark'] as const).map((r) => <i key={r} className={s.chip} style={{ background: cw.caps[r].cap }} />)}
              </span>
              {cw.name}
            </button>
          ))}
        </div>
      </div>
      <button type="button" className={s.ghost} onClick={() => { if (window.confirm('Reset every key to its original sound?')) { resetAllKeys(); keysChanged(); } }}>
        reset all sounds
      </button>
    </>
  );
}
