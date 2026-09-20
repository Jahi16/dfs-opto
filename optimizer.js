/*
 * ILP lineup optimizer using javascript-lp-solver (loaded via CDN in
 * index.html as the global `solver`). Direct port of the Python
 * dfs_optimizer/optimizer.py, using the same player-x-slot binary
 * variable formulation and the same constraint patterns, verified
 * against the Python version's own stress tests before this was built:
 *   - hitter-per-team cap that excludes pitchers (MLB)
 *   - min-games-required (game_used binary indicator, linked both
 *     directions so the solver can't claim a game is "used" for free)
 *   - overlap-based diversity across a multi-lineup pool
 */

function playerEligibleSlots(player, rosterSlots) {
  const posSet = new Set(player.positions);
  const out = [];
  rosterSlots.forEach((slot, si) => {
    if (slot.elig.some(p => posSet.has(p))) out.push(si);
  });
  return out;
}

/**
 * Builds and solves one ILP model for one lineup.
 * previousLineups: array of {playerIds: Set} for diversity constraints.
 */
function solveOneLineup(players, rules, opts, previousLineups) {
  const {
    maxSalary, minSalary, maxOverlap,
    lockedIds, excludedIds, randomnessPct,
  } = opts;

  const pool = players.filter(p => !excludedIds.has(p.id));
  const rosterSlots = rules.rosterSlots;

  const model = {
    optimize: "proj",
    opType: "max",
    constraints: {},
    variables: {},
    binaries: {},
  };

  const cap = maxSalary || rules.salaryCap;
  model.constraints["salary"] = minSalary ? { max: cap, min: minSalary } : { max: cap };

  rosterSlots.forEach((slot, si) => {
    model.constraints["slot" + si] = { equal: 1 };
  });

  // player -> eligible slot indices, and player -> slot var names
  const playerSlotVars = {};
  pool.forEach(p => {
    const eligSlots = playerEligibleSlots(p, rosterSlots);
    playerSlotVars[p.id] = [];
    if (eligSlots.length === 0) return;
    model.constraints["use_" + p.id] = { max: 1 };
    eligSlots.forEach(si => {
      const vn = p.id + "__s" + si;
      let proj = p.proj;
      if (randomnessPct > 0) {
        const noise = 1 + (Math.random() * 2 - 1) * randomnessPct / 100;
        proj = proj * noise;
      }
      const v = { proj, salary: p.salary };
      v["slot" + si] = 1;
      v["use_" + p.id] = 1;
      model.variables[vn] = v;
      model.binaries[vn] = 1;
      playerSlotVars[p.id].push(vn);
    });
  });

  // team caps (general, e.g. NFL max-per-team)
  if (rules.maxPlayersPerTeam) {
    const teams = [...new Set(pool.map(p => p.team).filter(Boolean))];
    teams.forEach(team => {
      const cname = "teamcap_" + team;
      model.constraints[cname] = { max: rules.maxPlayersPerTeam };
      pool.forEach(p => {
        if (p.team === team) {
          (playerSlotVars[p.id] || []).forEach(vn => {
            model.variables[vn][cname] = 1;
          });
        }
      });
    });
  }

  // hitter-per-team cap excluding pitchers (MLB)
  if (rules.maxHittersPerTeam) {
    const pitcherSet = new Set(rules.pitcherPositions);
    const teams = [...new Set(pool.map(p => p.team).filter(Boolean))];
    teams.forEach(team => {
      const cname = "hitcap_" + team;
      model.constraints[cname] = { max: rules.maxHittersPerTeam };
      pool.forEach(p => {
        const isPitcher = p.positions.some(pos => pitcherSet.has(pos));
        if (p.team === team && !isPitcher) {
          (playerSlotVars[p.id] || []).forEach(vn => {
            model.variables[vn][cname] = 1;
          });
        }
      });
    });
  }

  // locked players: force inclusion
  lockedIds.forEach(id => {
    if (playerSlotVars[id] && playerSlotVars[id].length) {
      const cname = "lock_" + id;
      model.constraints[cname] = { min: 1 };
      playerSlotVars[id].forEach(vn => { model.variables[vn][cname] = 1; });
    }
  });

  // min-games constraint (game_used binary indicator, both-direction link)
  if (rules.minGames) {
    const games = [...new Set(pool.map(p => p.gameInfo).filter(Boolean))];
    if (games.length >= rules.minGames) {
      model.constraints["min_games"] = { min: rules.minGames };
      games.forEach(g => {
        const playersInGame = pool.filter(p => p.gameInfo === g);
        const upperC = "gu_upper_" + g;
        model.constraints[upperC] = { min: 0 };  // sum(x_i) - y_g >= 0
        const yVar = {};
        yVar[upperC] = -1;
        yVar["min_games"] = 1;
        playersInGame.forEach(p => {
          (playerSlotVars[p.id] || []).forEach(vn => {
            model.variables[vn][upperC] = 1;
            const lowerC = "gu_lower_" + g + "_" + vn;
            model.constraints[lowerC] = { min: 0 };  // y_g - x_i >= 0
            model.variables[vn][lowerC] = -1;
            yVar[lowerC] = 1;
          });
        });
        model.variables["y_" + g] = yVar;
        model.binaries["y_" + g] = 1;
      });
    }
  }

  // diversity vs. previous lineups in this pool
  if (maxOverlap !== null && maxOverlap !== undefined) {
    previousLineups.forEach((prev, idx) => {
      const cname = "overlap_" + idx;
      model.constraints[cname] = { max: maxOverlap };
      prev.playerIds.forEach(pid => {
        (playerSlotVars[pid] || []).forEach(vn => {
          model.variables[vn][cname] = 1;
        });
      });
    });
  }

  const result = solver.Solve(model);
  if (!result.feasible) return null;

  const assignments = [];
  let salaryUsed = 0, projTotal = 0;
  const usedPlayerIds = new Set();

  rosterSlots.forEach((slot, si) => {
    for (const p of pool) {
      const vn = p.id + "__s" + si;
      if (result[vn] === 1) {
        assignments.push({ slotName: slot.name, player: p });
        salaryUsed += p.salary;
        projTotal += p.proj;
        usedPlayerIds.add(p.id);
        break;
      }
    }
  });

  return {
    assignments,
    salaryUsed,
    projTotal: Math.round(projTotal * 100) / 100,
    playerIds: usedPlayerIds,
  };
}

/**
 * Generates up to numLineups lineups. Returns an array of lineup objects
 * (see solveOneLineup's return shape), stopping early if a solve becomes
 * infeasible (e.g. exposure/overlap constraints too tight for the pool).
 */
function optimize(players, rules, options = {}) {
  const opts = {
    numLineups: options.numLineups || 1,
    maxSalary: options.maxSalary || null,
    minSalary: options.minSalary || null,
    maxOverlap: options.maxOverlap ?? null,
    lockedIds: options.lockedIds || new Set(),
    excludedIds: options.excludedIds || new Set(),
    randomnessPct: options.randomnessPct || 0,
  };

  const lineups = [];
  for (let i = 0; i < opts.numLineups; i++) {
    const lu = solveOneLineup(players, rules, opts, lineups);
    if (!lu) {
      console.warn(`Lineup ${i + 1}: infeasible, stopping early (` +
        `${lineups.length} lineup(s) generated). This usually means the ` +
        `overlap/exposure constraints are too tight for this player pool.`);
      break;
    }
    lineups.push(lu);
  }
  return lineups;
}
