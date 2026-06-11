# fetch_mat.py — download CC0 material thumbnails (128px) from ambientCG for Mike Render v1.2
# License: ambientCG assets are CC0 — safe to embed/redistribute.
import urllib.request, json, os, sys, time

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "mat")
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 MikeRenderFetch/1.2 (CC0 thumbnail fetch)"}

# (file_id, ambientCG search query)
WANT = [
    ("brick",             "bricks"),
    ("plaster_white",     "plaster"),
    ("concrete_raw",      "concrete wall"),
    ("polished_concrete", "concrete floor"),
    ("stone_cladding",    "stone wall"),
    ("sandstone",         "sandstone"),
    ("wood_siding",       "wood siding"),
    ("fiber_cement",      "concrete panel"),
    ("terrazzo",          "terrazzo"),
    ("paver",             "paving stones"),
    ("gravel",            "gravel"),
    ("wood_deck",         "wood floor"),
    ("granite",           "granite"),
    ("marble",            "marble"),
    ("travertine",        "travertine"),
    ("roof_tiles",        "roofing tiles"),
    ("clay_tiles",        "terracotta"),
    ("metal_sheet",       "corrugated steel"),
    ("shingles",          "shingles"),
    ("metal_black",       "metal painted"),
    ("steel",             "metal plate"),
    ("aluminum",          "metal brushed"),
    ("wood_teak",         "wood fine"),
    ("wood_slats",        "wood planks"),
    ("bamboo",            "bamboo"),
    ("grass",             "grass"),
    ("frosted_glass",     "facade glass"),
    ("asphalt",           "asphalt"),
]

def get_json(url):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=20))

ok, miss = 0, []
for fid, q in WANT:
    dest = os.path.join(OUT, fid + ".png")
    if os.path.exists(dest):
        print(f"SKIP {fid} (exists)"); ok += 1; continue
    try:
        qs = urllib.parse.quote(q)
        d = get_json(f"https://ambientcg.com/api/v2/full_json?q={qs}&limit=1&include=previewData")
        assets = d.get("foundAssets", [])
        if not assets:
            miss.append((fid, q, "0 results")); print(f"MISS {fid} — 0 results for '{q}'"); continue
        aid = assets[0]["assetId"]
        turl = f"https://acg-media.struffelproductions.com/file/ambientCG-Web/media/thumbnail/128-PNG/{aid}.png"
        req = urllib.request.Request(turl, headers=UA)
        data = urllib.request.urlopen(req, timeout=20).read()
        with open(dest, "wb") as f:
            f.write(data)
        print(f"OK   {fid} <- {aid} ({len(data)} bytes)"); ok += 1
        time.sleep(0.4)  # be polite
    except Exception as e:
        miss.append((fid, q, f"{type(e).__name__}: {e}")); print(f"MISS {fid} — {type(e).__name__}: {e}")

print(f"\nDONE: OK {ok} / MISS {len(miss)}")
for m in miss: print("  ", m)
