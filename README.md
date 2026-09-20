# DFS Optimizer (Browser) — DK/FD, NFL/NBA/MLB

Same optimizer as the Python `dfs_optimizer` package, ported to run entirely
in the browser. No backend, no build step — deploy as-is to GitHub Pages.

**Scope note:** this is CSV-upload-only for all three sports, including
MLB. The Python version's free-data auto-fetch pipeline (`mlb_data.py`,
pulling live data from the MLB Stats API + pybaseball) does **not** come
along — pybaseball is Python-only and can't run in a browser, and the MLB
Stats API isn't set up for direct cross-origin browser calls. If you want
that automation, run the Python version's `mlb_data.py` locally to build a
projections CSV, then upload that CSV here (or into the Python CLI).

## Deploying to GitHub Pages

1. Create a new GitHub repo (or use an existing one).
2. Add all the files in this folder (`index.html`, `style.css`, `js/`) to
   the repo root — or to a `/docs` folder if you'd rather keep it out of
   repo root; either works with GitHub Pages.
3. Repo Settings → Pages → set Source to the branch/folder you used.
4. GitHub gives you a URL like `https://yourusername.github.io/reponame/`.
   That's it — no build step, no server, no dependencies to install.

You can also just open `index.html` directly in a browser from your local
disk (double-click it) — no hosting required at all for personal use.

## How it works

- **CSV parsing**: [PapaParse](https://www.papaparse.com/) (CDN), handles
  the real DK/FD export formats (quoted fields, commas in names, etc.)
- **ILP solver**: [javascript-lp-solver](https://github.com/JWally/jsLPSolver)
  (CDN), a pure-JS branch-and-bound MILP solver. Same player-x-slot binary
  variable formulation as the Python version (PuLP/CBC) — cross-validated
  against the Python optimizer on identical sample data before shipping;
  results matched exactly (same salary used, same total projection, same
  constraint behavior including the MLB hitter-per-team cap and the
  min-games-required rule).
- Everything runs synchronously in your browser tab. Nothing is uploaded
  anywhere. No localStorage, no cookies — refreshing the page clears
  everything, so download your lineups CSV before you navigate away.

## Files

```
index.html        page structure
style.css         styling
js/rules.js       DK/FD × NFL/NBA/MLB rules (salary caps, roster slots, constraints)
js/csv.js         slate CSV + projections CSV parsing
js/optimizer.js   the ILP solver wrapper
js/app.js         UI wiring
```

## Verified rules

Same source basis and same caveats as the Python version — DK's official
rules pages (primary source) for NFL/MLB/NBA scoring and roster
construction; FD's official scoring page for point values, but FD's
roster construction (cap, positions, max-hitters-per-team) is **not**
published there and is carried over from account history, not
independently verified. See `js/rules.js`'s header comment for the full
breakdown, or the Python package's README for the detailed per-rule table.

## Known limitations (same as the Python version, plus one more)

- Classic slates only — no Showdown/Captain Mode/Single Game/MVP.
- No correlation/stacking UI (the underlying model supports team-based
  constraints in principle, but it's not wired into the page controls).
- No ownership model or GPP contest simulator — this optimizes projected
  points only, same as the Python CLI.
- **Browser-only addition**: no automated data pipeline for any sport,
  including MLB (see the scope note above). This tool is strictly
  CSV-in, lineups-out.
