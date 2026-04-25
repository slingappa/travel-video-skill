#!/usr/bin/env python3
"""
Interactive photo+video picker for Tonsai video manifest.

📷 Photos tab  — click grid to select/deselect
🎬 Videos tab  — click grid to select (max 3)
📋 Sequence tab — drag to set the playback order mixing photos + videos

Save & Next → saves current day, moves to next.
Save All & Quit → writes manifest, exits.
"""
import tkinter as tk
from tkinter import ttk
from PIL import Image, ImageTk, ImageDraw
import json, re, subprocess, tempfile
from pathlib import Path

SRC_DIR  = Path("/Users/redpanda/Downloads/Tonsai/Tonsai_sel")
JPG_DIR  = Path("/Users/redpanda/Downloads/Tonsai/tonsai-video/public/media/jpg")
MANIFEST = Path("/Users/redpanda/Downloads/Tonsai/tonsai-video/src/data/mediaManifest.ts")
THUMB_SIZE  = (220, 165)
SEQ_SIZE    = (110, 82)   # sequence strip thumb size
COLS        = 5
MAX_VIDEOS  = 3

THUMB_CACHE_DIR = Path(tempfile.gettempdir()) / "tonsai_video_thumbs"
THUMB_CACHE_DIR.mkdir(exist_ok=True)

# ── Load manifest ──────────────────────────────────────────────
raw   = MANIFEST.read_text()
match = re.search(r'export const DAYS: DayData\[\] = (\[.*?\]);', raw, re.DOTALL)
days  = json.loads(match.group(1))

# ── Scan media ─────────────────────────────────────────────────
import exifread

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
    r = subprocess.run(["ffprobe","-v","quiet","-print_format","json",
                        "-show_format","-show_streams", str(path)],
                       capture_output=True, text=True)
    date, duration = None, 0.0
    try:
        data = json.loads(r.stdout)
        tags = data.get("format",{}).get("tags",{})
        ct = tags.get("com.apple.quicktime.creationdate") or tags.get("creation_time","")
        if ct and ct != "None": date = ct[:10]
        for s in data.get("streams",[]):
            if s.get("codec_type") == "video":
                duration = round(float(s.get("duration",0)), 2); break
    except: pass
    return date, duration

all_photo_files = [f for f in sorted(SRC_DIR.iterdir()) if f.suffix.lower() in ['.jpg','.jpeg','.png','.heic']]
all_video_files = [f for f in sorted(SRC_DIR.iterdir()) if f.suffix.lower() in ['.mov','.mp4']]
total = len(all_photo_files) + len(all_video_files)
print(f"Scanning {total} media files (one-time)...")

date_to_photos: dict[str, list[str]] = {}
date_to_videos: dict[str, list[dict]] = {}

for i, f in enumerate(all_photo_files):
    print(f"\r  {(i+1)*100//total:3d}% {f.name:<45}", end="", flush=True)
    d = get_photo_date(f)
    if d: date_to_photos.setdefault(d, []).append(f.name)

for j, f in enumerate(all_video_files):
    idx = len(all_photo_files) + j + 1
    print(f"\r  {idx*100//total:3d}% {f.name:<45}", end="", flush=True)
    d, dur = get_video_info(f)
    if d: date_to_videos.setdefault(d, []).append({"file": f.name, "duration": dur})

print(f"\r  Done.{' '*60}")


# ── Helpers ────────────────────────────────────────────────────
def extract_video_thumb(video_path: Path) -> Path:
    tp = THUMB_CACHE_DIR / (video_path.stem + "_thumb.jpg")
    if not tp.exists():
        subprocess.run(["ffmpeg","-ss","1","-i",str(video_path),
                        "-frames:v","1","-q:v","3",str(tp),"-y"], capture_output=True)
    return tp

def draw_play(img: Image.Image):
    d = ImageDraw.Draw(img, "RGBA")
    cx, cy = img.width//2, img.height//2
    r = 14
    d.polygon([(cx-r,cy-r),(cx-r,cy+r),(cx+r,cy)], fill=(255,255,255,160))

def load_thumb(src_path: str, size: tuple, is_video=False) -> Image.Image:
    try:
        if is_video:
            load_path = str(extract_video_thumb(Path(src_path)))
        else:
            p = Path(src_path)
            eq = JPG_DIR / (p.stem + ".jpg")
            load_path = str(eq) if eq.exists() else src_path
        img = Image.open(load_path)
        img.thumbnail(size, Image.LANCZOS)
        bg = Image.new("RGB", size, (17,17,17))
        bg.paste(img, ((size[0]-img.width)//2, (size[1]-img.height)//2))
        if is_video: draw_play(bg)
        return bg
    except:
        bg = Image.new("RGB", size, (40,20,20) if is_video else (40,40,40))
        if is_video: draw_play(bg)
        return bg


# ── Drag-reorder panel ─────────────────────────────────────────
class SequencePanel(tk.Frame):
    """
    Full-size draggable sequence panel for mixing photos + videos.
    Items: list of dicts with keys: key, label, thumb_img, badge_color
    on_reorder(new_key_list) called after each drag.
    on_remove(key) called when X button clicked.
    """
    ITEM_W = SEQ_SIZE[0] + 16
    ITEM_H = SEQ_SIZE[1] + 50

    def __init__(self, parent, on_reorder, on_remove, **kwargs):
        super().__init__(parent, bg="#0d0d0d", **kwargs)
        self.on_reorder = on_reorder
        self.on_remove  = on_remove
        self._items: list[dict] = []
        self._drag_idx: int | None = None
        self._drag_x0 = 0
        self._placeholder_idx: int | None = None

        hint = tk.Label(self, text="Drag to reorder  ·  ✕ to remove  ·  Add items in Photos/Videos tabs",
                        bg="#0d0d0d", fg="#555", font=("Helvetica",10))
        hint.pack(pady=4)

        self._canvas = tk.Canvas(self, bg="#0d0d0d", height=self.ITEM_H+10, highlightthickness=0)
        self._canvas.pack(fill="x", padx=8)
        self._inner = tk.Frame(self._canvas, bg="#0d0d0d")
        self._canvas.create_window((0,0), window=self._inner, anchor="nw")
        self._inner.bind("<Configure>", lambda e: self._canvas.configure(scrollregion=self._canvas.bbox("all")))
        self._canvas.bind("<MouseWheel>", lambda e: self._canvas.xview_scroll(-1*(e.delta//120), "units"))
        hsb = ttk.Scrollbar(self, orient="horizontal", command=self._canvas.xview)
        self._canvas.configure(xscrollcommand=hsb.set)
        hsb.pack(fill="x", padx=8)

        self._empty_lbl = tk.Label(self._inner, text="← Select photos/videos in the other tabs to build sequence",
                                   bg="#0d0d0d", fg="#444", font=("Helvetica",13))

    def set_items(self, items: list[dict]):
        self._items = items
        self._rebuild()

    def _rebuild(self):
        for w in self._inner.winfo_children(): w.destroy()
        if not self._items:
            self._empty_lbl = tk.Label(self._inner,
                text="← Select photos/videos in the other tabs, then arrange here",
                bg="#0d0d0d", fg="#444", font=("Helvetica",13))
            self._empty_lbl.pack(padx=20, pady=20)
            return

        for i, item in enumerate(self._items):
            bg_col = "#1e1a00" if item.get('badge_color') == 'photo' else "#001a1a"
            cell = tk.Frame(self._inner, bg=bg_col, padx=3, pady=3,
                            relief="ridge", bd=2, cursor="fleur")
            cell.pack(side="left", padx=5, pady=4)

            # Top row: position badge + type tag + remove btn
            top = tk.Frame(cell, bg=bg_col)
            top.pack(fill="x")
            pos_lbl = tk.Label(top, text=f"#{i+1}", bg="#f0a500", fg="black",
                               font=("Helvetica",9,"bold"), width=3)
            pos_lbl.pack(side="left")
            type_lbl = tk.Label(top, text="📷" if item['badge_color']=='photo' else "🎬",
                                bg=bg_col, font=("Helvetica",10))
            type_lbl.pack(side="left", padx=2)
            rm = tk.Label(top, text="✕", bg=bg_col, fg="#e74c3c",
                          font=("Helvetica",11,"bold"), cursor="hand2")
            rm.pack(side="right")
            rm.bind("<Button-1>", lambda e, k=item['key']: self.on_remove(k))

            # Thumbnail
            img_lbl = tk.Label(cell, image=item['thumb_img'], bg=bg_col)
            img_lbl.image = item['thumb_img']
            img_lbl.pack()

            # Filename
            name_lbl = tk.Label(cell, text=item['label'][:14], bg=bg_col,
                                 fg="#ccc", font=("Helvetica",8))
            name_lbl.pack()

            for w in [cell, img_lbl, name_lbl, top, pos_lbl, type_lbl]:
                w.bind("<ButtonPress-1>",  lambda e, idx=i: self._drag_start(e, idx))
                w.bind("<B1-Motion>",       self._drag_motion)
                w.bind("<ButtonRelease-1>", self._drag_end)

    def _drag_start(self, e, idx):
        self._drag_idx = idx
        self._drag_x0  = e.x_root

    def _drag_motion(self, e):
        if self._drag_idx is None: return
        dx = e.x_root - self._drag_x0
        slot = max(0, min(len(self._items)-1, self._drag_idx + round(dx / self.ITEM_W)))
        if slot != self._placeholder_idx:
            self._placeholder_idx = slot
            # Highlight target
            for i, cell in enumerate(self._inner.winfo_children()):
                try:
                    col = "#f0a500" if i == slot else (
                        "#1e1a00" if self._items[i]['badge_color']=='photo' else "#001a1a")
                    cell.config(bg=col)
                except: pass

    def _drag_end(self, e):
        if self._drag_idx is None: return
        dx = e.x_root - self._drag_x0
        target = max(0, min(len(self._items)-1, self._drag_idx + round(dx / self.ITEM_W)))
        if target != self._drag_idx:
            item = self._items.pop(self._drag_idx)
            self._items.insert(target, item)
            self.on_reorder([it['key'] for it in self._items])
        self._drag_idx = None
        self._placeholder_idx = None
        self._rebuild()


# ── Main Picker ────────────────────────────────────────────────
class Picker(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Tonsai Photo+Video Picker")
        self.configure(bg="#111")
        self.geometry("1240x920")
        self.day_idx = 0

        # photo_selections: date → [manifest_jpg_names in order]
        self.photo_selections: dict[str, list[str]] = {d['date']: list(d['photos']) for d in days}
        # video_selections: date → [{file,duration,trimDuration}]
        self.video_selections: dict[str, list[dict]] = {d['date']: list(d['videos']) for d in days}
        # sequence_selections: date → [{type,key}] where key=manifest_name for photos, fname for videos
        self.sequence_selections: dict[str, list[dict]] = {}
        for d in days:
            if d.get('sequence'):
                self.sequence_selections[d['date']] = [
                    {'type': s['type'], 'key': s['file']} for s in d['sequence']
                ]
            else:
                # build default: photos then videos
                self.sequence_selections[d['date']] = (
                    [{'type':'photo','key':p} for p in d['photos']] +
                    [{'type':'video','key':v['file']} for v in d['videos']]
                )

        self._thumb_cache: dict[str, ImageTk.PhotoImage] = {}
        self._seq_thumb_cache: dict[str, ImageTk.PhotoImage] = {}
        self._build_ui()
        self._load_day()

    # ── UI ────────────────────────────────────────────────────

    def _build_ui(self):
        top = tk.Frame(self, bg="#1a1a2e", pady=8)
        top.pack(fill="x")
        self.day_label = tk.Label(top, text="", font=("Helvetica",16,"bold"), bg="#1a1a2e", fg="#f0a500")
        self.day_label.pack(side="left", padx=16)
        self.sel_label = tk.Label(top, text="", font=("Helvetica",13), bg="#1a1a2e", fg="#aaa")
        self.sel_label.pack(side="left", padx=8)

        bf = tk.Frame(top, bg="#1a1a2e"); bf.pack(side="right", padx=12)
        tk.Button(bf, text="◀ Prev",         command=self._prev,      bg="#333",     fg="white", font=("Helvetica",12), padx=8).pack(side="left", padx=4)
        tk.Button(bf, text="Skip",            command=self._next,      bg="#444",     fg="white", font=("Helvetica",12), padx=8).pack(side="left", padx=4)
        tk.Button(bf, text="Save & Next ▶",   command=self._save_next, bg="#f0a500",  fg="black", font=("Helvetica",12,"bold"), padx=10).pack(side="left", padx=4)
        tk.Button(bf, text="💾 Save All & Quit", command=self._save_all, bg="#2ecc71", fg="black", font=("Helvetica",12,"bold"), padx=10).pack(side="left", padx=4)

        tk.Label(self,
            text="📷/🎬 tabs: click to select  ·  📋 Sequence tab: drag to set playback order",
            bg="#111", fg="#666", font=("Helvetica",11)).pack(pady=3)

        self.notebook = ttk.Notebook(self)
        self.notebook.pack(fill="both", expand=True)

        # Photos tab
        self.photo_tab = tk.Frame(self.notebook, bg="#111")
        self.notebook.add(self.photo_tab, text="📷 Photos")
        self._build_grid_area(self.photo_tab, "photo")

        # Videos tab
        self.video_tab = tk.Frame(self.notebook, bg="#111")
        self.notebook.add(self.video_tab, text="🎬 Videos")
        self._build_grid_area(self.video_tab, "video")

        # Sequence tab
        self.seq_tab = tk.Frame(self.notebook, bg="#0d0d0d")
        self.notebook.add(self.seq_tab, text="📋 Sequence")
        self.seq_panel = SequencePanel(self.seq_tab,
                                       on_reorder=self._on_seq_reorder,
                                       on_remove=self._on_seq_remove)
        self.seq_panel.pack(fill="both", expand=True)

    def _build_grid_area(self, parent, kind):
        container = tk.Frame(parent, bg="#111"); container.pack(fill="both", expand=True)
        canvas = tk.Canvas(container, bg="#111", highlightthickness=0)
        sb = ttk.Scrollbar(container, orient="vertical", command=canvas.yview)
        canvas.configure(yscrollcommand=sb.set)
        sb.pack(side="right", fill="y"); canvas.pack(side="left", fill="both", expand=True)
        gf = tk.Frame(canvas, bg="#111")
        cw = canvas.create_window((0,0), window=gf, anchor="nw")
        gf.bind("<Configure>", lambda e, c=canvas: c.configure(scrollregion=c.bbox("all")))
        canvas.bind("<Configure>", lambda e, c=canvas, w=cw: c.itemconfig(w, width=e.width))
        canvas.bind("<MouseWheel>", lambda e, c=canvas: c.yview_scroll(-1*(e.delta//120),"units"))
        if kind == "photo":
            self.photo_canvas = canvas; self.photo_grid = gf
        else:
            self.video_canvas = canvas; self.video_grid = gf

    # ── Load day ──────────────────────────────────────────────

    def _load_day(self):
        day = days[self.day_idx]
        date = day['date']
        self.day_label.config(text=f"Day {day['dayNum']} · {day['label']}")
        self._load_photos(date)
        self._load_videos(date)
        self._rebuild_seq_panel(date)
        self._update_sel_label()

    # ── Photos grid ───────────────────────────────────────────

    def _load_photos(self, date):
        for w in self.photo_grid.winfo_children(): w.destroy()
        self.photo_canvas.yview_moveto(0)

        all_photos = date_to_photos.get(date, [])
        # Current selected manifest names (from sequence)
        selected_set = {it['key'] for it in self.sequence_selections[date] if it['type']=='photo'}

        self._photo_frames: dict[str, dict] = {}

        for i, fname in enumerate(all_photos):
            mf = Path(fname).stem + ".jpg"
            src = SRC_DIR / fname
            thumb = self._get_thumb(str(src))
            selected = mf in selected_set

            row, col = divmod(i, COLS)
            cell = tk.Frame(self.photo_grid, bg="#111", padx=4, pady=4)
            cell.grid(row=row, column=col, sticky="nsew")
            bc = "#f0a500" if selected else "#333"
            inner = tk.Frame(cell, bg=bc, padx=3, pady=3); inner.pack()
            lbl = tk.Label(inner, image=thumb, bg=bc, cursor="hand2")
            lbl.image = thumb; lbl.pack()
            short = fname[:18]+"…" if len(fname)>20 else fname
            nl = tk.Label(inner, text=short, bg=bc, fg="white", font=("Helvetica",9)); nl.pack()
            # order badge (position in sequence)
            bv = tk.StringVar()
            badge = tk.Label(inner, textvariable=bv, bg="#f0a500", fg="black", font=("Helvetica",10,"bold"), width=2)
            pos = next((j+1 for j,it in enumerate(self.sequence_selections[date]) if it['type']=='photo' and it['key']==mf), None)
            if pos: bv.set(str(pos)); badge.pack()

            self._photo_frames[fname] = {
                'inner':inner,'lbl':lbl,'badge':badge,'badge_var':bv,'name_lbl':nl,
                'manifest_name':mf,'src_path':str(src),
            }
            for w in [lbl,inner,nl]:
                w.bind("<Button-1>", lambda e, f=fname, m=mf: self._toggle_photo(f, m))

    def _toggle_photo(self, fname, manifest_name):
        date = days[self.day_idx]['date']
        seq = self.sequence_selections[date]
        exists = any(it['type']=='photo' and it['key']==manifest_name for it in seq)
        if exists:
            self.sequence_selections[date] = [it for it in seq
                                               if not (it['type']=='photo' and it['key']==manifest_name)]
        else:
            self.sequence_selections[date].append({'type':'photo','key':manifest_name})
        self._refresh_photo_cell(fname, manifest_name)
        self._rebuild_seq_panel(date)
        self._update_sel_label()

    def _refresh_photo_cell(self, fname, manifest_name):
        date = days[self.day_idx]['date']
        seq = self.sequence_selections[date]
        selected = any(it['type']=='photo' and it['key']==manifest_name for it in seq)
        widgets = self._photo_frames.get(fname)
        if not widgets: return
        bc = "#f0a500" if selected else "#333"
        for k in ['inner','lbl','name_lbl']: widgets[k].config(bg=bc)
        pos = next((j+1 for j,it in enumerate(seq) if it['type']=='photo' and it['key']==manifest_name), None)
        if pos:
            widgets['badge_var'].set(str(pos)); widgets['badge'].pack()
        else:
            widgets['badge'].pack_forget()

    def _refresh_all_photo_badges(self):
        date = days[self.day_idx]['date']
        seq  = self.sequence_selections[date]
        for fname, widgets in self._photo_frames.items():
            mf = widgets['manifest_name']
            pos = next((j+1 for j,it in enumerate(seq) if it['type']=='photo' and it['key']==mf), None)
            if pos:
                widgets['badge_var'].set(str(pos)); widgets['badge'].pack()
            else:
                widgets['badge'].pack_forget()
            bc = "#f0a500" if pos else "#333"
            for k in ['inner','lbl','name_lbl']: widgets[k].config(bg=bc)

    # ── Videos grid ───────────────────────────────────────────

    def _load_videos(self, date):
        for w in self.video_grid.winfo_children(): w.destroy()
        self.video_canvas.yview_moveto(0)

        all_videos = date_to_videos.get(date, [])
        selected_set = {it['key'] for it in self.sequence_selections[date] if it['type']=='video'}
        self._video_frames: dict[str, dict] = {}

        if not all_videos:
            tk.Label(self.video_grid, text="No videos for this day.",
                     bg="#111", fg="#555", font=("Helvetica",14)).grid(row=0,column=0,padx=20,pady=40)
            return

        for i, vinfo in enumerate(all_videos):
            fname = vinfo['file']; dur = vinfo['duration']
            src = SRC_DIR / fname
            thumb = self._get_video_thumb(src)
            selected = fname in selected_set

            row, col = divmod(i, COLS)
            cell = tk.Frame(self.video_grid, bg="#111", padx=4, pady=4)
            cell.grid(row=row, column=col, sticky="nsew")
            bc = "#f0a500" if selected else "#333"
            inner = tk.Frame(cell, bg=bc, padx=3, pady=3); inner.pack()
            lbl = tk.Label(inner, image=thumb, bg=bc, cursor="hand2")
            lbl.image = thumb; lbl.pack()
            short = fname[:18]+"…" if len(fname)>20 else fname
            nl = tk.Label(inner, text=f"{short} [{dur:.1f}s]", bg=bc, fg="white", font=("Helvetica",9))
            nl.pack()
            bv = tk.StringVar()
            badge = tk.Label(inner, textvariable=bv, bg="#f0a500", fg="black", font=("Helvetica",10,"bold"), width=2)
            pos = next((j+1 for j,it in enumerate(self.sequence_selections[date]) if it['type']=='video' and it['key']==fname), None)
            if pos: bv.set(str(pos)); badge.pack()

            self._video_frames[fname] = {
                'inner':inner,'lbl':lbl,'badge':badge,'badge_var':bv,'name_lbl':nl,
                'duration':dur,'src_path':str(src),
            }
            for w in [lbl,inner,nl]:
                w.bind("<Button-1>", lambda e, f=fname: self._toggle_video(f))

    def _toggle_video(self, fname):
        date = days[self.day_idx]['date']
        seq = self.sequence_selections[date]
        exists = any(it['type']=='video' and it['key']==fname for it in seq)
        if exists:
            self.sequence_selections[date] = [it for it in seq
                                               if not (it['type']=='video' and it['key']==fname)]
        else:
            # enforce MAX_VIDEOS
            current_vids = [it for it in seq if it['type']=='video']
            if len(current_vids) >= MAX_VIDEOS:
                oldest = current_vids[0]['key']
                self.sequence_selections[date] = [it for it in seq
                                                   if not (it['type']=='video' and it['key']==oldest)]
                self._refresh_video_cell(oldest)
            self.sequence_selections[date].append({'type':'video','key':fname})
        self._refresh_video_cell(fname)
        self._rebuild_seq_panel(date)
        self._update_sel_label()

    def _refresh_video_cell(self, fname):
        date = days[self.day_idx]['date']
        seq = self.sequence_selections[date]
        pos = next((j+1 for j,it in enumerate(seq) if it['type']=='video' and it['key']==fname), None)
        widgets = self._video_frames.get(fname)
        if not widgets: return
        bc = "#f0a500" if pos else "#333"
        for k in ['inner','lbl','name_lbl']: widgets[k].config(bg=bc)
        if pos: widgets['badge_var'].set(str(pos)); widgets['badge'].pack()
        else: widgets['badge'].pack_forget()

    def _refresh_all_video_badges(self):
        date = days[self.day_idx]['date']
        seq  = self.sequence_selections[date]
        for fname, widgets in self._video_frames.items():
            pos = next((j+1 for j,it in enumerate(seq) if it['type']=='video' and it['key']==fname), None)
            bc = "#f0a500" if pos else "#333"
            for k in ['inner','lbl','name_lbl']: widgets[k].config(bg=bc)
            if pos: widgets['badge_var'].set(str(pos)); widgets['badge'].pack()
            else: widgets['badge'].pack_forget()

    # ── Sequence panel ────────────────────────────────────────

    def _rebuild_seq_panel(self, date):
        seq = self.sequence_selections[date]
        vid_map = {v['file']: v for v in date_to_videos.get(date, [])}
        items = []
        for it in seq:
            key = it['key']
            if it['type'] == 'photo':
                # find src_path
                fname = next((f for f,w in self._photo_frames.items() if w['manifest_name']==key), None)
                src = str(SRC_DIR / fname) if fname else ""
                tk_img = self._get_seq_thumb(src, is_video=False)
                label  = Path(key).stem[:14]
                items.append({'key': key, 'thumb_img': tk_img, 'label': label, 'badge_color': 'photo'})
            else:
                src = str(SRC_DIR / key)
                tk_img = self._get_seq_thumb(src, is_video=True)
                dur = vid_map.get(key, {}).get('duration', 0)
                items.append({'key': key, 'thumb_img': tk_img, 'label': f"{Path(key).stem[:10]} {dur:.1f}s", 'badge_color': 'video'})
        self.seq_panel.set_items(items)

    def _on_seq_reorder(self, new_keys: list[str]):
        date = days[self.day_idx]['date']
        old_seq = self.sequence_selections[date]
        key_to_item = {it['key']: it for it in old_seq}
        self.sequence_selections[date] = [key_to_item[k] for k in new_keys if k in key_to_item]
        self._refresh_all_photo_badges()
        self._refresh_all_video_badges()
        self._update_sel_label()

    def _on_seq_remove(self, key: str):
        date = days[self.day_idx]['date']
        self.sequence_selections[date] = [it for it in self.sequence_selections[date] if it['key'] != key]
        self._refresh_all_photo_badges()
        self._refresh_all_video_badges()
        self._rebuild_seq_panel(date)
        self._update_sel_label()

    # ── Thumbnail helpers ─────────────────────────────────────

    def _get_thumb(self, path: str) -> ImageTk.PhotoImage:
        if path not in self._thumb_cache:
            self._thumb_cache[path] = ImageTk.PhotoImage(load_thumb(path, THUMB_SIZE, is_video=False))
        return self._thumb_cache[path]

    def _get_video_thumb(self, video_path: Path) -> ImageTk.PhotoImage:
        key = str(video_path)
        if key not in self._thumb_cache:
            self._thumb_cache[key] = ImageTk.PhotoImage(load_thumb(key, THUMB_SIZE, is_video=True))
        return self._thumb_cache[key]

    def _get_seq_thumb(self, path: str, is_video: bool) -> ImageTk.PhotoImage:
        key = f"seq::{'vid' if is_video else 'ph'}::{path}"
        if key not in self._seq_thumb_cache:
            self._seq_thumb_cache[key] = ImageTk.PhotoImage(load_thumb(path, SEQ_SIZE, is_video=is_video))
        return self._seq_thumb_cache[key]

    # ── Sel label ─────────────────────────────────────────────

    def _update_sel_label(self):
        date = days[self.day_idx]['date']
        seq  = self.sequence_selections[date]
        np   = sum(1 for it in seq if it['type']=='photo')
        nv   = sum(1 for it in seq if it['type']=='video')
        self.sel_label.config(text=f"{np} photos · {nv} videos · {len(seq)} total in sequence")

    # ── Save / nav ────────────────────────────────────────────

    def _save_current(self):
        date = days[self.day_idx]['date']
        seq  = self.sequence_selections[date]

        # Derive photos/videos arrays from sequence (for backwards compat)
        photo_keys = [it['key'] for it in seq if it['type']=='photo']
        video_keys = [it['key'] for it in seq if it['type']=='video']

        self.photo_selections[date] = photo_keys

        # Portrait orientations
        orientations = []
        for mf in photo_keys:
            try:
                with Image.open(JPG_DIR / mf) as img:
                    orientations.append(img.size[1] > img.size[0])
            except: orientations.append(False)

        # Video dicts
        vid_map = {v['file']: v for v in date_to_videos.get(date, [])}
        new_vids = [
            {"file": f, "duration": vid_map[f]['duration'], "trimDuration": min(vid_map[f]['duration'], 6.0)}
            for f in video_keys if f in vid_map
        ]
        self.video_selections[date] = new_vids

        # Build sequence array for manifest
        vid_info = {v['file']: v for v in new_vids}
        ph_orient = dict(zip(photo_keys, orientations))
        sequence_out = []
        for it in seq:
            if it['type'] == 'photo':
                sequence_out.append({
                    "type": "photo",
                    "file": it['key'],
                    "isPortrait": ph_orient.get(it['key'], False),
                })
            else:
                vi = vid_info.get(it['key'], {})
                sequence_out.append({
                    "type": "video",
                    "file": it['key'],
                    "trimDuration": vi.get('trimDuration', 6.0),
                    "duration": vi.get('duration', 0.0),
                })

        for day in days:
            if day['date'] == date:
                day['photos']           = photo_keys
                day['photoOrientations'] = orientations
                day['videos']           = new_vids
                day['sequence']         = sequence_out
                break

    def _save_next(self):
        self._save_current(); self._next()

    def _next(self):
        if self.day_idx < len(days)-1:
            self.day_idx += 1; self._load_day()

    def _prev(self):
        if self.day_idx > 0:
            self.day_idx -= 1; self._load_day()

    def _save_all(self):
        self._save_current(); self._write_manifest(); self.destroy()

    def _write_manifest(self):
        new_json = json.dumps(days, indent=2)
        new_raw = re.sub(
            r'(export const DAYS: DayData\[\] = )(\[.*?\]);',
            lambda m: m.group(1) + new_json + ';',
            raw, flags=re.DOTALL,
        )
        MANIFEST.write_text(new_raw)
        print(f"✅ Manifest saved — {MANIFEST}")
        for day in days:
            seq = day.get('sequence', [])
            print(f"  {day['date']} Day {day['dayNum']}: {len(seq)} items in sequence")


if __name__ == "__main__":
    app = Picker()
    app.mainloop()
