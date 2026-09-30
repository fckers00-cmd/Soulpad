// Phase 1a/1b/2 — chord extensions, bass root, out-of-key chords. Run: node test/chords_test.js
// Boots every <script> block of index.html against a stub DOM, then checks
// all modes × degrees × ext levels against the rules in PLAN.md,
// the bass note under every chord, MIDI export, and session v1 → v2.
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('FAIL', msg); } };

// ── stub DOM: enough for boot + buildChords/openPicker ──
function el() {
  let html = '';
  return {
    get innerHTML() { return html; }, set innerHTML(v) { html = v; this.children = []; },
    textContent: '', value: '', dataset: {}, style: {}, children: [],
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    appendChild(c) { this.children.push(c); return c; }, removeChild(){},
    addEventListener(){}, closest() { return { querySelectorAll: () => [] }; },
    querySelectorAll: () => [], click(){},
  };
}
const els = {};
const store = {};
const ctx = {
  console, setTimeout: () => 0, clearTimeout(){}, setInterval: () => 0, clearInterval(){},
  requestAnimationFrame: f => 0, cancelAnimationFrame(){},
  navigator: {}, location: { protocol: 'file:' }, window: { addEventListener(){} },
  localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  document: {
    getElementById: id => els[id] || (els[id] = el()),
    createElement: () => el(), querySelectorAll: () => [], body: el(),
  },
};
vm.createContext(ctx);
blocks.forEach((b, i) => {
  try { vm.runInContext(b, ctx, { filename: 'script' + i }); }
  catch (e) { ok(false, `script block ${i} threw: ${e.message}`); }
});
if (fails) process.exit(1);
const run = src => vm.runInContext(src, ctx);

const MODES = ['dorian','aeolian','melodic minor','ionian','lydian','lydian dominant','mixolydian','phrygian','dorian b2'];
const EXT = [7, 9, 11, 13];
const VOICINGS = ['close','drop2','spread','shell','rootless'];

// ── named examples from PLAN.md ──
const name = (key, mode, deg, ext) =>
  run(`buildScaleChord(Tonal.Scale.get(${JSON.stringify(key + ' ' + mode)}).notes, ${deg}, ${ext})`).chordName;
[
  ['C','dorian',0,9,'Cm9'], ['C','lydian',0,11,'Cmaj9#11'], ['C','mixolydian',0,13,'C13'],
  ['C','ionian',4,13,'G13'], ['C','melodic minor',0,9,'CmMaj9'],
  // 7 level keeps the old names, but maj7#5 replaces Tonal's "M7b6"
  ['C','dorian',0,7,'Cm7'], ['C','ionian',0,7,'Cmaj7'], ['C','ionian',6,7,'Bm7b5'],
  ['C','melodic minor',2,7,'Ebmaj7#5'], ['C','melodic minor',0,7,'CmMaj7'],
  // other spellings the plan lists
  ['C','dorian',0,11,'Cm11'], ['C','dorian',0,13,'Cm13'], ['C','ionian',0,9,'Cmaj9'],
  ['C','ionian',0,13,'Cmaj13'], ['C','mixolydian',0,9,'C9'], ['C','lydian dominant',0,11,'C9#11'],
  ['C','melodic minor',5,11,'Am11b5'],
  // b9 skipped → no 9 in the name
  ['C','phrygian',0,9,'Cm7'], ['C','phrygian',0,11,'Cm7(11)'],
].forEach(([k, m, d, e, want]) => {
  const got = name(k, m, d, e);
  ok(got === want, `${k} ${m} deg ${d + 1} @${e}: want ${want}, got ${got}`);
});

// ── rules, every key × mode × degree × ext ──
const KEYS = ['C','C#','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B'];
let n = 0;
for (const key of KEYS) for (const mode of MODES) {
  const notes = run(`Tonal.Scale.get(${JSON.stringify(key + ' ' + mode)}).notes`);
  ok(notes.length === 7, `${key} ${mode}: scale has ${notes.length} notes`);
  for (let deg = 0; deg < 7; deg++) {
    let prev = null;
    for (const ext of EXT) {
      n++;
      const ch = run(`buildScaleChord(${JSON.stringify(notes)}, ${deg}, ${ext})`);
      const tag = `${key} ${mode} deg ${deg + 1} @${ext} (${ch.chordName})`;
      const iv = ch.ivs, has = s => iv.includes(s);
      const third = iv[1];
      const minor = third === 3;
      const seventh = iv.find(s => s === 10 || s === 11);
      const dom = third === 4 && seventh === 10;
      const maj = third === 4 && seventh === 11;

      ok(ch.chordName.startsWith(ch.root), `${tag}: name starts with root`);
      ok(!ch.quality.startsWith('(0'), `${tag}: quality not recognised`);
      ok(third === 3 || third === 4, `${tag}: has a 3rd`);
      ok(seventh !== undefined, `${tag}: has a 7th`);
      ok(!has(13) && !has(20), `${tag}: no b9 / b13`);
      if (maj || dom) ok(!has(17), `${tag}: no natural 11 on maj/dom`);
      if (minor) ok(!has(18), `${tag}: no #11 on minor`);
      ok(!has(15), `${tag}: no #9`);
      const tens = iv.filter(s => s > 12);
      if (ext === 7) ok(tens.length === 0, `${tag}: @7 has no tensions`);
      if (ext === 9) ok(tens.every(s => s === 14), `${tag}: @9 adds only the 9`);
      if (ext === 11) ok(!has(21), `${tag}: @11 has no 13`);
      const eleven13 = has(17) || has(18) || has(21);
      if (eleven13) ok(!has(7), `${tag}: perfect 5th dropped with 11/13`);
      else ok(has(6) || has(7) || has(8), `${tag}: 5th kept without 11/13`);
      if (third === 3 && iv.includes(6)) ok(/b5/.test(ch.chordName), `${tag}: b5 named`);
      if (iv.includes(8)) ok(/#5/.test(ch.chordName), `${tag}: #5 named`);
      if (has(18)) ok(/#11/.test(ch.chordName), `${tag}: #11 named`);
      if (has(14)) ok(/(9|11|13)/.test(ch.chordName.slice(ch.root.length)), `${tag}: 9 named`);
      // cumulative: a higher ext never loses a tension a lower one had
      if (prev) prev.filter(s => s > 12).forEach(s => ok(has(s), `${tag}: keeps ${s} from lower ext`));
      prev = iv;

      for (const oct of [2, 3, 4]) for (const v of VOICINGS) {
        const m = run(`chordToMidis(buildScaleChord(${JSON.stringify(notes)}, ${deg}, ${ext}), ${JSON.stringify(v)}, ${oct})`);
        const t = `${tag} ${v} oct${oct}`;
        ok(m.length >= 2, `${t}: ${m.length} notes`);
        ok(m.length <= 7, `${t}: ${m.length} notes leaves room for bass under MAXPOLY 8`);
        const b = run(`bassMidi(buildScaleChord(${JSON.stringify(notes)}, ${deg}, ${ext}), ${JSON.stringify(m)})`);
        ok(m.length + 1 <= run('MAXPOLY'), `${t}: chord + bass ${m.length + 1} > MAXPOLY`);
        ok(Number.isInteger(b) && b >= 24 && b <= 47, `${t}: bass ${b} outside 24–47`);
        ok(b < Math.min(...m), `${t}: bass ${b} not under chord low ${Math.min(...m)}`);
        ok((b - run(`Tonal.Note.midi(${JSON.stringify(ch.root + '4')})`)) % 12 === 0, `${t}: bass ${b} is not the root ${ch.root}`);
        if (Math.min(...m) > 47) ok(b >= 36, `${t}: bass ${b} dropped below 36 without need`);
        ok(m.every(x => Number.isInteger(x) && x >= 21 && x <= 108), `${t}: out of piano range ${m}`);
        ok(new Set(m).size === m.length, `${t}: duplicate note ${m}`);
        const pcs = new Set(m.map(x => ((x - m[0]) % 12 + 12) % 12));
        const want = new Set(iv.map(s => s % 12));
        if (v === 'close' || v === 'drop2' || v === 'spread')
          ok(pcs.size === want.size, `${t}: lost a chord tone`);
        if (v === 'shell' && tens.length)
          ok(m.length === 3, `${t}: shell = 3rd + 7th + top tension`);
        if (v === 'rootless' && ext === 9 && has(14))
          ok(m.length === 4, `${t}: rootless 9 = 3 5 7 9`);
      }
    }
  }
}

// ── spice (out-of-key) chords: every key × mode × ext ──
const SPICE_WANT = {   // key C, @7 — the table agreed with the user (PLAN.md Phase 2)
  'ionian': 'E7 Fm7 Db7', 'lydian': 'E7 Fm7 Db7', 'mixolydian': 'E7 Fm7 Db7', 'lydian dominant': 'E7 Fm7 Db7',
  'dorian': 'G7 Abmaj7 Db7', 'dorian b2': 'G7 Abmaj7 Db7', 'aeolian': 'G7 F7 Db7', 'phrygian': 'G7 F7 Db7',
  'melodic minor': 'A7 Abmaj7 Db7',
};
for (const mode of MODES) {
  const got = run(`S.key='C'; S.mode=${JSON.stringify(mode)}; S.ext=7; getSpiceChords().map(c => c.chordName).join(' ')`);
  ok(got === SPICE_WANT[mode], `C ${mode} spice: want ${SPICE_WANT[mode]}, got ${got}`);
}
let ns = 0;
for (const key of KEYS) for (const mode of MODES) for (const ext of EXT) {
  const sp = run(`S.key=${JSON.stringify(key)}; S.mode=${JSON.stringify(mode)}; S.ext=${ext}; getSpiceChords()`);
  const scale = new Set(run(`getScaleNotes().map(n => Tonal.Note.chroma(n))`));
  const tonic = run(`Tonal.Note.chroma(S.key)`);
  const diat = run(`getDiatonicChords().map(c => Tonal.Note.chroma(c.root))`);
  ok(sp.length === 3, `${key} ${mode}: 3 spice chords`);
  sp.forEach((ch, i) => {
    ns++;
    const tag = `${key} ${mode} @${ext} spice ${i + 1} (${ch.chordName})`;
    const rc = run(`Tonal.Note.chroma(${JSON.stringify(ch.root)})`);
    ok(ch.spice === true && ch.roman && ch.chordName.startsWith(ch.root), `${tag}: labelled`);
    ok(!ch.quality.startsWith('(0'), `${tag}: quality recognised`);
    ok(ch.ivs.some(iv => !scale.has((rc + iv) % 12)), `${tag}: has a note outside the key`);
    ok(!ch.ivs.includes(13) && !ch.ivs.includes(20), `${tag}: no b9 / b13`);
    if (i === 2) ok((rc - tonic + 12) % 12 === 1, `${tag}: subV root a semitone above the key`);
    if (i === 0) {   // secondary dominant: its target (a 4th up) is one of the pads
      ok(ch.ivs[1] === 4 && ch.ivs.includes(10), `${tag}: is a dominant 7`);
      ok(diat.includes((rc + 5) % 12), `${tag}: resolves to a pad`);
    }
    for (const v of VOICINGS) {
      const m = run(`chordToMidis(getSpiceChords()[${i}], ${JSON.stringify(v)}, 3)`);
      ok(m.length >= 2 && m.length <= 7 && new Set(m).size === m.length, `${tag} ${v}: ${m}`);
      const b = run(`bassMidi(getSpiceChords()[${i}], ${JSON.stringify(m)})`);
      ok(b < Math.min(...m) && (b - rc) % 12 === 0, `${tag} ${v}: bass ${b}`);
    }
  });
}
console.log(`${ns} spice chords checked`);

// ── UI wiring: pads + picker use the current ext ──
run(`S.key='C'; S.mode='dorian'; S.ext=9; buildChords();`);
const cells = els.chordGrid.children;
ok(cells.length === 12, `4×3 grid = 12 cells, got ${cells.length}`);
ok(cells[7].className === 'cp-gap' && cells[11].className === 'cp-gap', 'cells 8 and 12 are empty');
ok(cells.slice(8, 11).every(c => /spice/.test(c.className)), 'row 3 = spice pads');
ok(/G7/.test(cells[8].innerHTML) && /Abmaj9/.test(cells[9].innerHTML) && /Db9/.test(cells[10].innerHTML), 'dorian @9 spice row = G7 Abmaj9 Db9');
const pads = cells;
ok(/Cm9/.test(pads[0].innerHTML), 'pad I shows Cm9 at ext 9');
ok(/1 b3 5 b7 9/.test(pads[0].innerHTML), 'pad I subtitle shows tones');
run(`openPicker('chord', 3);`);
const picks = els.pickerGrid.children;
ok(picks[0].textContent === 'Cm9', `picker shows Cm9, got ${picks[0].textContent}`);
ok(picks.length === 11 && picks[10].textContent === 'Db9' && /spice/.test(picks[8].className), `picker: 7 + gap + 3 spice, got ${picks.map(x => x.textContent).join(',')}`);

// ── SEQ keeps what was assigned when ext changes later ──
run(`assignChord(getDiatonicChords()[0]); S.ext = 13; buildChords();`);
const step = run('chordSeq[3]');
ok(step.chordName === 'Cm9' && step.midis.length === 5, `step keeps Cm9 midis, got ${step.chordName} ${step.midis}`);

// ── SEQ step freezes bass with the chord ──
run(`S.key='C'; S.mode='dorian'; S.ext=9; S.bass=true; S.voicing='close'; S.chordOct=3; pickStep=5; assignChord(getDiatonicChords()[3]);`);
const fb = run('chordSeq[5]');
ok(fb.chordName === 'F9' && fb.bass === 41, `F9 step gets bass F2 (41), got ${fb.chordName} ${fb.bass}`);
run(`S.bass=false; pickStep=6; assignChord(getDiatonicChords()[5]);`);
ok(run('chordSeq[6]').bass === null, 'bass off → step has no bass');
run(`pickStep=7; S.bass=true; S.voicing='rootless'; assignChord(getDiatonicChords()[3]); S.voicing='close';`);
ok(run('chordSeq[7]').bass === 41, 'rootless F9 still gets F bass');

// ── MIDI export: parse it back ──
function parseMidi(bytes) {
  let p = 0;
  const u32 = () => (bytes[p++] << 24 | bytes[p++] << 16 | bytes[p++] << 8 | bytes[p++]) >>> 0;
  const u16 = () => bytes[p++] << 8 | bytes[p++];
  const tag = () => String.fromCharCode(bytes[p++], bytes[p++], bytes[p++], bytes[p++]);
  if (tag() !== 'MThd' || u32() !== 6) throw new Error('bad header');
  const fmt = u16(), ntrks = u16(); u16();
  const tracks = [];
  for (let k = 0; k < ntrks; k++) {
    if (tag() !== 'MTrk') throw new Error('bad track ' + k);
    const end = u32() + p; const tr = { name: '', notes: [], open: 0, bad: 0, ch: new Set() };
    let tick = 0; const held = {};
    while (p < end) {
      let v = 0, c; do { c = bytes[p++]; v = (v << 7) | (c & 0x7f); } while (c & 0x80);
      tick += v; const st = bytes[p++];
      if (st === 0xff) { const ty = bytes[p++], len = bytes[p++]; const data = bytes.slice(p, p + len); p += len;
        if (ty === 0x03) tr.name = String.fromCharCode(...data); continue; }
      const hi = st & 0xf0, note = bytes[p++], vel = bytes[p++]; tr.ch.add(st & 0x0f);
      if (hi === 0x90 && vel > 0) { held[note] = (held[note] || 0) + 1; tr.notes.push({ tick, note }); }
      else if (hi === 0x80 || hi === 0x90) { if (!held[note]) tr.bad++; else held[note]--; }
      else throw new Error('unexpected status ' + st.toString(16));
    }
    if (p !== end) throw new Error('track length mismatch');
    tr.open = Object.values(held).reduce((a, b) => a + b, 0);
    tracks.push(tr);
  }
  return { fmt, tracks };
}
let saved = null;
ctx.saveFile = b => { saved = b; };
run('exportMidi();');
let mid = parseMidi(saved);
ok(mid.fmt === 1 && mid.tracks.length === 4, `4 tracks with bass steps, got ${mid.tracks.length}`);
const bt = mid.tracks[3];
ok(bt && bt.name === 'BASS', `track 4 named BASS, got ${bt && bt.name}`);
ok(bt && bt.ch.size === 1 && bt.ch.has(1), 'BASS on channel 2');
ok(bt && bt.notes.length === 2 && bt.notes.every(x => x.note === 41), `bass notes = 2× F2, got ${bt && JSON.stringify(bt.notes)}`);
mid.tracks.forEach(t => ok(t.open === 0 && t.bad === 0, `${t.name}: on/off unpaired (open ${t.open}, stray off ${t.bad})`));
run('chordSeq = chordSeq.map(s => s && { ...s, bass: null }); exportMidi();');
mid = parseMidi(saved);
ok(mid.tracks.length === 3, `no bass steps → 3 tracks, got ${mid.tracks.length}`);

// ── session: v1 → v2 ──
Object.keys(store).forEach(k => delete store[k]);
const v1step = { root: 'C', chordName: 'Cm7', quality: 'm7', roman: 'I', midis: [48, 51, 55, 58], len: 2 };
store.soulpad_session_v1 = JSON.stringify({ S: { key: 'D', mode: 'ionian' }, SD: 0.03,
  chordSeq: [v1step, ...Array(31).fill(null)], melSeq: Array(32).fill(null),
  drumSeq: { kick: Array(32).fill(false), snare: Array(32).fill(false), hat: Array(32).fill(false) } });
run(`S.ext = 11; S.bass = true; delete S.ext; delete S.bass; loadSession();`);
ok(run('S.ext') === 7, `v1 loads ext 7, got ${run('S.ext')}`);
ok(run('S.bass') === false, 'v1 loads bass off');
ok(run('S.key') === 'D', 'v1 keeps key');
const m0 = run('chordSeq[0]');
ok(m0 && m0.chordName === 'Cm7' && m0.len === 2 && m0.bass === null && m0.midis.length === 4, `v1 step migrates, got ${JSON.stringify(m0)}`);
run('saveSession();');
ok(store.soulpad_session_v2 && JSON.parse(store.soulpad_session_v2).S.bass === false, 'saves under v2 key');
ok(JSON.parse(store.soulpad_session_v1).S.key === 'D', 'v1 left untouched');
store.soulpad_session_v2 = JSON.stringify({ S: { ext: 5, bass: 'yes' } });
run('loadSession();');
ok(run('S.ext') === 7 && run('S.bass') === false, 'bad ext/bass fall back to 7 / off');
store.soulpad_session_v2 = '{broken';
run('loadSession();');
ok(true, 'corrupt v2 does not throw');

console.log(`${n} chords checked`);
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('=== all passed ===');
