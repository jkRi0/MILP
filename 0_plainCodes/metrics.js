function computeUtilization({ machineSummary }) {
  // Utilization U_i is typically U_min / A_min for regular-time utilization.
  // You can also compute against (A_min + OT_max) to see worst-case capacity usage.
  return machineSummary.map((ms) => {
    const regularUtil = ms.A_min > 0 ? ms.U_min / ms.A_min : 0;
    const maxUtil = (ms.A_min + ms.OT_max) > 0 ? ms.U_min / (ms.A_min + ms.OT_max) : 0;
    return { machine: ms.machine, regularUtil, maxUtil };
  });
}

function computeMeanUtilization(utilArr) {
  // Mean Utilization formula from the study:
  // Ubar = (1/n) * Σ U_i
  const n = utilArr.length || 1;
  const sum = utilArr.reduce((acc, u) => acc + u.regularUtil, 0);
  return sum / n;
}

function computeStdDevUtilization(utilArr) {
  // Standard deviation of utilization formula from the study:
  // σ = sqrt( (1/n) * Σ (U_i - Ubar)^2 )
  const n = utilArr.length || 1;
  const mean = computeMeanUtilization(utilArr);
  const variance = utilArr.reduce((acc, u) => acc + (u.regularUtil - mean) ** 2, 0) / n;
  return Math.sqrt(variance);
}
