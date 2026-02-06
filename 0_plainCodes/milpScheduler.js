function computeTotalTimeMin({ unitTimeMinPerUnit, setupTimeMin, quantity }) {
  // Total processing time for an operation-job j=(r,k) on machine i.
  // From the study:
  // - processing time p_ij = t_ij * q_r
  // - total time = p_ij + s_ij
  const processing = unitTimeMinPerUnit * quantity;
  return processing + setupTimeMin;
}

function solveScheduleGreedy({
  machines,
  orders,
  routingLong,
  machineRoute,
  times,
  allowBacklog,
  lambdaOT,
  lambdaBL,
  lambdaALT,
  primaryUtilizationCap
}) {
  // This is a maintainable baseline scheduler that follows the SAME computations/penalty terms
  // as the study, but uses a greedy selection instead of a full MILP solver.
  //
  // Why greedy for now?
  // - Plain browser JS has no MILP solver built-in.
  // - The rest of the system (data model, metrics, penalty terms) matches the MILP study,
  //   so replacing this with a real MILP solver later is straightforward.

  const I = machines.map((m) => m.name);

  function getTimeRow({ partCode, operation, machine }) {
    // Many datasets store times under a single operation name (often Op1),
    // even when the part has multiple required process steps (turret/weld/spot).
    //
    // So we attempt:
    // 1) exact match on operation
    // 2) fallback to Op1
    // 3) fallback to first available operation key
    const partTimes = times?.[partCode];
    if (!partTimes) return null;

    const opTimesExact = partTimes?.[operation]?.[machine];
    if (opTimesExact) return opTimesExact;

    const op1 = partTimes?.Op1?.[machine];
    if (op1) return op1;

    const anyOp = Object.keys(partTimes)[0];
    if (anyOp && partTimes?.[anyOp]?.[machine]) return partTimes[anyOp][machine];

    return null;
  }

  function buildStagesFromMachineRoute(partCode) {
    // machineRoute[partCode] is expected to be an ordered list of {machine, route_value}
    // where route_value is 1 (primary) or 1.1 (alternative).
    const seq = machineRoute?.[partCode];
    if (!Array.isArray(seq) || !seq.length) return null;

    function baseGroupName(machineName) {
      // Match Excel intent: columns like "Turret Machine 1", "Turret Machine 2", "Turret Machine 3"
      // represent ONE required process group ("Turret Machine") with alternative/parallel resources.
      //
      // We avoid hardcoded process rules by deriving a base name:
      // - strip trailing digits (and the space before them)
      // - normalize whitespace
      return String(machineName || '')
        .replace(/\s*\d+\s*$/u, '')
        .replace(/\s+/gu, ' ')
        .trim();
    }

    const stagesByGroup = new Map();
    const order = [];

    for (const item of seq) {
      const rv = Number(item.route_value);
      const pi_ij = rv === 1.1 ? 1 : 0;
      const opt = { machine: item.machine, pi_ij };

      const g = baseGroupName(item.machine);
      if (!g) continue;

      if (!stagesByGroup.has(g)) {
        stagesByGroup.set(g, { name: g, options: [] });
        order.push(g);
      }

      stagesByGroup.get(g).options.push(opt);
    }

    const stages = order.map((g) => stagesByGroup.get(g));

    // Within a stage, ensure the primary option (pi_ij=0) is listed first (if present).
    for (const s of stages) {
      s.options.sort((a, b) => (a.pi_ij ?? 0) - (b.pi_ij ?? 0));
    }

    return stages;
  }

  // Build J = {(r,k)} exactly like the MILP study:
  // - r = order_id
  // - k = operation
  // There are two supported ways to define the operation-jobs for a part:
  // 1) machineRoute (Machine Route matrix): defines a REQUIRED sequence of process steps (multi-machine consumption)
  // 2) routingLong (Routing_Long): defines eligible machines per operation (alternatives)
  //
  // If machineRoute exists for a part, we prefer it because it matches the user's expectation:
  // AC002 uses turret + arc weld + spot weld (multiple steps), not just one chosen machine.
  const J = [];
  for (const o of orders) {
    const stages = buildStagesFromMachineRoute(o.part_code);
    if (stages && stages.length) {
      for (let idx = 0; idx < stages.length; idx += 1) {
        J.push({
          order_id: o.order_id,
          part_code: o.part_code,
          operation: stages[idx].name || `Step${idx + 1}`,
          quantity: o.quantity,
          stage_options: stages[idx].options
        });
      }
      continue;
    }

    const opsObj = routingLong?.[o.part_code] || {};
    const ops = Object.keys(opsObj);
    if (!ops.length) {
      // No operations listed for this part -> will be backlogged at evaluation time.
      J.push({ order_id: o.order_id, part_code: o.part_code, operation: 'Op1', quantity: o.quantity });
      continue;
    }

    for (const operation of ops) {
      J.push({ order_id: o.order_id, part_code: o.part_code, operation, quantity: o.quantity });
    }
  }

  const utilizedByMachine = Object.fromEntries(I.map((i) => [i, 0]));
  const overtimeByMachine = Object.fromEntries(I.map((i) => [i, 0]));

  const assignments = [];
  const backlogged_operations = [];

  for (const j of J) {
    const eligibleAll = j.stage_options ?? routingLong?.[j.part_code]?.[j.operation] ?? [];
    if (!eligibleAll.length) {
      if (allowBacklog) {
        backlogged_operations.push({
          order_id: j.order_id,
          operation: j.operation,
          reason: 'No eligible machines in ROUTING_LONG'
        });
        continue;
      }
      throw new Error(`No eligible machines for ${j.part_code} ${j.operation}. Add it to ROUTING_LONG.`);
    }

    // Evaluate each eligible machine with the same penalty structure used in the study objective:
    // min Z = sum(D+ + D-) + lambda_OT * sum(OT) + lambda_BL * sum(y) + lambda_ALT * sum(pi_ij * x_ij)
    //
    // Greedy approximation:
    // - Prefer primary (pi_ij = 0) by adding lambdaALT * pi_ij.
    // - Discourage overtime by adding lambdaOT * overtime_needed.
    // - Approximate balancing by picking the machine that makes utilized time closer to average.

    const eligiblePrimary = eligibleAll.filter((e) => (e.pi_ij ?? 0) === 0);
    const eligibleAlt = eligibleAll.filter((e) => (e.pi_ij ?? 0) !== 0);

    // Business rule from user:
    // - Alternative routes (1.1) should only be used when the primary route is getting queued / near over-utilization.
    //
    // We model "queue/over-utilization" via utilized minutes relative to regular monthly capacity A_min.
    // If the best feasible primary option stays below primaryUtilizationCap * A_min and needs no overtime,
    // we force selection among primaries only.
    const cap = Number.isFinite(primaryUtilizationCap) ? primaryUtilizationCap : 0.9;
    const primaryOkCutoffByMachine = Object.fromEntries(
      machines.map((m) => [m.name, m.A_min * cap])
    );

    const candidateScores = [];

    const currentAvg = I.reduce((sum, i) => sum + utilizedByMachine[i], 0) / I.length;

    let skippedMissingMachine = 0;
    let skippedMissingTime = 0;
    let skippedOvertimeLimit = 0;

    // Track the smallest observed overload to produce a useful error message.
    let bestOverload = null;

    function evaluateOptions(options) {
      for (const option of options) {
        const i = option.machine;
        const m = machines.find((mm) => mm.name === i);
        if (!m) {
          skippedMissingMachine += 1;
          continue;
        }

        const timeRow = getTimeRow({ partCode: j.part_code, operation: j.operation, machine: i });
        if (!timeRow) {
          // If a machine is eligible but has no time record, we must skip or backlog.
          skippedMissingTime += 1;
          continue;
        }

        const totalTimeMin = computeTotalTimeMin({
          unitTimeMinPerUnit: timeRow.unit_time_min_per_unit,
          setupTimeMin: timeRow.setup_time_min,
          quantity: j.quantity
        });

        const newUtilized = utilizedByMachine[i] + totalTimeMin;

        // Compute overtime needed beyond regular time.
        const overtimeNeeded = Math.max(0, newUtilized - m.A_min);
        const overtimeFeasible = overtimeNeeded <= m.OT_max;

        if (!overtimeFeasible) {
          skippedOvertimeLimit += 1;

          const overBy = overtimeNeeded - m.OT_max;
          if (bestOverload === null || overBy < bestOverload.overBy) {
            bestOverload = {
              machine: i,
              totalTimeMin,
              A_min: m.A_min,
              OT_max: m.OT_max,
              overtimeNeeded,
              overBy
            };
          }
          continue;
        }

        // Workload balance proxy: deviation from current average utilized minutes.
        const deviationAfter = Math.abs(newUtilized - currentAvg);

        // Penalty for using alternative routing.
        const altPenalty = lambdaALT * (option.pi_ij ?? 0);

        // Penalty for overtime minutes used.
        const otPenalty = lambdaOT * overtimeNeeded;

        const score = deviationAfter + altPenalty + otPenalty;

        candidateScores.push({
          machine: i,
          score,
          totalTimeMin,
          route_type: (option.pi_ij ?? 0) === 0 ? 'PRIMARY' : 'ALT',
          ...timeRow,
          overtimeNeeded,
          newUtilized,
          A_min: m.A_min
        });
      }
    }

    // 1) Evaluate primary options first.
    evaluateOptions(eligiblePrimary.length ? eligiblePrimary : eligibleAll);

    // Determine if we should allow alts.
    let allowAlt = true;
    if (eligiblePrimary.length) {
      // Find best feasible primary candidate (without considering alts).
      const primaryCandidates = candidateScores.filter((c) => c.route_type === 'PRIMARY');
      primaryCandidates.sort((a, b) => a.score - b.score);
      const bestPrimary = primaryCandidates[0];

      // If primary is feasible, needs no overtime, and stays under the utilization cap, do not consider alts.
      if (bestPrimary && bestPrimary.overtimeNeeded <= 0 && bestPrimary.newUtilized <= primaryOkCutoffByMachine[bestPrimary.machine]) {
        allowAlt = false;
      }
    }

    // 2) Only if primary is "queued"/near cap, evaluate alternative options too.
    if (allowAlt && eligibleAlt.length) {
      evaluateOptions(eligibleAlt);
    }

    candidateScores.sort((a, b) => a.score - b.score);

    const best = candidateScores[0];
    if (!best) {
      if (allowBacklog) {
        let reason = 'No feasible machine';
        const details = [];

        if (skippedMissingMachine) details.push(`missing machine calendar: ${skippedMissingMachine}`);
        if (skippedMissingTime) details.push(`missing time rows: ${skippedMissingTime}`);
        if (skippedOvertimeLimit) details.push(`exceeds (A_min + OT_max): ${skippedOvertimeLimit}`);

        if (bestOverload) {
          // Computation reminder:
          // A schedule is feasible on machine i only if:
          // U_i <= A_i + OT_i and OT_i <= OT_max_i.
          // Here, we tested the marginal add and found overtimeNeeded > OT_max.
          details.push(
            `closest machine "${bestOverload.machine}": needs ${bestOverload.overtimeNeeded.toFixed(
              2
            )} OT min but OT_max is ${bestOverload.OT_max.toFixed(2)} (over by ${bestOverload.overBy.toFixed(2)})`
          );
        }

        if (details.length) reason += ` (${details.join(' | ')})`;

        backlogged_operations.push({
          order_id: j.order_id,
          operation: j.operation,
          reason
        });
        continue;
      }
      throw new Error(`No feasible assignment for order ${j.order_id}. Check Times data / OT limits.`);
    }

    utilizedByMachine[best.machine] += best.totalTimeMin;

    // Overtime is defined per machine, not per job. We compute OT_i as max(0, U_i - A_i).
    // We'll compute final OT_i after all assignments, but we keep a running view for scoring.

    assignments.push({
      order_id: j.order_id,
      operation: j.operation,
      machine: best.machine,
      route_type: best.route_type,
      unit_time_min_per_unit: best.unit_time_min_per_unit,
      setup_time_min: best.setup_time_min,
      quantity: j.quantity,
      total_time_min: best.totalTimeMin
    });
  }

  // Machine summary (same shape as backend schedule_result.json)
  const machine_summary = machines.map((m) => {
    const U_min = utilizedByMachine[m.name] ?? 0;

    // Computation comment:
    // OT_i = max(0, U_i - A_i) with OT_i bounded by OT_max.
    const OT_min = Math.min(m.OT_max, Math.max(0, U_min - m.A_min));

    return {
      machine: m.name,
      U_min,
      OT_min,
      A_min: m.A_min,
      OT_max: m.OT_max,
      over_regular_time: U_min > m.A_min + 1e-6
    };
  });

  // Rebuild average utilization time U_avg (minutes) across machines.
  const U_avg = machine_summary.reduce((sum, x) => sum + x.U_min, 0) / Math.max(1, machine_summary.length);

  // Add study-style imbalance terms D+ and D- to the result (useful for dashboard, debugging).
  // Constraint in study: U_i - U_avg = D+_i - D-_i, with D+_i >= 0 and D-_i >= 0.
  const machine_deviation = machine_summary.map((ms) => {
    const diff = ms.U_min - U_avg;
    return {
      machine: ms.machine,
      D_plus: Math.max(0, diff),
      D_minus: Math.max(0, -diff)
    };
  });

  // Approximate objective (for display):
  // minZ ≈ Σ(D+ + D-) + λ_OT Σ OT + λ_BL Σ y + λ_ALT Σ π_ij x_ij
  const totalImbalance = machine_deviation.reduce((sum, d) => sum + d.D_plus + d.D_minus, 0);
  const totalOT = machine_summary.reduce((sum, ms) => sum + ms.OT_min, 0);
  const totalBacklog = backlogged_operations.length;
  const totalAlt = assignments.reduce((sum, a) => sum + (a.route_type === 'ALT' ? 1 : 0), 0);

  const objectiveApprox =
    totalImbalance +
    lambdaOT * totalOT +
    lambdaBL * totalBacklog +
    lambdaALT * totalAlt;

  return {
    status: 'HEURISTIC',
    assignments,
    machine_summary,
    backlogged_operations,
    machine_deviation,
    objectiveApprox
  };
}
