#!/usr/bin/env python3
"""
Detect portrait photos and patch photoOrientations into mediaManifest.ts.
Run from project root after generateManifest.py or picker.py.

Usage: python3 scripts/patch-orientations.py
"""
from PIL import Image
from pathlib import Path
import json, re

JPG_DIR  = Path("public/media/jpg")
MANIFEST = Path("src/data/mediaManifest.ts")

raw = MANIFEST.read_text()
match = re.search(r'export const DAYS: DayData\[\] = (\[.*?\]);', raw, re.DOTALL)
days = json.loads(match.group(1))

for day in days:
    orientations = []
    for photo in day["photos"]:
        try:
            with Image.open(JPG_DIR / photo) as img:
                w, h = img.size
                orientations.append(h > w)
        except Exception:
            orientations.append(False)
    day["photoOrientations"] = orientations

new_json = json.dumps(days, indent=2)
new_raw = re.sub(
    r'(export const DAYS: DayData\[\] = )(\[.*?\]);',
    lambda m: m.group(1) + new_json + ';',
    raw, flags=re.DOTALL,
)
MANIFEST.write_text(new_raw)
print(f"✅ photoOrientations patched for {len(days)} days in {MANIFEST}")
