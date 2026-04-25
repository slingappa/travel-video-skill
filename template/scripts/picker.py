#!/usr/bin/env python3
"""
Interactive photo+video picker for Tonsai video manifest.

Photos tab:
- Shows all photos for each day in a scrollable grid
- Click to select/deselect (gold border = selected, number = order)
- Arrow keys or buttons to navigate days

Videos tab:
- Shows all videos for current day with thumbnail + duration badge
- Click to select/deselect (gold border = selected)
- Thumbnails extracted via ffmpeg to a temp dir on first load

'Save & Next' writes selection and moves to next day.
'Save All & Quit' writes manifest and exits.
"""
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk
import json, re, os, subprocess, tempfile
from pathlib import Path

SRC_DIR = Path("/Users/redpanda/Downloads/Tonsai/Tonsai_sel")
JPG_DIR = Path("/Users/redpanda/Downloads/Tonsai/tonsai-video/public/media/jpg")
MANIFEST = Path("/Users/redpanda/Downloads/Tonsai/tonsai-video/src/data/mediaManifest.ts")
THUMB_SIZE = (220, 165)
COLS = 5
MAX_VIDEOS = 3  # max selectable per day

THUMB_CACHE_DIR = Path(tempfile.gettempdir()) / "tonsai_video_thumbs"
THUMB_CACHE_DIR.mkdir(exist_ok=True)

# ── Load manifest ─────────────────────────────────────────────
raw = MANIFEST.read_text()
match = re.search(r'export const DAYS: DayData\[\] = (\[.*?\]);', raw, re.DOTALL)
days = json.loads(match.group(1))

# ── Scan photos by date ───────────────────────────────────────
import exifread
from datetime import datetime

def get_photo_date(path):
    try:
        with open(path, 'rb') as f:
            tags = exifread.process_file(f, stop_tag='EXIF DateTimeOriginal', details=False)
            d = str(tags.get('EXIF DateTimeOriginal', ''))
            if d and d != 'None':
                return d[:10].replace(':', '-')
    except: pass
    return None

def get_video_info(path):
    """Returns (date_str, duration_float) via ffprobe."""
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json",
         "-show_format", "-show_streams", str(path)],
        capture_output=True, text=True
    )
    date = None
    duration = 0.0
    try:
        data = json.loads(r.stdout)
        tags = data.get("format", {}).get("tags", {})
        ct = tags.get("com.apple.quicktime.creationdate") or tags.get("creation_time", "")
        if ct and ct != "None":
            date = ct[:10]
        for s in data.get("streams", []):
            if s.get("codec_type") == "video":
                duration = round(float(s.get("duration", 0)), 2)
                break
    except: pass
    return date, duration

all_photo_files = [f for f in sorted(SRC_DIR.iterdir())
                   if f.suffix.lower() in ['.jpg', '.jpeg', '.png', '.heic']]
all_video_files = [f for f in sorted(SRC_DIR.iterdir())
                   if f.suffix.lower() in ['.mov', '.mp4']]

total = len(all_photo_files) + len(all_video_files)
print(f"Scanning {total} media files by date (one-time, please wait)...")

date_to_photos: dict[str, list[str]] = {}
date_to_videos: dict[str, list[dict]] = {}  # {file, duration}

for i, f in enumerate(all_photo_files):
    pct = (i + 1) * 100 // total
    print(f"\r  {pct:3d}% [{i+1}/{total}] {f.name:<40}", end="", flush=True)
    d = get_photo_date(f)
    if d:
        date_to_photos.setdefault(d, []).append(f.name)

for j, f in enumerate(all_video_files):
    idx = len(all_photo_files) + j + 1
    pct = idx * 100 // total
    print(f"\r  {pct:3d}% [{idx}/{total}] {f.name:<40}", end="", flush=True)
    d, dur = get_video_info(f)
    if d:
        date_to_videos.setdefault(d, []).append({"file": f.name, "duration": dur})

print(f"\r  Done — {len(all_photo_files)} photos, {len(all_video_files)} videos scanned.{' '*30}")


def extract_video_thumb(video_path: Path) -> Path:
    """Extract frame at 1s into video, cache as jpg. Returns thumb path."""
    thumb_path = THUMB_CACHE_DIR / (video_path.stem + "_thumb.jpg")
    if not thumb_path.exists():
        subprocess.run(
            ["ffmpeg", "-ss", "1", "-i", str(video_path),
             "-frames:v", "1", "-q:v", "3", str(thumb_path), "-y"],
            capture_output=True
        )
    return thumb_path


# ── GUI ───────────────────────────────────────────────────────
class Picker(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Tonsai Photo+Video Picker")
        self.configure(bg="#111")
        self.geometry("1200x860")
        self.day_idx = 0
        self.photo_selections: dict[str, list[str]] = {d['date']: list(d['photos']) for d in days}
        # video_selections stores list of dicts: {file, duration, trimDuration}
        self.video_selections: dict[str, list[dict]] = {d['date']: list(d['videos']) for d in days}
        self._thumb_cache: dict[str, ImageTk.PhotoImage] = {}
        self._build_ui()
        self._load_day()

    def _build_ui(self):
        # Top bar
        top = tk.Frame(self, bg="#1a1a2e", pady=8)
        top.pack(fill="x")
        self.day_label = tk.Label(top, text="", font=("Helvetica", 16, "bold"),
                                   bg="#1a1a2e", fg="#f0a500")
        self.day_label.pack(side="left", padx=16)
        self.sel_label = tk.Label(top, text="", font=("Helvetica", 13),
                                   bg="#1a1a2e", fg="#aaa")
        self.sel_label.pack(side="left", padx=8)

        btn_frame = tk.Frame(top, bg="#1a1a2e")
        btn_frame.pack(side="right", padx=12)
        tk.Button(btn_frame, text="◀ Prev", command=self._prev,
                  bg="#333", fg="white", font=("Helvetica", 12), padx=8).pack(side="left", padx=4)
        tk.Button(btn_frame, text="Skip", command=self._next,
                  bg="#444", fg="white", font=("Helvetica", 12), padx=8).pack(side="left", padx=4)
        tk.Button(btn_frame, text="Save & Next ▶", command=self._save_next,
                  bg="#f0a500", fg="black", font=("Helvetica", 12, "bold"), padx=10).pack(side="left", padx=4)
        tk.Button(btn_frame, text="💾 Save All & Quit", command=self._save_all,
                  bg="#2ecc71", fg="black", font=("Helvetica", 12, "bold"), padx=10).pack(side="left", padx=4)

        # Hint
        hint = tk.Label(self, text="Click to select/deselect  ·  Gold border = selected  ·  Photos: order = click order  ·  Videos: max 3",
                        bg="#111", fg="#666", font=("Helvetica", 11))
        hint.pack(pady=4)

        # Tabs
        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True)

        # Photos tab
        self.photo_tab = tk.Frame(self.notebook, bg="#111")
        self.notebook.add(self.photo_tab, text="📷 Photos")
        self._build_scroll_area(self.photo_tab, "photo")

        # Videos tab
        self.video_tab = tk.Frame(self.notebook, bg="#111")
        self.notebook.add(self.video_tab, text="🎬 Videos")
        self._build_scroll_area(self.video_tab, "video")

    def _build_scroll_area(self, parent, kind):
        container = tk.Frame(parent, bg="#111")
        container.pack(fill="both", expand=True)
        canvas = tk.Canvas(container, bg="#111", highlightthickness=0)
        scrollbar = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=scrollbar.set)
        scrollbar.pack(side="right", fill="y")
        canvas.pack(side="left", fill="both", expand=True)
        grid_frame = tk.Frame(canvas, bg="#111")
        canvas_window = canvas.create_window((0, 0), window=grid_frame, anchor="nw")
        grid_frame.bind("<Configure>", lambda e, c=canvas: c.configure(scrollregion=c.bbox("all")))
        canvas.bind("<Configure>", lambda e, c=canvas, cw=canvas_window: c.itemconfig(cw, width=e.width))
        canvas.bind("<MouseWheel>", lambda e, c=canvas: c.yview_scroll(-1*(e.delta//120), "units"))

        if kind == "photo":
            self.photo_canvas = canvas
            self.photo_grid = grid_frame
        else:
            self.video_canvas = canvas
            self.video_grid = grid_frame

    def _load_day(self):
        day = days[self.day_idx]
        date = day['date']
        self.day_label.config(text=f"Day {day['dayNum']} · {day['label']}")
        self._load_photos(date)
        self._load_videos(date)
        self._update_sel_label()

    def _load_photos(self, date):
        for w in self.photo_grid.winfo_children():
            w.destroy()
        self.photo_canvas.yview_moveto(0)

        all_photos = date_to_photos.get(date, [])
        current_sel = self.photo_selections[date]

        self._photo_frames: dict[str, dict] = {}
        self._fname_for_manifest: dict[str, str] = {}
        self._selected_order: list[str] = list(current_sel)

        for i, fname in enumerate(all_photos):
            src_path = SRC_DIR / fname
            manifest_name = Path(fname).stem + ".jpg"
            self._fname_for_manifest[fname] = manifest_name

            thumb = self._get_thumb(str(src_path))
            selected = manifest_name in self._selected_order

            row, col = divmod(i, COLS)
            cell = tk.Frame(self.photo_grid, bg="#111", padx=4, pady=4)
            cell.grid(row=row, column=col, sticky="nsew")

            border_color = "#f0a500" if selected else "#333"
            inner = tk.Frame(cell, bg=border_color, padx=3, pady=3)
            inner.pack()

            lbl = tk.Label(inner, image=thumb, bg=border_color, cursor="hand2")
            lbl.image = thumb
            lbl.pack()

            short = fname[:18] + "…" if len(fname) > 20 else fname
            name_lbl = tk.Label(inner, text=short, bg=border_color,
                                 fg="white", font=("Helvetica", 9))
            name_lbl.pack()

            badge_var = tk.StringVar()
            badge = tk.Label(inner, textvariable=badge_var,
                             bg="#f0a500", fg="black", font=("Helvetica", 10, "bold"), width=2)
            if selected:
                idx = self._selected_order.index(manifest_name) + 1
                badge_var.set(str(idx))
                badge.pack()

            self._photo_frames[fname] = {
                'inner': inner, 'lbl': lbl, 'badge': badge,
                'badge_var': badge_var, 'name_lbl': name_lbl,
                'manifest_name': manifest_name,
            }

            def on_click(f=fname, mf=manifest_name):
                self._toggle_photo(f, mf)

            lbl.bind("<Button-1>", lambda e, f=fname, mf=manifest_name: on_click(f, mf))
            inner.bind("<Button-1>", lambda e, f=fname, mf=manifest_name: on_click(f, mf))
            name_lbl.bind("<Button-1>", lambda e, f=fname, mf=manifest_name: on_click(f, mf))

    def _load_videos(self, date):
        for w in self.video_grid.winfo_children():
            w.destroy()
        self.video_canvas.yview_moveto(0)

        all_videos = date_to_videos.get(date, [])
        current_sel_files = {v['file'] for v in self.video_selections[date]}

        self._video_frames: dict[str, dict] = {}
        self._video_selected: list[str] = [v['file'] for v in self.video_selections[date]]

        if not all_videos:
            tk.Label(self.video_grid, text="No videos for this day.",
                     bg="#111", fg="#555", font=("Helvetica", 14)).grid(row=0, column=0, padx=20, pady=40)
            return

        for i, vinfo in enumerate(all_videos):
            fname = vinfo['file']
            duration = vinfo['duration']
            src_path = SRC_DIR / fname
            selected = fname in current_sel_files

            # Extract thumbnail
            thumb = self._get_video_thumb(src_path)

            row, col = divmod(i, COLS)
            cell = tk.Frame(self.video_grid, bg="#111", padx=4, pady=4)
            cell.grid(row=row, column=col, sticky="nsew")

            border_color = "#f0a500" if selected else "#333"
            inner = tk.Frame(cell, bg=border_color, padx=3, pady=3)
            inner.pack()

            lbl = tk.Label(inner, image=thumb, bg=border_color, cursor="hand2")
            lbl.image = thumb
            lbl.pack()

            # Filename + duration
            short = fname[:18] + "…" if len(fname) > 20 else fname
            dur_str = f"{duration:.1f}s"
            name_lbl = tk.Label(inner, text=f"{short}  [{dur_str}]", bg=border_color,
                                 fg="white", font=("Helvetica", 9))
            name_lbl.pack()

            # Selection badge (order number)
            badge_var = tk.StringVar()
            badge = tk.Label(inner, textvariable=badge_var,
                             bg="#f0a500", fg="black", font=("Helvetica", 10, "bold"), width=2)
            if selected:
                idx = self._video_selected.index(fname) + 1
                badge_var.set(str(idx))
                badge.pack()

            self._video_frames[fname] = {
                'inner': inner, 'lbl': lbl, 'badge': badge,
                'badge_var': badge_var, 'name_lbl': name_lbl,
                'duration': duration,
            }

            def on_click(f=fname):
                self._toggle_video(f)

            lbl.bind("<Button-1>", lambda e, f=fname: on_click(f))
            inner.bind("<Button-1>", lambda e, f=fname: on_click(f))
            name_lbl.bind("<Button-1>", lambda e, f=fname: on_click(f))

    # ── Thumbnail helpers ─────────────────────────────────────

    def _get_thumb(self, path: str) -> ImageTk.PhotoImage:
        if path not in self._thumb_cache:
            try:
                p = Path(path)
                jpg_equiv = JPG_DIR / (p.stem + ".jpg")
                load_path = str(jpg_equiv) if jpg_equiv.exists() else path
                img = Image.open(load_path)
                img.thumbnail(THUMB_SIZE, Image.LANCZOS)
                bg = Image.new("RGB", THUMB_SIZE, (17, 17, 17))
                offset = ((THUMB_SIZE[0] - img.width) // 2, (THUMB_SIZE[1] - img.height) // 2)
                bg.paste(img, offset)
                self._thumb_cache[path] = ImageTk.PhotoImage(bg)
            except Exception:
                bg = Image.new("RGB", THUMB_SIZE, (40, 40, 40))
                self._thumb_cache[path] = ImageTk.PhotoImage(bg)
        return self._thumb_cache[path]

    def _get_video_thumb(self, video_path: Path) -> ImageTk.PhotoImage:
        cache_key = str(video_path)
        if cache_key not in self._thumb_cache:
            thumb_path = extract_video_thumb(video_path)
            try:
                img = Image.open(thumb_path)
                img.thumbnail(THUMB_SIZE, Image.LANCZOS)
                bg = Image.new("RGB", THUMB_SIZE, (17, 17, 17))
                offset = ((THUMB_SIZE[0] - img.width) // 2, (THUMB_SIZE[1] - img.height) // 2)
                bg.paste(img, offset)
                # Play button overlay
                draw_play_button(bg)
                self._thumb_cache[cache_key] = ImageTk.PhotoImage(bg)
            except Exception:
                bg = Image.new("RGB", THUMB_SIZE, (30, 20, 20))
                draw_play_button(bg)
                self._thumb_cache[cache_key] = ImageTk.PhotoImage(bg)
        return self._thumb_cache[cache_key]

    # ── Toggle / refresh ──────────────────────────────────────

    def _toggle_photo(self, fname: str, manifest_name: str):
        if manifest_name in self._selected_order:
            self._selected_order.remove(manifest_name)
        else:
            self._selected_order.append(manifest_name)
        self._refresh_photo_cell(fname, manifest_name)
        self._refresh_photo_badges()
        self._update_sel_label()

    def _refresh_photo_cell(self, fname: str, manifest_name: str):
        widgets = self._photo_frames.get(fname)
        if not widgets: return
        selected = manifest_name in self._selected_order
        color = "#f0a500" if selected else "#333"
        for w in ['inner', 'lbl', 'name_lbl']:
            widgets[w].config(bg=color)
        if selected:
            widgets['badge'].pack()
        else:
            widgets['badge'].pack_forget()

    def _refresh_photo_badges(self):
        for fname, widgets in self._photo_frames.items():
            mf = widgets['manifest_name']
            if mf in self._selected_order:
                idx = self._selected_order.index(mf) + 1
                widgets['badge_var'].set(str(idx))

    def _toggle_video(self, fname: str):
        if fname in self._video_selected:
            self._video_selected.remove(fname)
        else:
            if len(self._video_selected) >= MAX_VIDEOS:
                # Deselect oldest (first) to make room
                oldest = self._video_selected.pop(0)
                self._refresh_video_cell(oldest, False)
                self._refresh_video_badges()
            self._video_selected.append(fname)
        selected = fname in self._video_selected
        self._refresh_video_cell(fname, selected)
        self._refresh_video_badges()
        self._update_sel_label()

    def _refresh_video_cell(self, fname: str, selected: bool):
        widgets = self._video_frames.get(fname)
        if not widgets: return
        color = "#f0a500" if selected else "#333"
        for w in ['inner', 'lbl', 'name_lbl']:
            widgets[w].config(bg=color)
        if selected:
            widgets['badge'].pack()
        else:
            widgets['badge'].pack_forget()

    def _refresh_video_badges(self):
        for fname, widgets in self._video_frames.items():
            if fname in self._video_selected:
                idx = self._video_selected.index(fname) + 1
                widgets['badge_var'].set(str(idx))

    def _update_sel_label(self):
        n_photos = len(self._selected_order)
        n_videos = len(self._video_selected)
        self.sel_label.config(text=f"{n_photos} photos · {n_videos} videos selected")

    # ── Navigation / save ─────────────────────────────────────

    def _save_current(self):
        date = days[self.day_idx]['date']
        self.photo_selections[date] = list(self._selected_order)

        # Recompute portrait orientations for current photo order
        orientations = []
        for manifest_name in self._selected_order:
            jpg_path = JPG_DIR / manifest_name
            try:
                from PIL import Image as PILImage
                with PILImage.open(jpg_path) as img:
                    w, h = img.size
                    orientations.append(h > w)
            except Exception:
                orientations.append(False)
        # Store in day dict directly so _write_manifest picks it up
        for day in days:
            if day['date'] == date:
                day['photoOrientations'] = orientations
                break

        # Rebuild video dicts from _video_selected order
        vid_map = {v['file']: v for v in date_to_videos.get(date, [])}
        new_vids = []
        for fname in self._video_selected:
            if fname in vid_map:
                dur = vid_map[fname]['duration']
                new_vids.append({
                    "file": fname,
                    "duration": dur,
                    "trimDuration": min(dur, 6.0),
                })
        self.video_selections[date] = new_vids

    def _save_next(self):
        self._save_current()
        self._next()

    def _next(self):
        if self.day_idx < len(days) - 1:
            self.day_idx += 1
            self._load_day()

    def _prev(self):
        if self.day_idx > 0:
            self.day_idx -= 1
            self._load_day()

    def _save_all(self):
        self._save_current()
        self._write_manifest()
        self.destroy()

    def _write_manifest(self):
        for day in days:
            date = day['date']
            day['photos'] = self.photo_selections.get(date, day['photos'])
            day['videos'] = self.video_selections.get(date, day['videos'])

        new_json = json.dumps(days, indent=2)
        new_raw = re.sub(
            r'(export const DAYS: DayData\[\] = )(\[.*?\]);',
            lambda m: m.group(1) + new_json + ';',
            raw,
            flags=re.DOTALL,
        )
        MANIFEST.write_text(new_raw)
        print(f"✅ Manifest saved — {MANIFEST}")
        for day in days:
            print(f"  {day['date']} Day {day['dayNum']}: {len(day['photos'])} photos, {len(day['videos'])} videos")


def draw_play_button(img: Image.Image):
    """Draw a semi-transparent play triangle in center of PIL image."""
    from PIL import ImageDraw
    draw = ImageDraw.Draw(img, "RGBA")
    cx, cy = img.width // 2, img.height // 2
    r = 20
    triangle = [(cx - r, cy - r), (cx - r, cy + r), (cx + r, cy)]
    draw.polygon(triangle, fill=(255, 255, 255, 160))


if __name__ == "__main__":
    app = Picker()
    app.mainloop()
