"""
Regenerates the synthetic attachments for the VOID//CTF starter pack.

Everything here is fictional training data created from scratch. Run it only if
you change a flag; the generated files are already committed in ./files.

    python challenges/starter-pack/build_assets.py
"""

import base64
import random
import struct
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
FILES = HERE / "files"

# Keep these in sync with pack.json
FLAG_METADATA = "flag{example_metadata_never_lies}"
FLAG_REVERSE = "flag{example_xor_is_reversible}"
FLAG_ENCODING = "flag{example_layered_encoding}"
FLAG_KEYPAD = "flag{example_keypad_signals}"


# --- Digital forensics: PNG with a flag in a tEXt chunk -----------------------
def png_chunk(kind: bytes, data: bytes) -> bytes:
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def build_png(path: Path) -> None:
    rng = random.Random(1337)
    w, h = 160, 96
    rows = []
    for y in range(h):
        row = bytearray([0])  # filter type 0
        for x in range(w):
            # dim green "camera noise" with a horizon line
            base = 30 if y < 60 else 12
            g = min(255, base + rng.randint(0, 40) + (90 if y in (60, 61) else 0))
            row += bytes([g // 4, g, g // 3])
        rows.append(bytes(row))
    raw = b"".join(rows)

    png = b"\x89PNG\r\n\x1a\n"
    png += png_chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    png += png_chunk(b"tEXt", b"Software\x00NightOwl CCTV v2.3 (fictional)")
    png += png_chunk(b"tEXt", b"Location\x00Dock 7, Saltmere (fictional)")
    png += png_chunk(b"tEXt", b"Comment\x00operator note: " + FLAG_METADATA.encode())
    png += png_chunk(b"IDAT", zlib.compress(raw, 9))
    png += png_chunk(b"IEND", b"")
    path.write_bytes(png)


# --- Reverse engineering: XOR "crackme" ---------------------------------------
def build_crackme(path: Path) -> None:
    key = b"V01D"
    enc = bytes(b ^ key[i % len(key)] for i, b in enumerate(FLAG_REVERSE.encode()))
    path.write_text(
        '''#!/usr/bin/env python3
"""VOID//CTF training crackme. Fictional, harmless, runs offline.
Usage: python checker.py <password>"""
import sys

_K = bytes([0x56, 0x30, 0x31, 0x44])
_S = bytes.fromhex("%s")


def _unwrap(blob):
    return bytes(b ^ _K[i %% len(_K)] for i, b in enumerate(blob))


def check(candidate: str) -> bool:
    return candidate.encode() == _unwrap(_S)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    print("ACCESS GRANTED" if check(sys.argv[1]) else "ACCESS DENIED")
'''
        % enc.hex(),
        encoding="utf-8",
    )


# --- Encoding: base64(hex(flag)) -----------------------------------------------
def encoded_flag() -> str:
    return base64.b64encode(FLAG_ENCODING.encode().hex().encode()).decode()


# --- Logic: phone keypad multi-tap --------------------------------------------
KEYPAD = {
    "2": "abc", "3": "def", "4": "ghi", "5": "jkl",
    "6": "mno", "7": "pqrs", "8": "tuv", "9": "wxyz",
}


def multitap(text: str) -> str:
    out = []
    for ch in text:
        if ch == "_":
            out.append("0")
            continue
        for key, letters in KEYPAD.items():
            if ch in letters:
                out.append(key * (letters.index(ch) + 1))
    return " ".join(out)


if __name__ == "__main__":
    FILES.mkdir(exist_ok=True)
    build_png(FILES / "surveillance_frame.png")
    build_crackme(FILES / "checker.py")
    inner = FLAG_KEYPAD[len("flag{"):-1]
    print("encoding challenge payload:", encoded_flag())
    print("keypad challenge payload:  ", multitap(inner))
