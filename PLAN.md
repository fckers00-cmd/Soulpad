# SOULPAD — แผนอัปเดต (ตกลง 27 ก.ย. 2026)

หลักการ: **เสียงก่อน โครงทีหลัง** ทุก pattern/เพลงในอนาคตใช้คอร์ดชุดนี้ ถ้าทำ song mode ก่อนต้องย้าย data สองรอบ

## Phase 1 — เสียงคอร์ด ⬅ ทำต่อจากตรงนี้

### 1a. Extension 7 / 9 / 11 / 13
ปัญหาเดิม: คอร์ดมีแค่ 7th (ได้ Cm7 ไม่ได้ Cm9) และ rootless ของ Cm7 เหลือ Eb-G-Bb = Eb triad เสียผิดวัตถุประสงค์

- ปุ่มแถวเดียวใน CHORD tab `7 · 9 · 11 · 13` เก็บใน `S.ext` (ปุ่มมี `data-val`, ผูก syncUI + autosave)
- หาโน้ต extension จาก scale ของ mode ปัจจุบัน (9 = ดีกรี+1, 11 = ดีกรี+3, 13 = ดีกรี+5 ขึ้นไปอีก octave) แล้วกรองแบบ "ฉลาด" ตามชนิดคอร์ด:
  - **m7 / m7b5 / mMaj7:** 9 (ถ้าเป็น natural 9), 11 natural, 13 natural เท่านั้น (ข้าม b13)
  - **maj7 / maj7#5:** 9 natural, **#11 เท่านั้น** (ข้าม 11 natural), 13 natural
  - **dominant 7:** 9 natural, #11 ถ้ามี (lydian dominant), 13 natural (ข้าม 11 natural)
  - ทุกชนิด: **ข้าม b9 และ b13** เสมอ
  - ระดับสะสม: 9 = +9 · 11 = +9 +11 · 13 = +9 +11 (ถ้าผ่าน) +13
- **ตัด 5th ทิ้ง** เมื่อมี 11 หรือ 13 ยกเว้น 5th ที่ altered (b5, #5) เพราะมันบอกชนิดคอร์ด
- **ตั้งชื่อคอร์ดเอง** แทน Chord.detect เช่น Cm9, Cm11, Cm13, Cmaj9, Cmaj9#11, Cmaj13, C9, C13, C9#11, Cm11b5, Cmaj7#5 (แทน "M7b6")
- voicing เดิมทั้ง 5 แบบต้องใช้กับคอร์ดยาวได้ (drop2 / spread / shell / rootless)
- SEQ เก็บ `midis` + `chordName` ตอนกดใส่ step → เปลี่ยน ext ทีหลังไม่กระทบ step เก่า

### 1b. Bass root
- ปุ่มเปิด/ปิด `S.bass` ใน CHORD tab เล่น root ของคอร์ดต่ำๆ (ประมาณ MIDI 36–47 ใต้โน้ตต่ำสุดของคอร์ด) ทั้งตอนกด pad และใน SEQ
- เสียงเบส synth แยก (เช่น sine/triangle + lowpass, attack นุ่ม) ไม่ต้องใช้ FM Rhodes
- เก็บโน้ตเบสใน chord step ตอนกดใส่ (`bass: midi`) ความยาวตาม `len` ของคอร์ด
- **MIDI: เพิ่ม track 4 "BASS" แยก (ch2)** ← ผู้ใช้ตัดสินแล้ว ส่งออกเมื่อ `S.bass` เปิด

### Session
- data เปลี่ยน → key ใหม่ `soulpad_session_v2` + migrate จาก v1 (step เก่าไม่มี ext/bass ให้ถือเป็น 7 / ไม่มีเบส)

### เทสต์ก่อน commit (ด้วย node)
- ทุก mode (9) × ทุกดีกรี (7) × ทุก ext (4): ไม่มี b9/b13, ไม่มี 11 natural บน maj/dom, 5th ถูกตัดตามกติกา, ชื่อคอร์ดถูก
- ตัวอย่างที่ต้องได้: C dorian I @9 = **Cm9** · C lydian I @11 = **Cmaj9#11** · C mixolydian I @13 = **C13** · C ionian V @13 = **G13** · C melodic minor I @9 = **CmMaj9**
- polyphony: คอร์ด + เบส ≤ MAXPOLY 8
- MIDI 4 track parse ผ่าน, note on/off จับคู่ครบ
- session v1 → v2 migrate ไม่พัง

## Phase 2 — คำศัพท์คอร์ด (เก็บไว้ ตัดสินหลังผู้ใช้เล่น Phase 1)
- pad 8–9 สำหรับคอร์ดนอกคีย์: V7/vi, iv ยืมจาก minor, tritone sub
- ห้ามเริ่มเองจนกว่าผู้ใช้สั่ง

## Phase 3 — โครงเพลง
- 3a. pattern 4 ช่อง + สลับตอนจบ loop (queued) + copy pattern
- 3b. song chain + export MIDI ทั้งเพลง
- ข้อจำกัดตั้งใจ: ทุก pattern 32 step เท่ากัน, key/bpm ไม่เปลี่ยนกลางเพลง
- คำถามค้าง: ชื่อปุ่ม A/B/C/D หรือ VERSE/CHORUS/BRIDGE (ถามผู้ใช้ตอนถึง phase นี้)

## รอบทำงานทุก phase
1. build + เทสต์ด้วย script
2. commit ขึ้น main → GitHub Pages deploy เอง
3. ผู้ใช้เทสต์ใน Chrome / PWA บน Android
4. อัปเดต CLAUDE.md + PLAN.md (ติ๊ก phase ที่เสร็จ)
