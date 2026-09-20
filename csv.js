/*
 * Loaders for DK/FD salary export CSVs, ported from the Python
 * dfs_optimizer/loaders.py. Uses PapaParse (loaded via CDN in index.html)
 * for robust CSV parsing (handles quoted fields, commas in names, etc.)
 */

function cleanPositions(raw) {
  if (!raw) return [];
  return raw.trim().toUpperCase().split(/[\/,]/).map(s => s.trim()).filter(Boolean);
}

function detectSite(headers) {
  const hset = new Set(headers.map(h => h.trim()));
  if (hset.has("AvgPointsPerGame") || hset.has("TeamAbbrev")) return "DK";
  if (hset.has("FPPG") || hset.has("Nickname")) return "FD";
  throw new Error(
    "Could not auto-detect site from CSV headers: " + headers.join(", ") +
    ". Select the site manually."
  );
}

function parseDK(rows) {
  const players = [];
  for (const row of rows) {
    const salaryRaw = row["Salary"];
    if (!salaryRaw) continue;
    const salary = parseInt(parseFloat(salaryRaw), 10);
    if (isNaN(salary)) continue;
    const name = (row["Name"] || "").trim();
    if (!name) continue;
    const proj = parseFloat(row["AvgPointsPerGame"] || "0") || 0;
    players.push({
      id: row["ID"] || name,
      name,
      positions: cleanPositions(row["Position"] || ""),
      team: (row["TeamAbbrev"] || "").trim().toUpperCase(),
      opponent: "",
      salary,
      proj,
      gameInfo: row["Game Info"] || "",
    });
  }
  return players;
}

function parseFD(rows) {
  const players = [];
  for (const row of rows) {
    const salaryRaw = row["Salary"];
    if (!salaryRaw) continue;
    const salary = parseInt(parseFloat(salaryRaw), 10);
    if (isNaN(salary)) continue;
    const first = (row["First Name"] || "").trim();
    const last = (row["Last Name"] || "").trim();
    const name = (row["Nickname"] || "").trim() || `${first} ${last}`.trim();
    if (!name) continue;
    const proj = parseFloat(row["FPPG"] || "0") || 0;
    players.push({
      id: row["Id"] || name,
      name,
      positions: cleanPositions(row["Position"] || ""),
      team: (row["Team"] || "").trim().toUpperCase(),
      opponent: (row["Opponent"] || "").trim().toUpperCase(),
      salary,
      proj,
      gameInfo: row["Game"] || "",
      injuryStatus: (row["Injury Indicator"] || "").trim(),
    });
  }
  return players;
}

/**
 * Parses a slate CSV file (File object from an <input type=file>) and
 * returns a Promise resolving to { site, players }.
 */
function loadSlateFile(file, siteOverride) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const headers = results.meta.fields || [];
          const site = siteOverride || detectSite(headers);
          const players = site === "DK" ? parseDK(results.data) : parseFD(results.data);
          resolve({ site, players });
        } catch (e) {
          reject(e);
        }
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Parses a projections CSV file (Name,Projection columns) and returns a
 * Promise resolving to a Map<lowercased name, projection number>.
 */
function loadProjectionsFile(file, nameCol = "Name", projCol = "Projection") {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const map = new Map();
        for (const row of results.data) {
          const n = (row[nameCol] || "").trim();
          const p = parseFloat(row[projCol]);
          if (n && !isNaN(p)) map.set(n.toLowerCase(), p);
        }
        resolve(map);
      },
      error: (err) => reject(err),
    });
  });
}

/**
 * Applies a projections map onto a players array (mutates proj field).
 * Returns { matched, unmatchedNames } for UI reporting.
 */
function applyProjections(players, projMap) {
  const unmatched = new Set(projMap.keys());
  let matched = 0;
  for (const p of players) {
    const key = p.name.toLowerCase();
    if (projMap.has(key)) {
      p.proj = projMap.get(key);
      unmatched.delete(key);
      matched++;
    }
  }
  return { matched, unmatchedNames: [...unmatched] };
}
