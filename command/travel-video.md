---
description: Bootstrap a polished Remotion travel video from a folder of trip photos/videos. Asks for trip details interactively, generates all code including map animations, photo/video picker, and render pipeline.
allowed-tools: Bash, Read, Write, Edit
---

You are helping the user create a polished 5-minute 1080p travel video using Remotion.

The skill template lives at: `SKILL_TEMPLATE_PATH`
Reference implementation (Tonsai 2026): `/Users/redpanda/Downloads/Tonsai/tonsai-video/`

## What you'll build
- Animated intro/outro title cards (Montserrat 900 font)
- Per-day sequences: hollow zoom-punch title card → Ken Burns photos → trimmed video clips
- Optional: animated map scenes (MapLibre + CARTO free tiles, no API key)
- Interactive GUI picker: select photos/videos + drag to set mixed playback sequence
- Auto portrait detection (contain + letterbox vs landscape cover)

---

## STEP 1 — Ask basics (wait for answers before continuing)

Ask these questions together:

```
1. Trip name (e.g. "Ladakh 2027") — used in title and folder
2. Media source folder — full path to flat folder of HEIC/JPG/MOV/MP4
3. Output project folder — where to create the Remotion project
4. Trip dates for intro card (e.g. "Jul – Aug 2027")
5. Subtitle / adventure type (e.g. "A HIMALAYAN MOTORCYCLE JOURNEY")
6. Destination name in ALL CAPS for big intro title (e.g. "LADAKH")
7. Location badge (e.g. "34°0'N · 77°34'E · LADAKH, INDIA")
8. Outro closing line (e.g. "See you on the road.")
9. Outro location tag (e.g. "LEH · LADAKH · INDIA")
10. Stats line (e.g. "12 days · 280 photos · countless memories")
11. Music MP3 path (or skip — add later as public/music/track.mp3)
```

---

## STEP 2 — Ask about map journeys

Say:
> Map animations are optional. They show animated travel routes (✈ flight / 🚗 car / ⛵ boat) on a dark world map with city icons. Do you want map scenes?
>
> If yes, describe each journey like:
> ```
> Journey 1 (Arrival): Delhi → [flight] → Leh → [car] → Nubra Valley
> Journey 2 (Mid-trip): Nubra Valley → [car] → Pangong Lake
> Journey 3 (Departure): Pangong Lake → [car] → Leh → [flight] → Delhi
> ```
> For each city, provide approximate GPS coordinates [lng, lat].
> Which date (YYYY-MM-DD) does each journey appear BEFORE in the video?
> Does the departure journey appear AFTER the last day?

---

## STEP 3 — Scan media dates

Run this bash command using the user's media source path:

```bash
python3 -c "
import subprocess, json, exifread
from pathlib import Path

SRC = Path('USER_MEDIA_PATH')
dates = {}
files = [f for f in sorted(SRC.iterdir()) if f.suffix.lower() in ['.heic','.jpg','.jpeg','.png','.mov','.mp4']]
total = len(files)
for i, f in enumerate(files):
    print(f'\r  {(i+1)*100//total:3d}% [{i+1}/{total}] {f.name:<45}', end='', flush=True)
    suf = f.suffix.lower()
    date = None
    if suf in ['.heic','.jpg','.jpeg','.png']:
        try:
            with open(f,'rb') as fp:
                tags = exifread.process_file(fp, stop_tag='EXIF DateTimeOriginal', details=False)
                d = str(tags.get('EXIF DateTimeOriginal',''))
                if d and d != 'None': date = d[:10].replace(':','-')
        except: pass
    elif suf in ['.mov','.mp4']:
        r = subprocess.run(['ffprobe','-v','quiet','-print_format','json','-show_format',str(f)], capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)
            tags = data.get('format',{}).get('tags',{})
            ct = tags.get('com.apple.quicktime.creationdate') or tags.get('creation_time','')
            if ct: date = ct[:10]
        except: pass
    if date: dates[date] = dates.get(date, 0) + 1
print(f'\r  Done.{\" \"*60}')
for d in sorted(dates): print(f'  {d}: {dates[d]} files')
"
```

Show the user the dates found. Ask them to provide a short label for each date (what they did that day).

---

## STEP 4 — Create the project

```bash
# 1. Create Remotion project
npx create-video@latest --yes --blank --no-tailwind "USER_OUT_PATH"
cd "USER_OUT_PATH"

# 2. Install dependencies
npm install --save @remotion/transitions @remotion/media @remotion/google-fonts

# 3. If map scenes requested:
npm install --save maplibre-gl @turf/turf
npm install --save-dev @types/maplibre-gl

# 4. Create dirs
mkdir -p src/{components,scenes/map,data} scripts public/{media/jpg,music}
```

---

## STEP 5 — Copy template files

Copy these verbatim from `SKILL_TEMPLATE_PATH`:

**Generic — copy as-is:**
- `src/components/KenBurnsPhoto.tsx`
- `src/components/VideoClip.tsx`
- `src/components/DayTitleCard.tsx`
- `src/scenes/DayScene.tsx`
- `src/scenes/map/JourneyMap.tsx`
- `src/scenes/map/CityOverlay.tsx`
- `scripts/picker.py` — update these 3 paths at the top:
  - `SRC_DIR` → user's media source folder
  - `JPG_DIR` → `<project>/public/media/jpg`
  - `MANIFEST` → `<project>/src/data/mediaManifest.ts`

**Customize per trip:**
- `src/scenes/IntroScene.tsx` — fill TRIP_TITLE, TRIP_SUBTITLE, TRIP_DATES, LOCATION_BADGE
- `src/scenes/OutroScene.tsx` — fill CLOSING_LINE, LOCATION_TAG, STATS_LINE
- `src/TripVideo.tsx` — fill MAP_BEFORE dates and MAP_AFTER_DATE
- `src/Root.tsx` — adjust map composition imports if different journey count

**Generate fresh:**
- `src/scenes/map/mapData.ts` — generate with user's actual cities/legs
- `src/scenes/map/JourneyArrival.tsx`, `JourneyDeparture.tsx`, etc. — one per journey
- `scripts/generateManifest.py` — fill SRC path and DAY_ITINERARY from Step 3

---

## STEP 6 — Generate mapData.ts (if maps requested)

For each city the user mentioned, look up or use their provided coordinates.
Generate `src/scenes/map/mapData.ts` with:

```typescript
export type TransportMode = "flight" | "car" | "boat";
export interface Leg { from: string; to: string; fromCoord: [number,number]; toCoord: [number,number]; mode: TransportMode; durationS: number; }
export interface CityInfo { name: string; coord: [number,number]; emoji: string; landmark: string; }

export const CITIES: Record<string, CityInfo> = {
  // one entry per city, key = lowercase no spaces
  citykey: { name: "City Name", coord: [lng, lat], emoji: "🏔️", landmark: "Famous Landmark" },
};

export const JOURNEY_1: Leg[] = [ /* arrival legs */ ];
// ... more journeys

export const MODE_COLORS = { flight: "#f0a500", car: "#4fc3f7", boat: "#80cbc4" };
export const MODE_DASH   = { flight: [8,6], car: [1,0], boat: [3,5] };
```

For `CityOverlay.tsx` SVG icons — adapt based on destination character:
- Mountains → stylized peaks (triangles)
- Beach/island → palm tree + wave
- City → building silhouette / dome
- Keep the bounce-in: `Easing.bezier(0.34, 1.56, 0.64, 1)` scale 0→1 over 20 frames

---

## STEP 7 — Convert media and generate manifest

```bash
cd "USER_OUT_PATH"

# Convert HEIC → JPG, copy all media
DST="public/media/jpg"
for f in "USER_MEDIA_PATH"/*.HEIC "USER_MEDIA_PATH"/*.heic; do
  [ -f "$f" ] || continue
  name=$(basename "${f%.*}")
  [ -f "$DST/$name.jpg" ] && continue
  ffmpeg -i "$f" -update 1 -frames:v 1 "$DST/$name.jpg" -y -loglevel error
  echo "  converted: $name.jpg"
done
for ext in jpg JPG jpeg JPEG png PNG mov MOV mp4 MP4; do
  cp "USER_MEDIA_PATH"/*.$ext "$DST/" 2>/dev/null || true
done

# Copy music (if provided)
# cp "USER_MUSIC_PATH" public/music/track.mp3

# Generate manifest
python3 scripts/generateManifest.py

# Patch portrait orientations
python3 scripts/patch-orientations.py
```

Copy `scripts/patch-orientations.py` from `SKILL_TEMPLATE_PATH/scripts/patch-orientations.py`.

---

## STEP 8 — Tell user what's next

```
✅ Project ready at: USER_OUT_PATH

Workflow:
  1. Pick best photos + videos per day:
       python3 scripts/picker.py
     📷 Photos tab: click to select/deselect
     🎬 Videos tab: click to pick (max 3)
     📋 Sequence tab: drag to set mixed playback order (interleave photos + videos freely)

  2. Preview:
       npx remotion studio   →   http://localhost:3000

  3. Render:
       node_modules/.bin/remotion render TripVideo --gl=swangle --output out/trip.mp4
     If WebGL error: try --gl=angle instead of --gl=swangle

Key notes:
  - Portrait photos auto-detected → shown full-frame with dark letterbox
  - Music loops automatically with 2s fade-in + 3s fade-out
  - Map scenes use MapLibre + CARTO free tiles (no API key needed)
  - Run python3 scripts/patch-orientations.py after any picker changes
```

---

## STEP 9 — Ask about output size / compression

After render completes (or if user asks about file size), say:

> The raw Remotion render is typically **1–2 GB** for a 5-minute 1080p video.
> For sharing/uploading (Google Photos, Drive, WhatsApp), you'll want to compress it.
>
> **How will you share this video?** Pick a target:
>
> | Target | CRF | Est. size (5 min) | Quality |
> |--------|-----|-------------------|---------|
> | Archive / master copy | 18 | ~600–900 MB | Near-lossless |
> | Google Photos / Drive | 23 | ~150–300 MB | Excellent |
> | WhatsApp / Telegram | 28 | ~60–120 MB | Good |
> | Email / web embed | 32 | ~30–60 MB | Acceptable |
>
> Which target do you want? (or enter a custom CRF 18–32)

Once user picks, offer **both options**:

**Option A — Re-render directly at target quality** (best — single step, no re-encode loss):
```bash
node_modules/.bin/remotion render TripVideo --gl=swangle \
  --codec=h264 --crf=CRF_VALUE \
  --output out/trip-compressed.mp4
```
*Slower (full render), but maximum quality for the file size.*

**Option B — Compress existing render with ffmpeg** (faster — 2–3 min, tiny quality loss):
```bash
ffmpeg -i out/trip.mp4 \
  -c:v libx264 -crf CRF_VALUE -preset slow \
  -c:a aac -b:a 192k \
  out/trip-compressed.mp4
```
*Recommended if render already done and took a long time.*

Fill in `CRF_VALUE` from the table above based on user's choice.

Note: Google Photos re-encodes on upload anyway — CRF 23 is the sweet spot for it.

---

## Critical patterns (never break these)

- `TransitionSeries` needs **flat** `React.ReactNode[]` — never use Fragment + `.map()`; build arrays with helper functions
- `useDelayRender` must be called at **component scope**, not inside useState
- MapLibre import: `import maplibregl from "maplibre-gl"` (not mapbox-gl)
- Map style: `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json`
- Portrait photos: `objectFit: "contain"`, scale `0.85→0.95`, bg `#0a0a0f`
- Landscape photos: `objectFit: "cover"`, scale `1.0→1.18`
- Hollow title: `WebkitTextFillColor: transparent` + `backgroundClip: text` + `backgroundImage: url(photo)`
- Title exit: text scale `1→12x` + overlay fade + next photo punch-through
- `day.sequence[]` drives playback order — photos and videos interleaved freely; falls back to photos-then-videos if absent
- `SequenceItem`: `{type: "photo"|"video", file, isPortrait?, trimDuration?, duration?}`
