/*
 * Site + sport rules for DraftKings (DK) and FanDuel (FD): salary caps,
 * roster construction, and scoring formulas.
 *
 * Direct port of the Python dfs_optimizer/rules.py, same source basis:
 * DK NFL/MLB/NBA rules pasted from DraftKings' own official "Rules &
 * Scoring" pages (Aug 2026) -- primary source. FD scoring pasted from
 * FanDuel's own official scoring page (Aug 2026) -- also primary source.
 * FD roster construction (salary cap, positions, max-hitters-per-team) is
 * NOT on FanDuel's scoring page -- those numbers are carried over from
 * account history, not independently re-verified against an FD rules page.
 *
 * Known unverified spots (same caveats as the Python version):
 *  - NBA max-players-per-team (either site): not confirmed, left null.
 *  - FD roster construction for all 3 sports: not on FD's official
 *    scoring page, carried over from prior sessions.
 */

const RULES = {

  DK_NFL: {
    site: "DK", sport: "NFL", salaryCap: 50000,
    rosterSlots: [
      { name: "QB", elig: ["QB"] },
      { name: "RB", elig: ["RB"] },
      { name: "RB", elig: ["RB"] },
      { name: "WR", elig: ["WR"] },
      { name: "WR", elig: ["WR"] },
      { name: "WR", elig: ["WR"] },
      { name: "TE", elig: ["TE"] },
      { name: "FLEX", elig: ["RB", "WR", "TE"] },
      { name: "DST", elig: ["DST"] },
    ],
    maxPlayersPerTeam: 8,
    maxHittersPerTeam: null,
    pitcherPositions: [],
    minGames: 2,
  },

  FD_NFL: {
    site: "FD", sport: "NFL", salaryCap: 60000,
    rosterSlots: [
      { name: "QB", elig: ["QB"] },
      { name: "RB", elig: ["RB"] },
      { name: "RB", elig: ["RB"] },
      { name: "WR", elig: ["WR"] },
      { name: "WR", elig: ["WR"] },
      { name: "WR", elig: ["WR"] },
      { name: "TE", elig: ["TE"] },
      { name: "FLEX", elig: ["RB", "WR", "TE"] },
      { name: "DEF", elig: ["DEF", "DST"] },
    ],
    maxPlayersPerTeam: 4,
    maxHittersPerTeam: null,
    pitcherPositions: [],
    minGames: null,   // not confirmed for FD -- FD's official page doesn't publish roster rules
  },

  DK_NBA: {
    site: "DK", sport: "NBA", salaryCap: 50000,
    rosterSlots: [
      { name: "PG", elig: ["PG"] },
      { name: "SG", elig: ["SG"] },
      { name: "SF", elig: ["SF"] },
      { name: "PF", elig: ["PF"] },
      { name: "C", elig: ["C"] },
      { name: "G", elig: ["PG", "SG"] },
      { name: "F", elig: ["SF", "PF"] },
      { name: "UTIL", elig: ["PG", "SG", "SF", "PF", "C"] },
    ],
    maxPlayersPerTeam: null,   // not confirmed
    maxHittersPerTeam: null,
    pitcherPositions: [],
    minGames: 2,
  },

  FD_NBA: {
    site: "FD", sport: "NBA", salaryCap: 60000,
    rosterSlots: [
      { name: "PG", elig: ["PG"] },
      { name: "PG", elig: ["PG"] },
      { name: "SG", elig: ["SG"] },
      { name: "SG", elig: ["SG"] },
      { name: "SF", elig: ["SF"] },
      { name: "SF", elig: ["SF"] },
      { name: "PF", elig: ["PF"] },
      { name: "PF", elig: ["PF"] },
      { name: "C", elig: ["C"] },
    ],
    maxPlayersPerTeam: null,
    maxHittersPerTeam: null,
    pitcherPositions: [],
    minGames: null,
  },

  DK_MLB: {
    site: "DK", sport: "MLB", salaryCap: 50000,
    rosterSlots: [
      { name: "P", elig: ["P", "SP", "RP"] },
      { name: "P", elig: ["P", "SP", "RP"] },
      { name: "C", elig: ["C"] },
      { name: "1B", elig: ["1B"] },
      { name: "2B", elig: ["2B"] },
      { name: "3B", elig: ["3B"] },
      { name: "SS", elig: ["SS"] },
      { name: "OF", elig: ["OF"] },
      { name: "OF", elig: ["OF"] },
      { name: "OF", elig: ["OF"] },
    ],
    maxPlayersPerTeam: null,
    maxHittersPerTeam: 5,
    pitcherPositions: ["P", "SP", "RP"],
    minGames: 2,
  },

  FD_MLB: {
    site: "FD", sport: "MLB", salaryCap: 35000,
    rosterSlots: [
      { name: "P", elig: ["P", "SP", "RP"] },
      { name: "C/1B", elig: ["C", "1B"] },
      { name: "2B", elig: ["2B"] },
      { name: "3B", elig: ["3B"] },
      { name: "SS", elig: ["SS"] },
      { name: "OF", elig: ["OF"] },
      { name: "OF", elig: ["OF"] },
      { name: "OF", elig: ["OF"] },
      { name: "UTIL", elig: ["C", "1B", "2B", "3B", "SS", "OF"] },
    ],
    maxPlayersPerTeam: null,
    maxHittersPerTeam: 4,
    pitcherPositions: ["P", "SP", "RP"],
    minGames: null,
  },
};

function getRules(site, sport) {
  const key = site.toUpperCase() + "_" + sport.toUpperCase();
  if (!RULES[key]) {
    throw new Error(`No rules for site=${site}, sport=${sport}`);
  }
  return RULES[key];
}
