#!/usr/bin/env python3
"""VOID//CTF training crackme. Fictional, harmless, runs offline.
Usage: python checker.py <password>"""
import sys

_K = bytes([0x56, 0x30, 0x31, 0x44])
_S = bytes.fromhex("305c50232d5549253b405d2109485e360959421b24554721244358263a554c")


def _unwrap(blob):
    return bytes(b ^ _K[i % len(_K)] for i, b in enumerate(blob))


def check(candidate: str) -> bool:
    return candidate.encode() == _unwrap(_S)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    print("ACCESS GRANTED" if check(sys.argv[1]) else "ACCESS DENIED")
