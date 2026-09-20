// UI glue: wires the file inputs/controls to csv.js and optimizer.js,
// and renders results. No backend, no localStorage -- everything lives
// in memory for the current page session.

let loadedPlayers = [];
let loadedSite = null;
let lastLineups = [];
let lastRules = null;

const els = {
  slateFile: document.getElementById("slateFile"),
  siteSelect: document.getElementById("siteSelect"),
  sportSelect: document.getElementById("sportSelect"),
  slateStatus: document.getElementById("slateStatus"),
  projFile: document.getElementById("projFile"),
  projStatus: document.getElementById("projStatus"),
  numLineups: document.getElementById("numLineups"),
  maxOverlap: document.getElementById("maxOverlap"),
  minSalary: document.getElementById("minSalary"),
  randomness: document.getElementById("randomness"),
  lockNames: document.getElementById("lockNames"),
  excludeNames: document.getElementById("excludeNames"),
  generateBtn: document.getElementById("generateBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  results: document.getElementById("results"),
  rulesSummary: document.getElementById("rulesSummary"),
};

function renderRulesSummary() {
  const site = els.siteSelect.value;
  const sport = els.sportSelect.value;
  try {
    const rules = getRules(site, sport);
    lastRules = rules;
    const slotStr = rules.rosterSlots.map(s => s.name).join(", ");
    let extra = "";
    if (rules.maxHittersPerTeam) extra += ` | Max ${rules.maxHittersPerTeam} hitters/team`;
    if (rules.maxPlayersPerTeam) extra += ` | Max ${rules.maxPlayersPerTeam} players/team`;
    if (rules.minGames) extra += ` | Min ${rules.minGames} games`;
    els.rulesSummary.textContent =
      `${site} ${sport}: $${rules.salaryCap.toLocaleString()} cap | ${slotStr}${extra}`;
  } catch (e) {
    els.rulesSummary.textContent = "";
    lastRules = null;
  }
}

els.siteSelect.addEventListener("change", renderRulesSummary);
els.sportSelect.addEventListener("change", renderRulesSummary);
renderRulesSummary();

els.slateFile.addEventListener("change", async () => {
  const file = els.slateFile.files[0];
  if (!file) return;
  els.slateStatus.textContent = "Loading...";
  try {
    const manualSite = els.siteSelect.value === "auto" ? null : els.siteSelect.value;
    const { site, players } = await loadSlateFile(file, manualSite);
    loadedPlayers = players;
    loadedSite = site;
    if (els.siteSelect.value === "auto") {
      els.siteSelect.value = site;
    }
    renderRulesSummary();
    els.slateStatus.textContent =
      `Loaded ${players.length} players from ${file.name} (site=${site}).`;
    els.slateStatus.className = "status ok";
  } catch (e) {
    els.slateStatus.textContent = "Error: " + e.message;
    els.slateStatus.className = "status error";
  }
});

let loadedProjMap = null;
els.projFile.addEventListener("change", async () => {
  const file = els.projFile.files[0];
  if (!file) return;
  try {
    loadedProjMap = await loadProjectionsFile(file);
    if (loadedPlayers.length) {
      const { matched, unmatchedNames } = applyProjections(loadedPlayers, loadedProjMap);
      let msg = `Matched ${matched}/${loadedPlayers.length} slate players to projections.`;
      if (unmatchedNames.length) {
        msg += ` ${unmatchedNames.length} projection rows had no match ` +
          `(check spelling): ${unmatchedNames.slice(0, 8).join(", ")}` +
          (unmatchedNames.length > 8 ? "..." : "");
      }
      els.projStatus.textContent = msg;
      els.projStatus.className = "status " + (unmatchedNames.length ? "warn" : "ok");
    } else {
      els.projStatus.textContent = "Projections loaded -- upload a slate CSV first, then re-upload this file to apply it.";
      els.projStatus.className = "status warn";
    }
  } catch (e) {
    els.projStatus.textContent = "Error: " + e.message;
    els.projStatus.className = "status error";
  }
});

function namesToIds(namesText, players) {
  const names = namesText.split(/[\n,]/).map(s => s.trim().toLowerCase()).filter(Boolean);
  const ids = new Set();
  const unmatched = [];
  names.forEach(n => {
    const found = players.find(p => p.name.toLowerCase() === n);
    if (found) ids.add(found.id);
    else unmatched.push(n);
  });
  return { ids, unmatched };
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderLineups(lineups, rules) {
  if (!lineups.length) {
    els.results.innerHTML = `<p class="status error">No feasible lineups generated. Check your salary cap / constraints against your player pool (e.g. not enough cheap players to fill required slots, or exposure/overlap settings too tight).</p>`;
    els.downloadBtn.disabled = true;
    return;
  }
  let html = "";
  lineups.forEach((lu, i) => {
    html += `<div class="lineup-card">
      <h3>Lineup ${i + 1} &mdash; $${lu.salaryUsed.toLocaleString()} &middot; Proj ${lu.projTotal}</h3>
      <table><thead><tr><th>Slot</th><th>Player</th><th>Team</th><th>Salary</th><th>Proj</th></tr></thead><tbody>`;
    lu.assignments.forEach(a => {
      html += `<tr><td>${escapeHtml(a.slotName)}</td><td>${escapeHtml(a.player.name)}</td>` +
        `<td>${escapeHtml(a.player.team)}</td><td>$${a.player.salary.toLocaleString()}</td>` +
        `<td>${a.player.proj.toFixed(2)}</td></tr>`;
    });
    html += `</tbody></table></div>`;
  });
  els.results.innerHTML = html;
  els.downloadBtn.disabled = false;
}

function lineupsToCSV(lineups, rules) {
  const slotNames = rules.rosterSlots.map(s => s.name);
  const header = [...slotNames, "Salary", "Projection"];
  const lines = [header.join(",")];
  lineups.forEach(lu => {
    const row = new Array(slotNames.length).fill("");
    const usedIdx = new Set();
    lu.assignments.forEach(a => {
      for (let i = 0; i < slotNames.length; i++) {
        if (slotNames[i] === a.slotName && !usedIdx.has(i)) {
          row[i] = `"${a.player.name.replace(/"/g, '""')}"`;
          usedIdx.add(i);
          break;
        }
      }
    });
    row.push(lu.salaryUsed, lu.projTotal);
    lines.push(row.join(","));
  });
  return lines.join("\n");
}

els.generateBtn.addEventListener("click", () => {
  if (!loadedPlayers.length) {
    alert("Upload a slate CSV first.");
    return;
  }
  const site = els.siteSelect.value === "auto" ? loadedSite : els.siteSelect.value;
  const sport = els.sportSelect.value;
  let rules;
  try {
    rules = getRules(site, sport);
  } catch (e) {
    alert(e.message);
    return;
  }

  const { ids: lockedIds, unmatched: lockUnmatched } = namesToIds(els.lockNames.value, loadedPlayers);
  const { ids: excludedIds, unmatched: excludeUnmatched } = namesToIds(els.excludeNames.value, loadedPlayers);
  if (lockUnmatched.length) console.warn("Lock names not found in slate:", lockUnmatched);
  if (excludeUnmatched.length) console.warn("Exclude names not found in slate:", excludeUnmatched);

  const options = {
    numLineups: parseInt(els.numLineups.value, 10) || 1,
    maxOverlap: els.maxOverlap.value === "" ? null : parseInt(els.maxOverlap.value, 10),
    minSalary: els.minSalary.value === "" ? null : parseInt(els.minSalary.value, 10),
    randomnessPct: parseFloat(els.randomness.value) || 0,
    lockedIds, excludedIds,
  };

  els.generateBtn.disabled = true;
  els.generateBtn.textContent = "Solving...";
  // yield to the browser so the button label updates before the (synchronous) solve
  setTimeout(() => {
    try {
      const lineups = optimize(loadedPlayers, rules, options);
      lastLineups = lineups;
      renderLineups(lineups, rules);
    } catch (e) {
      els.results.innerHTML = `<p class="status error">Error: ${escapeHtml(e.message)}</p>`;
      console.error(e);
    } finally {
      els.generateBtn.disabled = false;
      els.generateBtn.textContent = "Generate Lineups";
    }
  }, 10);
});

els.downloadBtn.addEventListener("click", () => {
  if (!lastLineups.length || !lastRules) return;
  const csv = lineupsToCSV(lastLineups, lastRules);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lineups.csv";
  a.click();
  URL.revokeObjectURL(url);
});
