# SOULPAD — context สำหรับ Claude Code

Neo soul / R&B music sketchpad บนเบราว์เซอร์ จด idea คอร์ด เมโลดี้ กลอง แล้ว export MIDI ไป DAW
เป้าหมาย: เบา, offline, mobile-first (Android Chrome), ติดตั้งเป็น PWA ผ่าน GitHub Pages

**แผนงานถัดไปอยู่ใน `PLAN.md` อ่านก่อนเริ่มทุกครั้ง**

## ไฟล์ใน repo
- `index.html` — ตัวแอปทั้งหมด (HTML + CSS + JS + Tonal.js ฝังใน) **แก้ที่นี่ที่เดียว**
- `manifest.json`, `sw.js`, `icon-192.png`, `icon-512.png` — PWA (ปกติไม่ต้องแตะ)
- `PLAN.md` — แผน phase ที่ตกลงกันแล้ว

## หลักการ (ตัวกรองทุกการตัดสินใจ)
- **Single-file:** โค้ดแอปทั้งหมดอยู่ใน index.html ห้ามเพิ่ม `<script src>` / CDN / network request ใดๆ
- **Synth ก่อน sample:** เสียงทั้งหมดสร้างด้วย Web Audio ห้ามโหลด sample, ห้ามเพิ่ม lib ที่ติด GPL
- **Mobile-first:** ปุ่มต้องกดด้วยนิ้วได้, คุม polyphony (MAXPOLY 8), ระวัง CPU บน Android
- **ที่ export ไป DAW = ที่ได้ยินในแอป** (timing, length, swing ต้องตรงกัน)

## Architecture
**Stack:** Tonal.js (ฝังเป็น `var Tonal=...` ใน `<script>` บล็อกแรก) + Web Audio API ล้วน ไม่มี framework ไม่มี build step (Tone.js ถอดออกแล้ว)

**Audio engine — FM Rhodes**
- sine modulator → carrier (modEnv ขับ `carrier.frequency`), amp env, lowpass, shared tremolo LFO 1 ตัว
- params ใน object `FM`; reverb = feedback delay (rvbDelay/rvbFb/rvbWet)
- live voice: `noteOn(id,freq,vel)` / `noteOff(id)` / `allOff()`, MAXPOLY 8
- seq voice: `scheduleVoice(freq, vel, t0, tEnd)` self-terminating
- ทุก voice ต้อง disconnect tremolo ใน `carrier.onended` (กัน leak)
- pitched voice ใช้ **linearRamp** เท่านั้น (exponential ไป 0 = crash); กลองใช้ exp ไป 0.001 ได้

**Drums:** kick/snare/hat synth ล้วน ผ่าน `drumBus` (dry ไม่ผ่าน reverb), noise buffer สร้างครั้งเดียวใน `bootAudio`

**Scheduler (custom):** lookahead 0.1s, poll 25ms, schedule บน `actx.currentTime`
อ่าน `S.bpm / S.subdiv / S.swing` แบบ live ทุก step (ปรับกลางเพลงได้) · swing = delay step คี่ · playhead วาดด้วย rAF จาก `drawQueue`

**State**
```js
const S = { key, mode, voicing, playMode, chordOct, melOct, bpm, subdiv, swing }
let SD                          // strum delay (s)
const STEPS = 32, PAGE = 16     // 16 CALL + 16 RESPOND
let chordSeq = Array(32)        // {chordName, midis, len} | null  (step ที่ถูก tie คลุม = null)
let melSeq   = Array(32)        // {midi, pc, oct, len} | null
let drumSeq  = { kick: bool[32], snare: bool[32], hat: bool[32] }
```

**Tabs:** CHORD (7 diatonic pads, voicing close/drop2/spread/shell/rootless, Touch/Latch, strum, octave) · MELODY (6×4 fourths grid) · SEQ (32 step, CALL/RESPOND page, note length ×1/×2/×4 แบบ TB-303 tie, resolution 1/4·1/8·1/16, swing, drums, CLR two-tap, MIDI export)

**Modes (9):** dorian, aeolian, melodic minor, ionian, lydian, lydian dominant, mixolydian, phrygian, dorian b2

**MIDI export:** Type-1, 3 track (CHORD ch1, MELODY ch1, DRUMS ch10 GM 36/38/42), download ด้วย anchor ที่ append เข้า DOM + `application/octet-stream` (อย่าใช้ Web Share)

**Session:** localStorage `soulpad_session_v1`, `autosave()` debounce 400ms, `syncUI()` จับคู่ปุ่มผ่าน `data-val`, guard ปฏิเสธ data ที่ length ไม่ตรง STEPS
ถ้าเปลี่ยนรูป data → ขึ้น key เวอร์ชันใหม่ + migrate ของเก่า ห้ามทำให้ session ผู้ใช้พัง

## วิธีทำงาน
- ผู้ใช้ไม่ใช่ coder แต่รู้ดนตรีดี คุยไทย-อังกฤษปนกัน สั้น ตรง ซื่อสัตย์เรื่องข้อจำกัด
- **ประเมินก่อน build** ถ้ามีหลายทาง เสนอ tradeoff ให้เลือกก่อนลงมือ
- build ทีละ feature แก้เฉพาะจุด ไม่ rewrite ทั้งไฟล์
- **ก่อน commit ต้อง validate ด้วย node:** script ทุกบล็อก parse ผ่าน + เทสต์ logic ใหม่ด้วย script (เช่น ทุก mode × ทุกตัวเลือก)
- debug หา root cause ไม่ patch วน
- ผู้ใช้เทสต์จริงใน Chrome / PWA บน Android (webview ในแอป Claude บล็อก download และ localStorage ใช้เทสต์ไม่ได้)
- commit ขึ้น `main` แล้ว GitHub Pages deploy เอง, sw.js เป็น network-first ไม่ต้อง bump cache
- เสร็จแต่ละ phase: อัปเดต CLAUDE.md กับ PLAN.md ให้ตรงกับของจริง
