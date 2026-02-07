const STORAGE_KEYS = {
  orders: 'milp_orders_v1',
  solutionsByMonth: 'milp_solutions_by_month_v1'
};

const SOLVER_CONFIG = {
  allowBacklog: true,
  // Penalty weights from the study (can be exposed in UI later)
  lambdaOT: 10,
  lambdaBL: 1000,
  lambdaALT: 5,
  primaryUtilizationCap: 0.9
};

const state = {
  machines: structuredClone(MACHINES),
  // Orders are what the user enters (Order ID, Part Code, Quantity).
  orders: [],
  user: null,
  // Solutions are derived per month by running the scheduler.
  solutionsByMonth: {},
  activeTab: 'schedule',
  currentMonth: isoMonth(new Date()),
  jobForm: {
    partCode: '',
    // NOTE: We keep the existing input label in HTML, but we interpret this as Quantity.
    // In the study, q_r is the quantity required for order r.
    units: '',
    priority: 'normal',
    month: isoMonth(new Date())
  }
};

let machineInfoPreviewTimer = null;

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}

function utilHeatStyle(pct) {
  const p = clamp(Number(pct) || 0, 0, 150);

  const lerp = (a, b, t) => a + (b - a) * t;
  const mixRgb = (c1, c2, t) => [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ];

  // HSL colors converted to RGB for interpolation
  const GREEN_RGB = [34, 197, 94];   // Approx HSL(120, 85%, 45%)
  const ORANGE_RGB = [249, 115, 22]; // Midpoint for 90%
  const RED_RGB = [239, 68, 68];    // Final over-utilized

  let rgb;
  let hue;

  if (p <= 90) {
    // Keep user's exact hue logic for 0-90% (Yellow -> Green)
    hue = 50 + (120 - 50) * (p / 90);
    // Use HSLA directly for this range as requested
    const bg = `hsla(${hue.toFixed(1)}, 85%, 45%, 0.32)`;
    const fg = `hsl(${hue.toFixed(1)}, 90%, 84%)`;
    return { bg, fg };
  } else {
    // For > 90%, use RGB interpolation to avoid the "hue-back-to-yellow" bug.
    // Transition: Green -> Orange -> Red
    const t = clamp((p - 90) / 30, 0, 1);
    rgb = mixRgb(ORANGE_RGB, RED_RGB, t);
    
    const bg = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35)`;
    const fgRgb = mixRgb(rgb, [255, 255, 255], 0.75);
    const fg = `rgb(${fgRgb[0]}, ${fgRgb[1]}, ${fgRgb[2]})`;
    return { bg, fg };
  }
}

async function apiFetchJson(url, options) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  const txt = await res.text();
  let json = null;
  try {
    json = txt ? JSON.parse(txt) : null;
  } catch {
    // ignore
  }
  if (!res.ok) {
    const msg = json?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return json;
}

async function apiMe() {
  return apiFetchJson('./api/auth.php');
}

async function apiLogin({ username, password }) {
  return apiFetchJson('./api/auth.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'login', username, password })
  });
}

async function apiLogout() {
  return apiFetchJson('./api/auth.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'logout' })
  });
}

function setAuthUi(isAuthed) {
  const loginTabBtn = document.getElementById('loginTabBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  if (loginTabBtn) loginTabBtn.style.display = isAuthed ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = isAuthed ? '' : 'none';
}

async function apiListOrders() {
  const data = await apiFetchJson('./api/orders.php');
  return Array.isArray(data?.orders) ? data.orders : [];
}

async function apiCreateOrder(order) {
  await apiFetchJson('./api/orders.php', { method: 'POST', body: JSON.stringify(order) });
}

async function apiUpdateOrder(order) {
  await apiFetchJson('./api/orders.php', { method: 'PUT', body: JSON.stringify(order) });
}

async function apiDeleteOrder(id) {
  await apiFetchJson(`./api/orders.php?id=${encodeURIComponent(String(id))}`, { method: 'DELETE' });
}

function sanityCheckEmbeddedData() {
  // This check verifies that you are using the FULL embedded Excel extraction
  // (routingTimesFull.js) rather than the small demo subset in data.js.
  const routingParts = ROUTING_LONG ? Object.keys(ROUTING_LONG).length : 0;
  const timesParts = TIMES ? Object.keys(TIMES).length : 0;

  const isLikelyDemoSubset = routingParts <= 2 || timesParts <= 2;
  if (isLikelyDemoSubset) {
    renderModalHtml({
      title: 'Data Not Fully Loaded',
      titleColor: '#fecaca',
      bodyHtml: `
        <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">The app is still using the <strong>demo subset</strong> of routing/times.</div>
        <div class="muted">Expected: full embedded data from Excel. Found routing parts: <strong>${routingParts}</strong>, times parts: <strong>${timesParts}</strong>.</div>
        <div class="muted" style="margin-top: 10px;">Make sure <strong>routingTimesFull.js</strong> is loaded before <strong>data.js</strong> in index.html.</div>
      `
    });
    return;
  }

  // A lightweight consistency check:
  // If a part/operation has an eligible machine in ROUTING_LONG, it should have a matching time row in TIMES.
  // Missing time rows is the most common reason for "No feasible machine".
  let missingCount = 0;
  const maxExamples = 8;
  const examples = [];

  for (const [part, ops] of Object.entries(ROUTING_LONG)) {
    for (const [op, options] of Object.entries(ops || {})) {
      for (const opt of options || []) {
        const mach = opt.machine;
        const timeRow = TIMES?.[part]?.[op]?.[mach];
        if (!timeRow) {
          missingCount += 1;
          if (examples.length < maxExamples) {
            examples.push(`${part} / ${op} / ${mach}`);
          }
        }
      }
    }
  }

  if (missingCount > 0) {
    renderModalHtml({
      title: 'Data Consistency Warning',
      titleColor: '#fde68a',
      bodyHtml: `
        <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">Some routing rows do not have matching time rows.</div>
        <div class="muted">Missing count: <strong>${missingCount}</strong></div>
        <div class="muted" style="margin-top: 10px;">Examples:</div>
        <div class="stack" style="margin-top: 8px;">${examples
          .map((x) => `<div class="item" style="padding: 10px;">${escapeHtml(x)}</div>`)
          .join('')}</div>
        <div class="muted" style="margin-top: 10px;">Fix by ensuring the Excel <strong>Times</strong> sheet has unit/setup times for every eligible machine in <strong>Routing_Long</strong>.</div>
      `
    });
  }
}

function loadData() {
  // Prefer loading orders from the PHP/MySQL backend.
  // If the API is unreachable, we continue in-memory.
  apiListOrders()
    .then((rows) => {
      state.orders = rows.map((r) => ({
        id: Number(r.id),
        order_id: r.order_id,
        part_code: r.part_code,
        quantity: Number(r.quantity),
        month: r.month,
        priority: r.priority || 'normal',
        createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString()
      }));
      state.solutionsByMonth = {};
      solveForMonth(state.currentMonth);
      render();
    })
    .catch(() => {
      // fallback: keep in-memory
    });
}

function saveData() {
  // Orders are persisted via the API calls.
}

function setActiveTab(tabId) {
  if (!state.user && tabId !== 'login') {
    tabId = 'login';
  }
  state.activeTab = tabId;

  document.querySelectorAll('.tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  document.querySelectorAll('.panel').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.panel === tabId);
  });

  render();
  renderIcons();
}

function setJobForm(patch) {
  state.jobForm = { ...state.jobForm, ...patch };
  if (Object.prototype.hasOwnProperty.call(patch, 'partCode')) {
    renderSelectedPartSize({ partCode: state.jobForm.partCode });
  }
  renderScheduleFormDerived();
}

function resetForm() {
  state.jobForm = {
    partCode: '',
    units: '',
    priority: 'normal',
    month: isoMonth(new Date())
  };
  renderSelectedPartSize({ partCode: state.jobForm.partCode });
}

function updateScheduleButtonState() {
  const btn = document.getElementById('scheduleBtn');
  const enabled = Boolean(state.jobForm.units && state.jobForm.partCode);
  btn.disabled = !enabled;
}

function renderScheduleFormDerived() {
  const hint = document.getElementById('capacityHint');
  const unitsValue = state.jobForm.units;

  if (!unitsValue) {
    hint.classList.add('hidden');
    hint.innerHTML = '';
    renderMachineInfo();
    updateScheduleButtonState();
    return;
  }

  const qty = Number.parseFloat(unitsValue);
  if (!Number.isFinite(qty) || qty <= 0) {
    hint.classList.add('hidden');
    hint.innerHTML = '';
    renderMachineInfo();
    updateScheduleButtonState();
    return;
  }

  hint.classList.remove('hidden');
  hint.innerHTML = `
    <div><strong>Quantity (q<sub>r</sub>):</strong> ${qty.toFixed(0)}</div>
    <div class="small muted" style="margin-top: 6px;">Total minutes will be computed using: <strong>setup + (unit_time × quantity)</strong></div>
  `;

  renderMachineInfo();
  updateScheduleButtonState();
}

function renderMachineInfo() {
  const container = document.getElementById('machineInfo');
  const partCode = state.jobForm.partCode;
  const month = state.jobForm.month;
  const qty = Number.parseFloat(state.jobForm.units);

  if (!partCode || !month || !Number.isFinite(qty) || qty <= 0) {
    container.className = 'placeholder';
    container.textContent = 'Enter part code and required capacity to preview machine utilization impact.';
    return;
  }

  if (machineInfoPreviewTimer) {
    clearTimeout(machineInfoPreviewTimer);
  }

  container.className = 'placeholder';
  container.textContent = 'Calculating preview...';

  machineInfoPreviewTimer = setTimeout(() => {
    const beforeSolution = solveForMonthWithOverrides(month, {});

    const baseOrders = state.orders
      .filter((o) => o.month === month)
      .map((o) => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity }));

    const previewOrder = { order_id: 'PREVIEW', part_code: partCode, quantity: qty };
    const afterSolution = solveScheduleGreedy({
      machines: state.machines,
      orders: [...baseOrders, previewOrder],
      routingLong: ROUTING_LONG,
      machineRoute: MACHINE_ROUTE,
      times: TIMES,
      allowBacklog: SOLVER_CONFIG.allowBacklog,
      lambdaOT: SOLVER_CONFIG.lambdaOT,
      lambdaBL: SOLVER_CONFIG.lambdaBL,
      lambdaALT: SOLVER_CONFIG.lambdaALT,
      primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
    });

    const beforeUtil = computeUtilization({ machineSummary: beforeSolution.machine_summary });
    const afterUtil = computeUtilization({ machineSummary: afterSolution.machine_summary });

    const previewAssignments = afterSolution.assignments.filter((a) => a.order_id === 'PREVIEW');
    const previewBacklogs = afterSolution.backlogged_operations.filter((b) => b.order_id === 'PREVIEW');

    const impactedMachines = [...new Set(previewAssignments.map((a) => a.machine))];

    const impactedRows = impactedMachines
      .map((m) => {
        const b = beforeUtil.find((x) => x.machine === m);
        const a = afterUtil.find((x) => x.machine === m);
        const beforePct = (b?.regularUtil ?? 0) * 100;
        const afterPct = (a?.regularUtil ?? 0) * 100;
        return { machine: m, beforePct, afterPct, deltaPct: afterPct - beforePct };
      })
      .sort((x, y) => Math.abs(y.deltaPct) - Math.abs(x.deltaPct));

    const assignHtml = previewAssignments.length
      ? previewAssignments
          .map(
            (a) => `
              <div class="small"><span class="muted">${escapeHtml(a.operation)}:</span> <strong>${escapeHtml(
                a.machine
              )}</strong> <span class="pill ${a.route_type === 'ALT' ? 'yellow' : 'green'}" style="margin-left: 8px;">${escapeHtml(
                a.route_type
              )}</span> — <strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(2)} min</strong></div>
            `
          )
          .join('')
      : '<div class="small muted">No assignment in preview</div>';

    const backlogHtml = previewBacklogs.length
      ? `<div class="stack" style="gap: 6px; margin-top: 10px;">${previewBacklogs
          .map(
            (b) => `<div class="small" style="color: #fecaca;">Backlogged: <strong>${escapeHtml(
              b.operation
            )}</strong> — ${escapeHtml(b.reason || '')}</div>`
          )
          .join('')}</div>`
      : '';

    const impactHtml = impactedRows.length
      ? impactedRows
          .map((r) => {
            const afterClass = getPillClass(r.afterPct);
            const delta = r.deltaPct;
            const deltaText = `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
            return `
              <div class="item" style="padding: 10px;">
                <div class="item-top">
                  <div style="font-weight: 800;">${escapeHtml(r.machine)}</div>
                  <span class="pill ${afterClass}">After: ${r.afterPct.toFixed(1)}%</span>
                </div>
                <div class="small muted">Before: <strong>${r.beforePct.toFixed(1)}%</strong> | Change: <strong>${escapeHtml(
                  deltaText
                )}</strong></div>
              </div>
            `;
          })
          .join('')
      : '<div class="small muted">No impacted machines</div>';

    container.className = '';
    container.innerHTML = `
      <div class="small muted" style="margin-bottom: 10px;">Preview for <strong>${escapeHtml(
        partCode
      )}</strong> (Qty ${qty.toFixed(0)}) in <strong>${escapeHtml(month)}</strong></div>

      <div style="font-weight: 900; margin-bottom: 6px;">Predicted assignments</div>
      <div class="stack" style="gap: 6px;">${assignHtml}${backlogHtml}</div>

      <div style="font-weight: 900; margin-top: 14px; margin-bottom: 6px;">Utilization before vs after</div>
      <div class="stack" style="gap: 10px;">${impactHtml}</div>
    `;
  }, 250);
}

function nextOrderId() {
  // Simple stable order id: O1, O2, ...
  const existingNums = state.orders
    .map((o) => String(o.order_id || ''))
    .map((id) => (id.startsWith('O') ? Number.parseInt(id.slice(1), 10) : NaN))
    .filter((n) => Number.isFinite(n));
  const max = existingNums.length ? Math.max(...existingNums) : 0;
  return `O${max + 1}`;
}

function solveForMonth(month) {
  const orders = state.orders
    .filter((o) => o.month === month)
    .map((o) => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity }));

  const solution = solveScheduleGreedy({
    machines: state.machines,
    orders,
    routingLong: ROUTING_LONG,
    machineRoute: MACHINE_ROUTE,
    times: TIMES,
    allowBacklog: SOLVER_CONFIG.allowBacklog,
    lambdaOT: SOLVER_CONFIG.lambdaOT,
    lambdaBL: SOLVER_CONFIG.lambdaBL,
    lambdaALT: SOLVER_CONFIG.lambdaALT,
    primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
  });

  state.solutionsByMonth[month] = solution;
}

function solveForMonthWithOverrides(month, overrides) {
  const orders = state.orders
    .filter((o) => o.month === month)
    .map((o) => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity }));

  return solveScheduleGreedy({
    machines: state.machines,
    orders,
    routingLong: ROUTING_LONG,
    machineRoute: MACHINE_ROUTE,
    times: TIMES,
    allowBacklog: SOLVER_CONFIG.allowBacklog,
    lambdaOT: SOLVER_CONFIG.lambdaOT,
    lambdaBL: SOLVER_CONFIG.lambdaBL,
    lambdaALT: SOLVER_CONFIG.lambdaALT,
    primaryUtilizationCap: overrides?.primaryUtilizationCap ?? SOLVER_CONFIG.primaryUtilizationCap
  });
}

function nextMonthStr(monthStr) {
  const [yStr, mStr] = String(monthStr).split('-');
  const y = Number.parseInt(yStr, 10);
  const m = Number.parseInt(mStr, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthStr;

  const m2 = m + 1;
  const nextY = m2 > 12 ? y + 1 : y;
  const nextM = m2 > 12 ? 1 : m2;
  return `${nextY}-${String(nextM).padStart(2, '0')}`;
}

async function handleScheduleJob() {
  const qty = Number.parseFloat(state.jobForm.units);
  if (!Number.isFinite(qty) || qty <= 0 || !state.jobForm.partCode) {
    alert('Please select part code and enter a valid quantity');
    return;
  }

  const order = {
    id: Date.now(),
    order_id: nextOrderId(),
    part_code: state.jobForm.partCode,
    quantity: qty,
    month: state.jobForm.month,
    priority: state.jobForm.priority,
    createdAt: new Date().toISOString()
  };

  state.orders = [...state.orders, order];

  try {
    await apiCreateOrder({
      id: order.id,
      order_id: order.order_id,
      part_code: order.part_code,
      quantity: order.quantity,
      month: order.month,
      priority: order.priority,
      created_at: order.createdAt
    });
  } catch {
    // fallback: keep in-memory
  }

  // Run the scheduler for the selected month.
  solveForMonth(order.month);
  saveData();

  const solution = state.solutionsByMonth[order.month];
  const assigned = solution.assignments.filter((a) => a.order_id === order.order_id);
  const backlogged = solution.backlogged_operations.filter((b) => b.order_id === order.order_id);

  const utilArr = computeUtilization({ machineSummary: solution.machine_summary });
  const assignedMachines = [...new Set(assigned.map((a) => a.machine))];
  const assignedMachineUtil = assignedMachines
    .map((m) => {
      const u = utilArr.find((x) => x.machine === m);
      return { machine: m, pct: (u?.regularUtil ?? 0) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  const anyOver = assignedMachineUtil.some((x) => x.pct >= 90);
  const anyAltUsed = assigned.some((a) => a.route_type === 'ALT');
  const needsHelp = backlogged.length > 0 || anyOver;

  let bodyHtml = `
    <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">Order <strong>${escapeHtml(
      order.order_id
    )}</strong> scheduled for <strong>${escapeHtml(monthLabel(order.month))}</strong></div>
    <div class="muted" style="margin-bottom: 12px;">Part: <strong>${escapeHtml(order.part_code)}</strong> | Quantity: <strong>${order.quantity}</strong></div>
  `;

  if (assigned.length) {
    const rows = assigned
      .map(
        (a) => `
        <div class="item" style="padding: 10px;">
          <div style="font-weight: 900; margin-bottom: 6px;">${escapeHtml(a.operation)} → ${escapeHtml(a.machine)} <span class="pill ${a.route_type === 'ALT' ? 'yellow' : 'green'}" style="margin-left: 8px;">${escapeHtml(
            a.route_type
          )}</span></div>
          <div class="kv">
            <span>Total time (min)</span><strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(2)}</strong>
            <span>Unit time (min/unit)</span><strong>${a.unit_time_min_per_unit.toFixed(2)}</strong>
            <span>Setup time (min)</span><strong>${a.setup_time_min.toFixed(2)}</strong>
          </div>
        </div>
      `
      )
      .join('');

    bodyHtml += `
      <div style="font-weight: 900; margin-bottom: 8px; color: rgba(34, 211, 238, 1);">Assignments</div>
      <div class="stack">${rows}</div>
    `;
  }

  if (backlogged.length) {
    const rows = backlogged
      .map((b) => `<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);">${escapeHtml(
        b.operation
      )} (backlogged) — ${escapeHtml(b.reason || '')}</div>`)
      .join('');
    bodyHtml += `
      <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px; color: rgba(239, 68, 68, 1);">Backlogged</div>
      <div class="stack">${rows}</div>
    `;
  }

  if (assignedMachineUtil.length) {
    const rows = assignedMachineUtil
      .map((x) => `<div class="small"><span class="muted">${escapeHtml(x.machine)}:</span> <strong>${x.pct.toFixed(1)}%</strong></div>`)
      .join('');
    bodyHtml += `
      <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px;">Machine utilization impact</div>
      <div class="stack" style="gap: 6px;">${rows}</div>
    `;
  }

  if (needsHelp) {
    const rebalanceCap = Math.max(0.6, SOLVER_CONFIG.primaryUtilizationCap - 0.15);
    const nextMonth = nextMonthStr(order.month);

    bodyHtml += `
      <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px;">Rescheduling recommendations</div>
      <div class="item" style="padding: 10px;">
        <div class="small" style="margin-bottom: 10px;">
          ${backlogged.length ? 'This order has backlogged operations. ' : ''}
          ${anyOver ? 'Some assigned machines are over-utilized. ' : ''}
          ${anyAltUsed ? 'Alternatives were used for some steps. ' : ''}
        </div>
        <div class="actions" style="justify-content: flex-start; gap: 10px; flex-wrap: wrap;">
          <button class="btn" type="button" id="rebalanceBtn">Rebalance (allow alts earlier)</button>
          <button class="btn" type="button" id="nextMonthBtn">Move order to ${escapeHtml(nextMonth)} and re-solve</button>
        </div>
        <div class="small muted" style="margin-top: 10px;">
          Rebalance runs the same month with a lower primary utilization cap (${(rebalanceCap * 100).toFixed(
            0
          )}%) so 1.1 alternatives are considered sooner when primary machines are queued.
        </div>
      </div>
    `;
  }

  renderModalHtml({
    title: 'Schedule Result',
    titleColor: assigned.length ? '#86efac' : '#fecaca',
    bodyHtml
  });

  if (needsHelp) {
    const rebalanceBtn = document.getElementById('rebalanceBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    if (rebalanceBtn) {
      rebalanceBtn.addEventListener('click', () => {
        const rebalanceCap = Math.max(0.6, SOLVER_CONFIG.primaryUtilizationCap - 0.15);
        const newSolution = solveForMonthWithOverrides(order.month, { primaryUtilizationCap: rebalanceCap });
        state.solutionsByMonth[order.month] = newSolution;

        const assigned2 = newSolution.assignments.filter((a) => a.order_id === order.order_id);
        const backlogged2 = newSolution.backlogged_operations.filter((b) => b.order_id === order.order_id);

        renderModalHtml({
          title: 'Schedule Result (Rebalanced)',
          titleColor: assigned2.length && backlogged2.length === 0 ? '#86efac' : '#fde68a',
          bodyHtml: `
            <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">Order <strong>${escapeHtml(
              order.order_id
            )}</strong> re-solved for <strong>${escapeHtml(monthLabel(order.month))}</strong></div>
            <div class="muted" style="margin-bottom: 12px;">Mode: <strong>allow alts earlier</strong> (primary cap ${(
              rebalanceCap * 100
            ).toFixed(0)}%)</div>
            <div style="font-weight: 900; margin-bottom: 8px; color: rgba(34, 211, 238, 1);">Assignments</div>
            <div class="stack">${
              assigned2.length
                ? assigned2
                    .map(
                      (a) => `
                      <div class="item" style="padding: 10px;">
                        <div style="font-weight: 900; margin-bottom: 6px;">${escapeHtml(a.operation)} → ${escapeHtml(
                          a.machine
                        )} <span class="pill ${a.route_type === 'ALT' ? 'yellow' : 'green'}" style="margin-left: 8px;">${escapeHtml(
                          a.route_type
                        )}</span></div>
                        <div class="small muted">Total time: <strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(
                          2
                        )} min</strong></div>
                      </div>
                    `
                    )
                    .join('')
                : '<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);">No assignment</div>'
            }</div>
            ${
              backlogged2.length
                ? `
                  <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px; color: rgba(239, 68, 68, 1);">Backlogged</div>
                  <div class="stack">${backlogged2
                    .map(
                      (b) => `<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);">${escapeHtml(
                        b.operation
                      )} (backlogged) — ${escapeHtml(b.reason || '')}</div>`
                    )
                    .join('')}</div>
                `
                : ''
            }
          `
        });

        render();
      });
    }

    if (nextMonthBtn) {
      nextMonthBtn.addEventListener('click', () => {
        const oldMonth = order.month;
        const newMonth = nextMonthStr(order.month);

        state.orders = state.orders.map((o) => (o.id === order.id ? { ...o, month: newMonth } : o));
        order.month = newMonth;

        solveForMonth(oldMonth);
        solveForMonth(newMonth);
        saveData();

        const sol = state.solutionsByMonth[newMonth];
        const assigned2 = sol.assignments.filter((a) => a.order_id === order.order_id);
        const backlogged2 = sol.backlogged_operations.filter((b) => b.order_id === order.order_id);

        renderModalHtml({
          title: 'Schedule Result (Moved Month)',
          titleColor: assigned2.length && backlogged2.length === 0 ? '#86efac' : '#fde68a',
          bodyHtml: `
            <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">Order <strong>${escapeHtml(
              order.order_id
            )}</strong> moved to <strong>${escapeHtml(monthLabel(newMonth))}</strong></div>
            <div class="muted" style="margin-bottom: 12px;">Part: <strong>${escapeHtml(
              order.part_code
            )}</strong> | Quantity: <strong>${order.quantity}</strong></div>
            <div style="font-weight: 900; margin-bottom: 8px; color: rgba(34, 211, 238, 1);">Assignments</div>
            <div class="stack">${
              assigned2.length
                ? assigned2
                    .map(
                      (a) => `
                      <div class="item" style="padding: 10px;">
                        <div style="font-weight: 900; margin-bottom: 6px;">${escapeHtml(a.operation)} → ${escapeHtml(
                          a.machine
                        )} <span class="pill ${a.route_type === 'ALT' ? 'yellow' : 'green'}" style="margin-left: 8px;">${escapeHtml(
                          a.route_type
                        )}</span></div>
                        <div class="small muted">Total time: <strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(
                          2
                        )} min</strong></div>
                      </div>
                    `
                    )
                    .join('')
                : '<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);">No assignment</div>'
            }</div>
            ${
              backlogged2.length
                ? `
                  <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px; color: rgba(239, 68, 68, 1);">Backlogged</div>
                  <div class="stack">${backlogged2
                    .map(
                      (b) => `<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);">${escapeHtml(
                        b.operation
                      )} (backlogged) — ${escapeHtml(b.reason || '')}</div>`
                    )
                    .join('')}</div>
                `
                : ''
            }
          `
        });

        resetForm();
        syncFormToInputs();
        render();
      });
    }
  }

  resetForm();
  syncFormToInputs();
  render();
}

function deleteOrder(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  state.orders = state.orders.filter((o) => o.id !== orderId);

  apiDeleteOrder(orderId).catch(() => {
    // ignore
  });

  if (order) {
    solveForMonth(order.month);
  }

  saveData();
  render();
}

function getSolution(month) {
  if (!state.solutionsByMonth[month]) {
    solveForMonth(month);
    saveData();
  }
  return state.solutionsByMonth[month];
}

function renderDashboard() {
  const grid = document.getElementById('dashboardGrid');
  const month = state.currentMonth;
  const solution = getSolution(month);

  grid.innerHTML = '';

  const utilArr = computeUtilization({ machineSummary: solution.machine_summary });
  const mean = computeMeanUtilization(utilArr);
  const std = computeStdDevUtilization(utilArr);

  const machineUtilRows = solution.machine_summary.map((ms) => {
    const u = utilArr.find((x) => x.machine === ms.machine);
    const pct = (u?.regularUtil ?? 0) * 100;
    const status = pct < 70 ? 'UNDER' : pct < 90 ? 'NORMAL' : 'OVER';
    return { machine: ms.machine, pct, status };
  });

  const under = machineUtilRows.filter((r) => r.status === 'UNDER').sort((a, b) => a.pct - b.pct);
  const normal = machineUtilRows.filter((r) => r.status === 'NORMAL').sort((a, b) => b.pct - a.pct);
  const over = machineUtilRows.filter((r) => r.status === 'OVER').sort((a, b) => b.pct - a.pct);

  // Summary card
  const summary = document.createElement('div');
  summary.className = 'card';
  summary.style.gridColumn = '1 / -1';
  summary.innerHTML = `
    <div style="font-weight: 900; font-size: 16px; margin-bottom: 10px;">Utilization Summary</div>
    <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap: 10px;">
      <div class="item"><div class="small">Mean Utilization</div><div style="font-weight: 900; color: rgba(34, 211, 238, 1);">${(
        mean * 100
      ).toFixed(1)}%</div></div>
      <div class="item"><div class="small">Std Dev Utilization</div><div style="font-weight: 900;">${(
        std * 100
      ).toFixed(1)}%</div></div>
      <div class="item"><div class="small">Objective (approx)</div><div style="font-weight: 900;">${solution.objectiveApprox.toFixed(
        2
      )}</div></div>
      <div class="item"><div class="small">Backlogged Ops</div><div style="font-weight: 900;">${solution.backlogged_operations.length}</div></div>
      <div class="item"><div class="small">Under-utilized</div><div style="font-weight: 900; color: #fde68a;">${under.length}</div></div>
      <div class="item"><div class="small">Normal-utilized</div><div style="font-weight: 900; color: #86efac;">${normal.length}</div></div>
      <div class="item"><div class="small">Over-utilized</div><div style="font-weight: 900; color: #fecaca;">${over.length}</div></div>
    </div>
  `;
  grid.appendChild(summary);

  for (const ms of solution.machine_summary) {
    const u = utilArr.find((x) => x.machine === ms.machine);
    const utilizationPct = (u?.regularUtil ?? 0) * 100;
    const availableRegular = Math.max(0, ms.A_min - ms.U_min);
    const availableMax = Math.max(0, ms.A_min + ms.OT_max - ms.U_min);

    const machineMeta = state.machines.find((m) => m.name === ms.machine);

    const statusText = utilizationPct < 70 ? 'UNDER-UTILIZED' : utilizationPct < 90 ? 'NORMAL' : 'OVER-UTILIZED';

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="item-top" style="margin-bottom: 10px;">
        <div>
          <div style="font-weight: 900; font-size: 16px;">${escapeHtml(ms.machine)}</div>
          <div class="small">
            Planning bucket: <strong>month</strong>
            <span class="muted">(Regular: ${ms.A_min} min | OT max: ${ms.OT_max} min)</span>
          </div>
          <div class="small">Status: <strong>${escapeHtml(statusText)}</strong></div>
          ${machineMeta
            ? `<div class="small">Daily calendar: ${machineMeta.workHoursPerDay}h/day (${machineMeta.A_day_min} min) | OT policy: ${machineMeta.maxOtHoursPerDay}h/day (${machineMeta.OT_day_max} min) | Work days: ${machineMeta.workDaysPerMonth}/month</div>`
            : ''}
        </div>
        <span class="pill ${getPillClass(utilizationPct)}">${utilizationPct.toFixed(1)}%</span>
      </div>
      <div class="stack" style="gap: 10px;">
        <div class="progress"><div class="${getUtilizationClass(utilizationPct)}" style="width: ${Math.min(
          utilizationPct,
          100
        )}%"></div></div>
        <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="item"><div class="small">Utilized (U<sub>i</sub>)</div><div style="font-weight: 900; color: rgba(34, 211, 238, 1);">${ms.U_min.toFixed(
            2
          )} min</div></div>
          <div class="item"><div class="small">Overtime (OT<sub>i</sub>)</div><div style="font-weight: 900;">${ms.OT_min.toFixed(
            2
          )} min</div></div>
          <div class="item"><div class="small">Available (Regular)</div><div style="font-weight: 900; color: #86efac;">${availableRegular.toFixed(
            2
          )} min</div></div>
          <div class="item"><div class="small">Available (Regular+OT)</div><div style="font-weight: 900; color: #86efac;">${availableMax.toFixed(
            2
          )} min</div></div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  }
}

function renderCalendar() {
  const list = document.getElementById('calendarList');
  const month = state.currentMonth;
  const solution = getSolution(month);

  const orders = state.orders
    .filter((o) => o.month === month)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!orders.length) {
    list.innerHTML = `<div class="placeholder">No orders scheduled for this month</div>`;
    return;
  }

  list.innerHTML = '';

  for (const order of orders) {
    const wrap = document.createElement('div');
    wrap.className = 'item';

    const priority = order.priority || 'normal';
    const pillClass = priority === 'high' ? 'red' : priority === 'low' ? 'yellow' : 'green';

    const assigns = solution.assignments.filter((a) => a.order_id === order.order_id);
    const backlogs = solution.backlogged_operations.filter((b) => b.order_id === order.order_id);

    // Lighten up the border if any assigned machine is over-utilized
    const utilArr = computeUtilization({ machineSummary: solution.machine_summary });
    const hasOverUtilizedMachine = assigns.some(a => {
      const ms = solution.machine_summary.find(m => m.machine === a.machine);
      if (!ms) return false;
      const u = utilArr.find(x => x.machine === a.machine);
      return ((u?.regularUtil ?? 0) * 100) >= 90;
    });

    if (hasOverUtilizedMachine) {
      wrap.style.borderColor = 'rgba(206, 50, 50, 1)';
      wrap.style.borderWidth = '2px';
    }

    const assignsHtml = assigns.length
      ? assigns
          .map(
            (a) =>
              `<div class="small"><span class="muted">${escapeHtml(a.operation)}:</span> <strong>${escapeHtml(
                a.machine
              )}</strong> — <strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(
                2
              )} min</strong></div>`
          )
          .join('')
      : '<div class="small muted">No assignment (backlogged)</div>';

    const backlogHtml = backlogs.length
      ? `<div class="small" style="color: #fecaca; margin-top: 6px;">Backlogged: ${escapeHtml(
          backlogs.map((b) => b.operation).join(', ')
        )}</div>`
      : '';

    wrap.innerHTML = `
      <div class="item-top">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <h3>${escapeHtml(order.order_id)} — ${escapeHtml(order.part_code)}</h3>
            <span class="pill ${pillClass}">${escapeHtml(priority.toUpperCase())}</span>
          </div>
          <div class="grid-2" style="grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-bottom: 10px;">
            <div class="small"><span class="muted">Quantity:</span> <strong>${order.quantity}</strong></div>
            <div class="small"><span class="muted">Month:</span> <strong>${escapeHtml(order.month)}</strong></div>
            <div class="small"><span class="muted">Created:</span> <strong>${new Date(order.createdAt).toLocaleDateString()}</strong></div>
          </div>
          <div class="stack" style="gap: 6px;">${assignsHtml}${backlogHtml}</div>
        </div>
        <div>
          <div class="actions" style="justify-content: flex-end; gap: 10px; flex-wrap: wrap;">
            <button class="btn" type="button" data-details="${order.id}">Details</button>
            <button class="btn" type="button" data-edit="${order.id}">Edit</button>
            <button class="btn danger" type="button" data-del="${order.id}">Delete</button>
          </div>
        </div>
      </div>
    `;

    wrap.querySelector('[data-del]').addEventListener('click', () => deleteOrder(order.id));
    wrap.querySelector('[data-details]').addEventListener('click', () => showOrderDetailsModal(order.id));
    wrap.querySelector('[data-edit]').addEventListener('click', () => showEditOrderModal(order.id));
    list.appendChild(wrap);
  }
}

function showOrderDetailsModal(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const solution = getSolution(order.month);
  const assigned = solution.assignments.filter((a) => a.order_id === order.order_id);
  const backlogged = solution.backlogged_operations.filter((b) => b.order_id === order.order_id);

  const utilArr = computeUtilization({ machineSummary: solution.machine_summary });
  const machines = [...new Set(assigned.map((a) => a.machine))]
    .map((m) => {
      const u = utilArr.find((x) => x.machine === m);
      return { machine: m, pct: (u?.regularUtil ?? 0) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  const assignsHtml = assigned.length
    ? assigned
        .map(
          (a) => `
            <div class="item" style="padding: 10px;">
              <div style="font-weight: 900; margin-bottom: 6px;">${escapeHtml(a.operation)} → ${escapeHtml(
            a.machine
          )} <span class="pill ${a.route_type === 'ALT' ? 'yellow' : 'green'}" style="margin-left: 8px;">${escapeHtml(
            a.route_type
          )}</span></div>
              <div class="kv">
                <span>Total time (min)</span><strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(2)}</strong>
                <span>Unit time (min/unit)</span><strong>${a.unit_time_min_per_unit.toFixed(2)}</strong>
                <span>Setup time (min)</span><strong>${a.setup_time_min.toFixed(2)}</strong>
              </div>
            </div>
          `
        )
        .join('')
    : '<div class="small muted">No assignments (backlogged)</div>';

  const backlogHtml = backlogged.length
    ? `<div class="stack" style="gap: 8px;">${backlogged
        .map(
          (b) => `<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);">${escapeHtml(
            b.operation
          )} (backlogged) — ${escapeHtml(b.reason || '')}</div>`
        )
        .join('')}</div>`
    : '';

  const utilHtml = machines.length
    ? machines
        .map(
          (m) => `<div class="small"><span class="muted">${escapeHtml(m.machine)}:</span> <strong>${m.pct.toFixed(
            1
          )}%</strong></div>`
        )
        .join('')
    : '<div class="small muted">No impacted machines</div>';

  renderModalHtml({
    title: 'Order Details',
    titleColor: '#93c5fd',
    bodyHtml: `
      <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">Order <strong>${escapeHtml(
        order.order_id
      )}</strong></div>
      <div class="muted" style="margin-bottom: 12px;">Part: <strong>${escapeHtml(
        order.part_code
      )}</strong> | Quantity: <strong>${order.quantity}</strong> | Month: <strong>${escapeHtml(
      monthLabel(order.month)
    )}</strong></div>

      <div style="font-weight: 900; margin-bottom: 8px; color: rgba(34, 211, 238, 1);">Assignments</div>
      <div class="stack">${assignsHtml}</div>

      ${
        backlogHtml
          ? `
              <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px; color: rgba(239, 68, 68, 1);">Backlogged</div>
              ${backlogHtml}
            `
          : ''
      }

      <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px;">Machine utilization impact</div>
      <div class="stack" style="gap: 6px;">${utilHtml}</div>
    `
  });
}

function showEditOrderModal(orderId) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return;

  const partCodes = Object.keys(PART_SIZES || {}).sort();
  const partOptions = partCodes
    .map((p) => `<option value="${escapeHtml(p)}" ${p === order.part_code ? 'selected' : ''}>${escapeHtml(p)}</option>`)
    .join('');

  renderModalHtml({
    title: 'Edit Order',
    titleColor: '#fde68a',
    bodyHtml: `
      <div class="muted" style="margin-bottom: 12px;">Editing <strong>${escapeHtml(order.order_id)}</strong></div>

      <div class="form">
        <div class="field">
          <label for="editPartCode">Part Code</label>
          <select id="editPartCode">${partOptions}</select>
        </div>

        <div class="field">
          <label for="editQty">Required Capacity (Units)</label>
          <input id="editQty" type="number" value="${escapeHtml(String(order.quantity))}" />
        </div>

        <div class="grid-2">
          <div class="field">
            <label for="editPriority">Priority</label>
            <select id="editPriority">
              <option value="low" ${order.priority === 'low' ? 'selected' : ''}>Low</option>
              <option value="normal" ${order.priority === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="high" ${order.priority === 'high' ? 'selected' : ''}>High</option>
            </select>
          </div>
          <div class="field">
            <label for="editMonth">Target Month</label>
            <input id="editMonth" type="month" value="${escapeHtml(order.month)}" />
          </div>
        </div>
      </div>
    `
  });

  const modalBody = document.getElementById('modalBody');
  const actions = modalBody?.querySelector('.actions');
  const modalClose = modalBody?.querySelector('#modalClose');

  if (modalClose) {
    modalClose.textContent = 'Cancel';
  }

  let save = modalBody?.querySelector('#editSaveBtn');
  if (!save && actions) {
    save = document.createElement('button');
    save.className = 'btn primary';
    save.type = 'button';
    save.id = 'editSaveBtn';
    save.textContent = 'Save';
    actions.insertBefore(save, modalClose || null);
  }

  if (!save) return;

  save.addEventListener('click', async () => {
    const part = document.getElementById('editPartCode').value;
    const qty = Number.parseFloat(document.getElementById('editQty').value);
    const priority = document.getElementById('editPriority').value;
    const month = document.getElementById('editMonth').value;

    if (!part || !Number.isFinite(qty) || qty <= 0 || !month) {
      alert('Please enter a valid part code, quantity, and month.');
      return;
    }

    const oldMonth = order.month;

    state.orders = state.orders.map((o) =>
      o.id === orderId
        ? {
            ...o,
            part_code: part,
            quantity: qty,
            priority,
            month
          }
        : o
    );

    const updatedOrder = state.orders.find((o) => o.id === orderId);
    if (updatedOrder) {
      try {
        await apiUpdateOrder({
          id: updatedOrder.id,
          order_id: updatedOrder.order_id,
          part_code: updatedOrder.part_code,
          quantity: updatedOrder.quantity,
          month: updatedOrder.month,
          priority: updatedOrder.priority
        });
      } catch {
        // ignore
      }
    }

    solveForMonth(oldMonth);
    if (month !== oldMonth) solveForMonth(month);
    saveData();

    closeModal();
    render();
  });
}

function renderForecast() {
  const stack = document.getElementById('forecastStack');
  stack.innerHTML = '';

  const year = Number.parseInt(String(state.currentMonth || isoMonth(new Date())).slice(0, 4), 10);
  const months = Array.from({ length: 12 }, (_, idx) => {
    const m = idx + 1;
    return `${year}-${String(m).padStart(2, '0')}`;
  });
  const monthLabels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const machineNames = state.machines.map((m) => m.name);
  const utilByMonthMachine = {};

  for (const month of months) {
    const sol = getSolution(month);
    const utilArr = computeUtilization({ machineSummary: sol.machine_summary });
    const map = {};
    for (const ms of sol.machine_summary) {
      const u = utilArr.find((x) => x.machine === ms.machine);
      map[ms.machine] = (u?.regularUtil ?? 0) * 100;
    }
    utilByMonthMachine[month] = map;
  }

  const wrap = document.createElement('div');
  wrap.className = 'forecast-table-wrap';

  wrap.innerHTML = `
    <div class="util-legend">
      <div class="small muted">Legend</div>
      <div class="util-legend-items">
        <span class="pill yellow">Under (&lt;70%)</span>
        <span class="pill green">Normal (70–89%)</span>
        <span class="pill red">Over (≥90%)</span>
      </div>
    </div>
  `;

  const head = `
    <thead>
      <tr>
        <th class="sticky-col">MACHINE NAME</th>
        ${monthLabels.map((m) => `<th>${m}</th>`).join('')}
      </tr>
    </thead>
  `;

  const body = `
    <tbody>
      ${machineNames
        .map((mach) => {
          const tds = months
            .map((month) => {
              const pct = utilByMonthMachine?.[month]?.[mach] ?? 0;
              const s = utilHeatStyle(pct);
              return `<td class="util-cell" style="background:${s.bg}; color:${s.fg};">${pct.toFixed(0)}%</td>`;
            })
            .join('');
          return `<tr><th class="sticky-col">${escapeHtml(mach)}</th>${tds}</tr>`;
        })
        .join('')}
    </tbody>
  `;

  wrap.insertAdjacentHTML(
    'beforeend',
    `
      <div class="util-table-scroll">
        <table class="util-table">${head}${body}</table>
      </div>
    `
  );

  stack.appendChild(wrap);
}

function syncFormToInputs() {
  document.getElementById('partCode').value = state.jobForm.partCode;
  document.getElementById('units').value = state.jobForm.units;
  document.getElementById('priority').value = state.jobForm.priority;
  document.getElementById('targetMonth').value = state.jobForm.month;
  renderSelectedPartSize({ partCode: state.jobForm.partCode });
}

function render() {
  renderScheduleFormDerived();

  document.getElementById('dashboardMonth').value = state.currentMonth;
  document.getElementById('calendarMonth').value = state.currentMonth;

  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'calendar') renderCalendar();
  if (state.activeTab === 'forecast') renderForecast();

  renderIcons();
}

function wireEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const username = document.getElementById('loginUsername').value.trim();
      const password = document.getElementById('loginPassword').value;
      const err = document.getElementById('loginError');
      if (err) {
        err.style.display = 'none';
        err.textContent = '';
      }

      try {
        const res = await apiLogin({ username, password });
        state.user = res?.user ?? { username };
        setAuthUi(true);
        loadData();
        setActiveTab('schedule');
      } catch (e) {
        if (err) {
          err.style.display = '';
          err.textContent = String(e?.message || 'Login failed');
        }
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiLogout();
      } catch {
        // ignore
      }
      state.user = null;
      state.orders = [];
      state.solutionsByMonth = {};
      setAuthUi(false);
      setActiveTab('login');
    });
  }

  document.getElementById('partCode').addEventListener('change', (e) => setJobForm({ partCode: e.target.value }));
  document.getElementById('units').addEventListener('input', (e) => setJobForm({ units: e.target.value }));
  document.getElementById('priority').addEventListener('change', (e) => setJobForm({ priority: e.target.value }));

  document.getElementById('targetMonth').addEventListener('change', (e) => {
    setJobForm({ month: e.target.value });
    renderScheduleFormDerived();
  });

  document.getElementById('scheduleBtn').addEventListener('click', handleScheduleJob);

  document.getElementById('dashboardMonth').addEventListener('change', (e) => {
    state.currentMonth = e.target.value;
    render();
  });

  document.getElementById('calendarMonth').addEventListener('change', (e) => {
    state.currentMonth = e.target.value;
    render();
  });

  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target && e.target.id === 'modalOverlay') {
      closeModal();
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function init() {
  apiMe()
    .then((d) => {
      const authed = !!d?.user;
      state.user = d?.user ?? null;
      setAuthUi(authed);
      if (!authed) {
        setActiveTab('login');
        renderIcons();
        return;
      }
      loadData();
    })
    .catch(() => {
      state.user = null;
      setAuthUi(false);
      setActiveTab('login');
    });

  state.currentMonth = isoMonth(new Date());
  state.jobForm.month = isoMonth(new Date());

  document.getElementById('targetMonth').value = state.jobForm.month;
  document.getElementById('dashboardMonth').value = state.currentMonth;
  document.getElementById('calendarMonth').value = state.currentMonth;

  // Ensure there's a solution cached for the current month.
  solveForMonth(state.currentMonth);
  saveData();

  sanityCheckEmbeddedData();

  wireEvents();
  render();
  updateScheduleButtonState();
  renderIcons();
}

init();
