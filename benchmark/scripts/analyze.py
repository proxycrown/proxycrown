#!/usr/bin/env python3
"""Recompute summary.csv from a directory of results-*.jsonl(.gz) files.

Usage: python3 analyze.py data            # writes summary.csv
       python3 analyze.py data --raw      # keep connectivity errors in the base
"""
import collections, csv, glob, gzip, json, math, os, sys

EXCLUDE = {"error"} if "--raw" not in sys.argv else set()

def wilson(k, n, z=1.96):
    if not n:
        return 0.0, 0.0, 0.0
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    s = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return 100 * p, 100 * max(0.0, (c - s) / d), 100 * min(1.0, (c + s) / d)

def rows(path):
    op = gzip.open if path.endswith(".gz") else open
    with op(path, "rt") as fh:
        for line in fh:
            line = line.strip()
            if line:
                yield json.loads(line)

def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "data"
    agg = collections.defaultdict(collections.Counter)
    kinds = {}
    for path in sorted(glob.glob(os.path.join(src, "*.jsonl*"))):
        cls = os.path.basename(path).split(".")[0].replace("results-", "")
        for r in rows(path):
            agg[(cls, r["target"])][r.get("verdict") or "error"] += 1
            kinds[r["target"]] = r.get("kind", "")
    classes = sorted({c for c, _ in agg})
    targets = sorted(kinds)
    fields = ["target", "kind"]
    for c in classes:
        fields += [f"{c}_ok%", f"{c}_ok", f"{c}_n", f"{c}_ci95"]
    with open("summary.csv", "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        for t in targets:
            row = {"target": t, "kind": kinds[t]}
            for c in classes:
                cc = agg.get((c, t), collections.Counter())
                n = sum(v for k, v in cc.items() if k not in EXCLUDE)
                ok = cc.get("ok", 0)
                p, lo, hi = wilson(ok, n)
                row[f"{c}_ok%"], row[f"{c}_ok"], row[f"{c}_n"] = round(p, 1), ok, n
                row[f"{c}_ci95"] = f"{lo:.1f}-{hi:.1f}"
            w.writerow(row)
    print("wrote summary.csv", len(targets), "targets", len(classes), "classes")

if __name__ == "__main__":
    main()
