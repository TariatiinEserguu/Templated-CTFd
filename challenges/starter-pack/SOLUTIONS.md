# Starter pack — organizer solutions

> **Organizer-only.** This file is never uploaded by `tools/load_pack.py`.
> Do not publish it, and do not attach it to a challenge.

All flags are public sample flags (`flag{example_...}`). Replace them before
running a real event (see README → *Creating challenges*).

| # | Challenge | Category | Points | Flag |
|---|-----------|----------|-------:|------|
| 1 | Signal in the Noise | Cryptography | 100 | `flag{example_layered_encoding}` |
| 2 | Ghost in the Metadata | Digital Forensics | 150 | `flag{example_metadata_never_lies}` |
| 3 | The Lighthouse Keeper | OSINT | 200 | `flag{example_saltmere_1987}` (case-insensitive) |
| 4 | Staff Only | Web Exploitation | 200 | `flag{example_trust_no_cookie}` |
| 5 | Dial Tone | Miscellaneous | 100 | `flag{example_keypad_signals}` (case-insensitive) |
| 6 | Deep Signal | Reverse Engineering | 250 | `flag{example_xor_is_reversible}` |

---

## 1. Signal in the Noise — base64 → hex

The payload is Base64. Decoding it yields a string of `0-9a-f` characters, i.e.
hex. Decoding the hex yields the flag.

```bash
echo 'NjY2YzYx...Nzdk' | base64 -d | xxd -r -p
```

CyberChef recipe: *From Base64* → *From Hex*.

## 2. Ghost in the Metadata — PNG text chunk

`surveillance_frame.png` contains three `tEXt` chunks. The `Comment` chunk holds
the operator note with the flag.

```bash
exiftool surveillance_frame.png | grep -i comment
# or
strings surveillance_frame.png | grep flag
```

## 3. The Lighthouse Keeper — correlate fictional artifacts

* **Town:** Artifact C spells out `S A L T M E R E`; Artifact D confirms her first
  boat was moored at the *Saltmere* fish quay → `saltmere`.
* **Year:** Artifact B is Tomasz's 37th birthday post dated 02 Jan 2024 → born
  1987. Artifacts A and B both say the light was decommissioned the week he was
  born → `1987`.
* Artifact E is noise.

## 4. Staff Only — robots.txt + client-side role cookie

Requires `voidctf training-up` (Docker) or
`python challenges/starter-pack/web-training/server.py` (no Docker).

1. `GET /robots.txt` reveals `Disallow: /staff-only/console`.
2. Visiting the console returns *403 — role guest*.
3. The site set a cookie `role=guest`. Change it to `role=admin` (browser dev
   tools → Application → Cookies) and reload the console.

```bash
curl -s -b 'role=admin' http://localhost:8081/staff-only/console
```

Lesson: authorization decisions must never trust client-controlled data.

## 5. Dial Tone — phone keypad multi-tap

Each group is one key pressed *n* times (2 = ABC, 3 = DEF, … 7 = PQRS, 9 = WXYZ);
`0` is `_`.

`33 99 2 6 7 555 33` → `e x a m p l e`, `55 33 999 7 2 3` → `k e y p a d`,
`7777 444 4 66 2 555 7777` → `s i g n a l s`.

## 6. Deep Signal — XOR

`checker.py` stores the flag XOR-encrypted with the 4-byte key `V01D`
(`0x56 0x30 0x31 0x44`). XOR is its own inverse, so decrypt the stored bytes with
the same key:

```python
key = bytes([0x56, 0x30, 0x31, 0x44])
blob = bytes.fromhex("<_S value from checker.py>")
print(bytes(b ^ key[i % 4] for i, b in enumerate(blob)).decode())
```

Locked behind challenge 1 with the **Preview** prerequisite mode, so players see
the card (name, points) but cannot open it until they solve *Signal in the Noise*.

---

### Regenerating assets

If you change a flag, edit `build_assets.py` **and** `pack.json`, then run:

```bash
python challenges/starter-pack/build_assets.py
```

It rewrites `files/surveillance_frame.png`, `files/checker.py` and prints the new
payloads for challenges 1 and 5 (paste them into `pack.json`). For challenge 4
change `TRAINING_WEB_FLAG` in `.env` to match.
