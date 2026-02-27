const STORAGE_KEYS = {
  orders: 'milp_orders_v1',
  solutionsByMonth: 'milp_solutions_by_month_v1'
};

const cloneDeep = (obj) => {
  if (typeof globalThis.structuredClone === 'function') {
    try {
      return globalThis.structuredClone(obj);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(obj));
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
  machines: cloneDeep(MACHINES),
  // Orders are what the user enters (Order ID, Part Code, Quantity).
  orders: [],
  user: null,
  // Solutions are derived per month by running the scheduler.
  solutionsByMonth: {},
  activeTab: 'schedule',
  currentMonth: isoMonth(new Date()),
  viewYear: new Date().getFullYear(),
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

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function utilHeatStyle(pct) {
  // Keep coloring consistent with UI display which rounds to whole percent.
  const p = clamp(Math.round(Number(pct) || 0), 0, 150);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  const lerp = (a, b, t) => a + (b - a) * t;
  const mixRgb = (c1, c2, t) => [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t))
  ];

  const rgbLuma = (c) => {
    const [r, g, b] = c.map((x) => (Number(x) || 0) / 255);
    const toLin = (u) => (u <= 0.04045 ? u / 12.92 : Math.pow((u + 0.055) / 1.055, 2.4));
    const R = toLin(r);
    const G = toLin(g);
    const B = toLin(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
  };

  const pickFgForRgb = (rgb) => {
    const L = rgbLuma(rgb);
    return L > 0.52 ? 'rgba(15, 23, 42, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  };

  const YELLOW_RGB = [250, 204, 21];
  const GREEN_RGB = [34, 197, 94];
  const RED_RGB = [239, 68, 68];

  const rgb = p < 70 ? YELLOW_RGB : p < 90 ? GREEN_RGB : RED_RGB;
  const bgAlpha = isLight ? 0.70 : 0.50;
  const bg = `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${bgAlpha})`;
  const fg = isLight ? pickFgForRgb(rgb) : `rgb(${mixRgb(rgb, [255, 255, 255], 0.75).join(', ')})`;
  return { bg, fg };
}

function splitRefInfo(orderId) {
  const id = String(orderId || '');
  const m = id.match(/^(.*?)-S\d+$/);
  if (!m) return { isSplitChild: false, parentOrderId: '' };
  return { isSplitChild: true, parentOrderId: m[1] };
}

function isCapacityBacklogReason(reason) {
  const r = String(reason || '').toLowerCase();
  if (!r) return false;
  if (r.includes('missing time')) return false;
  if (r.includes('no eligible machines')) return false;
  if (r.includes('missing machine calendar')) return false;
  if (r.includes('no feasible machine') && (r.includes('ot_max') || r.includes('a_min') || r.includes('exceeds'))) return true;
  if (r.includes('exceeds') && (r.includes('a_min') || r.includes('ot_max'))) return true;
  if (r.includes('ot_max')) return true;
  if (r.includes('over by')) return true;
  return false;
}

function monthYear(monthStr) {
  const y = Number.parseInt(String(monthStr || '').slice(0, 4), 10);
  return Number.isFinite(y) ? y : new Date().getFullYear();
}

function listAvailableYears() {
  const ys = new Set();
  ys.add(monthYear(state.currentMonth || isoMonth(new Date())));
  ys.add(monthYear(state.jobForm?.month || isoMonth(new Date())));
  for (const o of state.orders || []) {
    if (o?.month) ys.add(monthYear(o.month));
  }
  const arr = [...ys].filter((y) => Number.isFinite(y)).sort((a, b) => a - b);
  if (!arr.length) return [new Date().getFullYear()];

  // Always offer at least current year and next year.
  const cur = new Date().getFullYear();
  arr.push(cur);
  arr.push(cur + 1);
  return [...new Set(arr)].sort((a, b) => a - b);
}

function monthsOfYear(year) {
  const y = Number.parseInt(String(year), 10);
  const yy = Number.isFinite(y) ? y : new Date().getFullYear();
  return Array.from({ length: 12 }, (_, idx) => `${yy}-${String(idx + 1).padStart(2, '0')}`);
}

const supportsPassiveEvents = (() => {
  let ok = false;
  try {
    const opts = Object.defineProperty({}, 'passive', {
      get() {
        ok = true;
        return false;
      }
    });
    window.addEventListener('test-passive', null, opts);
    window.removeEventListener('test-passive', null, opts);
  } catch {
    ok = false;
  }
  return ok;
})();

function syncForecastYearSelect() {
  const sel = document.getElementById('forecastYear');
  if (!sel) return;

  const years = listAvailableYears();
  const current = Number.parseInt(String(state.viewYear), 10);
  const next = Number.isFinite(current) ? current : years[0];

  sel.innerHTML = years.map((y) => `<option value="${y}">${y}</option>`).join('');
  sel.value = String(years.includes(next) ? next : years[0]);
  state.viewYear = Number.parseInt(sel.value, 10);
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

async function apiListUsers() {
  return apiFetchJson('./api/users.php');
}

async function apiChangePassword({ current_password, new_password }) {
  return apiFetchJson('./api/users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'change_password', current_password, new_password })
  });
}

async function apiCreateUser({ username, password }) {
  return apiFetchJson('./api/users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create_user', username, password })
  });
}

async function apiChangeUsername({ new_username }) {
  return apiFetchJson('./api/users.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'change_username', new_username })
  });
}

function setAuthUi(isAuthed) {
  const loginTabBtn = document.getElementById('loginTabBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const accountTabBtn = document.getElementById('accountTabBtn');
  if (loginTabBtn) loginTabBtn.style.display = isAuthed ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = isAuthed ? '' : 'none';
  if (accountTabBtn) accountTabBtn.style.display = isAuthed ? '' : 'none';
}

function renderAccount() {
  const panel = document.getElementById('accountPanel');
  if (!panel) return;

  const me = state.user;
  if (!me) {
    panel.innerHTML = '<div class="muted">Please login to access account settings.</div>';
    return;
  }

  const isAdmin = String(me.username || '') === 'admin';

  panel.innerHTML = `
    <div class="grid-2">
      <div class="card">
        <h2 class="card-title"><i data-lucide="key" aria-hidden="true"></i><span>Change Password</span></h2>
        <div class="form">
          <div class="field">
            <label for="acctCurrentPassword">Current Password</label>
            <input id="acctCurrentPassword" type="password" autocomplete="current-password" />
          </div>
          <div class="field">
            <label for="acctNewPassword">New Password</label>
            <input id="acctNewPassword" type="password" autocomplete="new-password" />
          </div>
          <button class="btn primary" type="button" id="acctChangePwBtn">Update Password</button>
          <div id="acctChangePwMsg" class="small" style="display:none;"></div>
        </div>
      </div>

      <div class="card">
        <h2 class="card-title"><i data-lucide="user" aria-hidden="true"></i><span>Change Username</span></h2>
        ${isAdmin
          ? `<div class="muted small">The <strong>admin</strong> username is locked.</div>`
          : `
            <div class="form">
              <div class="field">
                <label for="acctNewUsernameSelf">New Username</label>
                <input id="acctNewUsernameSelf" type="text" autocomplete="off" value="${escapeHtml(String(me.username || ''))}" />
              </div>
              <button class="btn" type="button" id="acctChangeUsernameBtn">Update Username</button>
              <div id="acctChangeUsernameMsg" class="small" style="display:none;"></div>
              <div class="small muted" style="margin-top: 8px;">You may need to logout/login if anything looks stale.</div>
            </div>
          `}
      </div>

      <div class="card">
        <h2 class="card-title"><i data-lucide="users" aria-hidden="true"></i><span>User Management</span></h2>
        ${isAdmin
          ? `
            <div class="form">
              <div class="field">
                <label for="acctNewUsername">New Username</label>
                <input id="acctNewUsername" type="text" autocomplete="off" />
              </div>
              <div class="field">
                <label for="acctNewUserPassword">New User Password</label>
                <input id="acctNewUserPassword" type="password" autocomplete="new-password" />
              </div>
              <button class="btn" type="button" id="acctCreateUserBtn">Create User</button>
              <div id="acctCreateUserMsg" class="small" style="display:none;"></div>
            </div>
            <div style="height: 12px;"></div>
            <div class="small muted" style="margin-bottom: 8px;">Existing users</div>
            <div id="acctUsersList" class="stack" style="gap: 8px;"><div class="muted small">Loading…</div></div>
          `
          : `<div class="muted small">Only <strong>admin</strong> can create or list accounts.</div>`}
      </div>
    </div>
  `;

  const setMsg = (el, text, ok) => {
    if (!el) return;
    el.style.display = '';
    el.style.color = ok ? 'rgba(134, 239, 172, 1)' : 'rgba(254, 202, 202, 1)';
    el.textContent = text;
  };

  const pwBtn = document.getElementById('acctChangePwBtn');
  const pwMsg = document.getElementById('acctChangePwMsg');
  if (pwBtn) {
    pwBtn.addEventListener('click', async () => {
      const current_password = document.getElementById('acctCurrentPassword')?.value ?? '';
      const new_password = document.getElementById('acctNewPassword')?.value ?? '';
      pwBtn.disabled = true;
      try {
        await apiChangePassword({ current_password, new_password });
        setMsg(pwMsg, 'Password updated.', true);
        const a = document.getElementById('acctCurrentPassword');
        const b = document.getElementById('acctNewPassword');
        if (a) a.value = '';
        if (b) b.value = '';
      } catch (e) {
        setMsg(pwMsg, String(e?.message || 'Failed to update password'), false);
      } finally {
        pwBtn.disabled = false;
      }
    });
  }

  const unameBtn = document.getElementById('acctChangeUsernameBtn');
  const unameMsg = document.getElementById('acctChangeUsernameMsg');
  if (unameBtn) {
    unameBtn.addEventListener('click', async () => {
      const new_username = (document.getElementById('acctNewUsernameSelf')?.value ?? '').trim();
      unameBtn.disabled = true;
      try {
        const res = await apiChangeUsername({ new_username });
        if (res?.user) {
          state.user = res.user;
        } else {
          state.user = { ...(state.user || {}), username: new_username };
        }
        setMsg(unameMsg, 'Username updated.', true);
        setAuthUi(true);
      } catch (e) {
        setMsg(unameMsg, String(e?.message || 'Failed to update username'), false);
      } finally {
        unameBtn.disabled = false;
      }
    });
  }

  const renderUsersList = async () => {
    if (!isAdmin) return;
    const list = document.getElementById('acctUsersList');
    if (!list) return;
    try {
      const data = await apiListUsers();
      const users = Array.isArray(data?.users) ? data.users : [];
      if (!users.length) {
        list.innerHTML = '<div class="muted small">No users found.</div>';
        return;
      }
      list.innerHTML = users
        .map((u) => `<div class="item" style="padding: 10px;"><strong>${escapeHtml(String(u.username || ''))}</strong><div class="small muted">Created: ${escapeHtml(String(u.created_at || ''))}</div></div>`)
        .join('');
    } catch (e) {
      list.innerHTML = `<div class="small" style="color: rgba(254, 202, 202, 1);">${escapeHtml(
        String(e?.message || 'Failed to load users')
      )}</div>`;
    }
  };

  const createBtn = document.getElementById('acctCreateUserBtn');
  const createMsg = document.getElementById('acctCreateUserMsg');
  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const username = (document.getElementById('acctNewUsername')?.value ?? '').trim();
      const password = document.getElementById('acctNewUserPassword')?.value ?? '';
      createBtn.disabled = true;
      try {
        await apiCreateUser({ username, password });
        setMsg(createMsg, `User "${username}" created.`, true);
        const a = document.getElementById('acctNewUsername');
        const b = document.getElementById('acctNewUserPassword');
        if (a) a.value = '';
        if (b) b.value = '';
        await renderUsersList();
      } catch (e) {
        setMsg(createMsg, String(e?.message || 'Failed to create user'), false);
      } finally {
        createBtn.disabled = false;
      }
    });
  }

  renderUsersList();
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

async function apiListOptimizeHistory({ limit = 30 } = {}) {
  const data = await apiFetchJson(`./api/optimize_history.php?limit=${encodeURIComponent(String(limit))}`);
  return Array.isArray(data?.history) ? data.history : [];
}

async function apiGetOptimizeHistory(id) {
  return apiFetchJson(`./api/optimize_history.php?id=${encodeURIComponent(String(id))}`);
}

async function apiCreateOptimizeHistory(payload) {
  return apiFetchJson('./api/optimize_history.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'create', ...payload })
  });
}

async function apiRestoreOptimizeHistory({ id, version }) {
  return apiFetchJson('./api/optimize_history.php', {
    method: 'POST',
    body: JSON.stringify({ action: 'restore', id, version })
  });
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
        createdBy: r.created_by || r.createdBy || '',
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

function simplifyReason(reason) {
  if (!reason) return 'No reason provided';
  
  // Strip common technical terms and codes
  let clean = reason
    .replace(/\(A_min \+ OT_max\)/g, 'exceeds total monthly capacity')
    .replace(/A_min/g, 'regular capacity')
    .replace(/OT_max/g, 'overtime limit')
    .replace(/U_min/g, 'utilized minutes')
    .replace(/OT_min/g, 'overtime minutes')
    .replace(/min/g, 'minutes')
    .replace(/:\s*\d+\s*\|/g, ':') // Remove count numbers
    .replace(/\(\d+%\)/g, '') // Remove percentages
    .replace(/needs [\d.]+ minutes but [\w_]+ is [\d.]+ minutes \(over by [\d.]+ minutes\)/g, (match) => {
        const parts = match.match(/over by ([\d.]+) minutes/);
        return parts ? `requires ${parts[1]} more minutes than available` : 'exceeds available time';
    });

  // Handle "Closest Machine" part
  if (clean.includes('closest machine')) {
    const parts = clean.split('closest machine');
    const machineNameMatch = parts[1].match(/"([^"]+)"/);
    const machineName = machineNameMatch ? machineNameMatch[1] : 'alternative machine';
    const detail = parts[1].split(':').pop().trim();
    return `Closest Machine: ${machineName} - ${detail}`;
  }

  // Fallback for "No Feasible Machine"
  if (clean.includes('No feasible machine')) {
    const detail = clean.split(':').pop().trim();
    return `No Feasible Machine - ${detail}`;
  }

  return clean;
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
            (b) => `<div class="small" style="color: rgba(185, 28, 28, 0.95);"><strong>${escapeHtml(b.operation)}:</strong> ${escapeHtml(simplifyReason(b.reason))}</div>`
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

async function moveOrderToMonth(orderId, newMonth) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const oldMonth = order.month;
  
  // 1. Update local state
  state.orders = state.orders.map(o => o.id === orderId ? { ...o, month: newMonth } : o);
  order.month = newMonth;

  // 2. Persist to DB
  try {
    await apiUpdateOrder({
      id: order.id,
      order_id: order.order_id,
      part_code: order.part_code,
      quantity: order.quantity,
      month: newMonth,
      priority: order.priority,
      created_at: order.createdAt
    });
  } catch (err) {
    console.error('Failed to update order month on server:', err);
  }

  // 3. Re-solve both months
  solveForMonth(oldMonth);
  solveForMonth(newMonth);
  saveData();
  render();
}

async function splitOrderIntoNextMonth(orderId, thresholdPct) {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: 'Order not found' };

  const currentSol = state.solutionsByMonth[order.month];
  const backloggedNow = currentSol?.backlogged_operations?.filter((b) => b.order_id === order.order_id) ?? [];
  if (backloggedNow.length) {
    const reasons = backloggedNow.map((b) => b.reason || '');
    const capacity = reasons.some((x) => isCapacityBacklogReason(x));
    if (!capacity) {
      return {
        ok: false,
        reason: 'This backlog looks like a data/routing issue (e.g., missing time rows or no eligible machines). Splitting quantity will not fix it.'
      };
    }
  }

  const month = order.month;
  const nextM = nextMonthStr(month);
  const baseQty = Number.parseFloat(order.quantity) || 0;
  if (!Number.isFinite(baseQty) || baseQty <= 1) {
    return { ok: false, reason: 'Quantity too small to split' };
  }

  const ordersForMonthBase = state.orders
    .filter((o) => o.month === month)
    .map((o) => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity }));

  const solveWithQty = (q) => {
    const ordersForMonth = ordersForMonthBase.map((o) =>
      o.order_id === order.order_id ? { ...o, quantity: q } : o
    );
    return solveScheduleGreedy({
      machines: state.machines,
      orders: ordersForMonth,
      routingLong: ROUTING_LONG,
      machineRoute: MACHINE_ROUTE,
      times: TIMES,
      allowBacklog: SOLVER_CONFIG.allowBacklog,
      lambdaOT: SOLVER_CONFIG.lambdaOT,
      lambdaBL: SOLVER_CONFIG.lambdaBL,
      lambdaALT: SOLVER_CONFIG.lambdaALT,
      primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
    });
  };

  const computeAssignedUtilPct = (solution) => {
    const assigned = solution.assignments.filter((a) => a.order_id === order.order_id);
    const utilArr = computeUtilization({ machineSummary: solution.machine_summary });
    const machines = [...new Set(assigned.map((a) => a.machine))];
    return machines
      .map((m) => {
        const u = utilArr.find((x) => x.machine === m);
        return (u?.regularUtil ?? 0) * 100;
      })
      .sort((a, b) => b - a);
  };

  const minKeep = 1;
  const maxKeep = Math.max(minKeep, Math.floor(baseQty));
  let lo = minKeep;
  let hi = maxKeep;
  let bestKeep = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const sol = solveWithQty(mid);
    const backlogged = sol.backlogged_operations.filter((b) => b.order_id === order.order_id);
    const utilPct = computeAssignedUtilPct(sol);
    const severe = utilPct.some((p) => p >= thresholdPct);

    if (backlogged.length === 0 && !severe) {
      bestKeep = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (bestKeep <= 0 || bestKeep >= baseQty) {
    await moveOrderToMonth(orderId, nextM);
    return { ok: true, didSplit: false, movedTo: nextM };
  }

  const remainder = baseQty - bestKeep;
  if (remainder <= 0.0001) {
    await moveOrderToMonth(orderId, nextM);
    return { ok: true, didSplit: false, movedTo: nextM };
  }

  const childId = Math.floor(Date.now() + Math.random() * 100000);
  const childOrderId = `${order.order_id}-S${String(childId).slice(-4)}`;
  const child = {
    id: childId,
    order_id: childOrderId,
    part_code: order.part_code,
    quantity: remainder,
    month: nextM,
    priority: order.priority,
    createdAt: new Date().toISOString()
  };

  order.quantity = bestKeep;
  state.orders = state.orders.map((o) => (o.id === order.id ? { ...o, quantity: bestKeep } : o));
  try {
    await apiUpdateOrder({
      id: order.id,
      order_id: order.order_id,
      part_code: order.part_code,
      quantity: order.quantity,
      month: order.month,
      priority: order.priority,
      created_at: order.createdAt
    });
  } catch {
    // ignore
  }

  state.orders = [...state.orders, child];
  try {
    await apiCreateOrder({
      id: child.id,
      order_id: child.order_id,
      part_code: child.part_code,
      quantity: child.quantity,
      month: child.month,
      priority: child.priority,
      created_at: child.createdAt
    });
  } catch {
    // ignore
  }

  solveForMonth(month);
  solveForMonth(nextM);
  saveData();
  render();

  return { ok: true, didSplit: true, keptQty: bestKeep, childQty: remainder, childMonth: nextM, childOrderId };
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

  let currentMonth = order.month;
  let currentSolution = state.solutionsByMonth[currentMonth];
  let wasAutoRescheduled = false;
  let autoRescheduleReason = '';
  const splitChildren = [];
  const originalMonth = order.month;
  const originalQty = order.quantity;

  // Auto-reschedule triggers:
  // - backlogged operations
  // - severe over-utilization (keeps the existing UX safe with cancel/revert)
  const AUTO_OVERUTIL_THRESHOLD_PCT = 90;
  const autoGuardMax = 8;
  let autoGuard = 0;

  const computeAssignedUtil = (solution, orderIds) => {
    const assigned0 = solution.assignments.filter((a) => orderIds.includes(a.order_id));
    const utilArr0 = computeUtilization({ machineSummary: solution.machine_summary });
    const assignedMachines0 = [...new Set(assigned0.map((a) => a.machine))];
    return assignedMachines0
      .map((m) => {
        const u = utilArr0.find((x) => x.machine === m);
        return { machine: m, pct: (u?.regularUtil ?? 0) * 100 };
      })
      .sort((a, b) => b.pct - a.pct);
  };

  const solveMonthOrdersWithOverride = (month, overrideOrder) => {
    const ordersForMonth = state.orders
      .filter((o) => o.month === month)
      .map((o) => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity }));
    const idx = ordersForMonth.findIndex((o) => o.order_id === overrideOrder.order_id);
    if (idx >= 0) ordersForMonth[idx] = { ...ordersForMonth[idx], quantity: overrideOrder.quantity };
    else ordersForMonth.push({
      order_id: overrideOrder.order_id,
      part_code: overrideOrder.part_code,
      quantity: overrideOrder.quantity
    });

    return solveScheduleGreedy({
      machines: state.machines,
      orders: ordersForMonth,
      routingLong: ROUTING_LONG,
      machineRoute: MACHINE_ROUTE,
      times: TIMES,
      allowBacklog: SOLVER_CONFIG.allowBacklog,
      lambdaOT: SOLVER_CONFIG.lambdaOT,
      lambdaBL: SOLVER_CONFIG.lambdaBL,
      lambdaALT: SOLVER_CONFIG.lambdaALT,
      primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
    });
  };

  const trySplitIntoNextMonth = async ({ orderObj, month, reason }) => {
    const nextM = nextMonthStr(month);
    const baseQty = Number.parseFloat(orderObj.quantity) || 0;
    const minKeep = 1;
    const maxKeep = Math.max(minKeep, Math.floor(baseQty));

    let lo = minKeep;
    let hi = maxKeep;
    let bestKeep = 0;

    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const sol = solveMonthOrdersWithOverride(month, { ...orderObj, quantity: mid });
      const backlogged0 = sol.backlogged_operations.filter((b) => b.order_id === orderObj.order_id);
      const util0 = computeAssignedUtil(sol, [orderObj.order_id]);
      const severe0 = util0.some((x) => x.pct >= AUTO_OVERUTIL_THRESHOLD_PCT);

      if (backlogged0.length === 0 && !severe0) {
        bestKeep = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (bestKeep <= 0 || bestKeep >= baseQty) return false;

    const remainder = baseQty - bestKeep;
    if (remainder <= 0.0001) return false;

    const childId = Math.floor(Date.now() + Math.random() * 100000);
    const childOrderId = `${orderObj.order_id}-S${String(childId).slice(-4)}`;
    const child = {
      id: childId,
      order_id: childOrderId,
      part_code: orderObj.part_code,
      quantity: remainder,
      month: nextM,
      priority: orderObj.priority,
      createdAt: new Date().toISOString()
    };

    orderObj.quantity = bestKeep;
    state.orders = state.orders.map((o) => (o.id === orderObj.id ? { ...o, quantity: bestKeep } : o));
    try {
      await apiUpdateOrder({
        id: orderObj.id,
        order_id: orderObj.order_id,
        part_code: orderObj.part_code,
        quantity: orderObj.quantity,
        month: orderObj.month,
        priority: orderObj.priority,
        created_at: orderObj.createdAt
      });
    } catch {
      // ignore
    }

    state.orders = [...state.orders, child];
    try {
      await apiCreateOrder({
        id: child.id,
        order_id: child.order_id,
        part_code: child.part_code,
        quantity: child.quantity,
        month: child.month,
        priority: child.priority,
        created_at: child.createdAt
      });
    } catch {
      // ignore
    }

    solveForMonth(month);
    solveForMonth(nextM);
    saveData();
    render();

    wasAutoRescheduled = true;
    autoRescheduleReason = reason;
    splitChildren.push(child);
    return child;
  };

  let currentOrder = order;
  currentMonth = currentOrder.month;
  currentSolution = state.solutionsByMonth[currentMonth];

  while (autoGuard < autoGuardMax) {
    autoGuard += 1;

    const assigned0 = currentSolution.assignments.filter((a) => a.order_id === currentOrder.order_id);
    const backlogged0 = currentSolution.backlogged_operations.filter((b) => b.order_id === currentOrder.order_id);

    const utilArr0 = computeUtilization({ machineSummary: currentSolution.machine_summary });
    const assignedMachines0 = [...new Set(assigned0.map((a) => a.machine))];
    const assignedMachineUtil0 = assignedMachines0
      .map((m) => {
        const u = utilArr0.find((x) => x.machine === m);
        return { machine: m, pct: (u?.regularUtil ?? 0) * 100 };
      })
      .sort((a, b) => b.pct - a.pct);

    const hasSevereOver = assignedMachineUtil0.some((x) => x.pct >= AUTO_OVERUTIL_THRESHOLD_PCT);

    const backlogCapacity = backlogged0.some((b) => isCapacityBacklogReason(b.reason));

    if ((backlogged0.length > 0 && backlogCapacity) || hasSevereOver) {
      const reason = backlogged0.length
        ? 'This order was moved because it could not be fully completed in the selected month.'
        : `This order was moved because it would severely overload one or more machines (≥${AUTO_OVERUTIL_THRESHOLD_PCT}%).`;

      const child = await trySplitIntoNextMonth({ orderObj: currentOrder, month: currentMonth, reason });
      if (child) {
        currentOrder = child;
        currentMonth = child.month;
        currentSolution = state.solutionsByMonth[currentMonth];
        continue;
      }

      wasAutoRescheduled = true;
      autoRescheduleReason = reason;

      const nextMonth = nextMonthStr(currentMonth);
      await moveOrderToMonth(currentOrder.id, nextMonth);
      currentMonth = nextMonth;
      currentSolution = state.solutionsByMonth[currentMonth];
      continue;
    }

    if (backlogged0.length > 0 && !backlogCapacity) {
      autoRescheduleReason = 'This order is backlogged due to missing/invalid routing or time data (not capacity). Fix the data first; splitting or moving will not help.';
      break;
    }

    break;
  }

  const nextMonth = nextMonthStr(order.month);
  const scheduleLabel = splitChildren.length
    ? `${escapeHtml(monthLabel(originalMonth))} + ${escapeHtml(monthLabel(splitChildren[splitChildren.length - 1].month))}`
    : escapeHtml(monthLabel(nextMonth));

  const ref = splitRefInfo(order.order_id);
  const refHtml = ref.isSplitChild
    ? `<div class="small muted" style="margin-top: 6px;">Parent: <strong>${escapeHtml(ref.parentOrderId)}</strong></div>`
    : '';

  const displayOrderId = splitChildren.length ? splitChildren[splitChildren.length - 1].order_id : order.order_id;
  const assigned = currentSolution.assignments.filter((a) => a.order_id === displayOrderId);
  const backlogged = currentSolution.backlogged_operations.filter((b) => b.order_id === displayOrderId);

  const utilArr = computeUtilization({ machineSummary: currentSolution.machine_summary });
  const assignedMachines = [...new Set(assigned.map((a) => a.machine))];
  const assignedMachineUtil = assignedMachines
    .map((m) => {
      const u = utilArr.find((x) => x.machine === m);
      return { machine: m, pct: (u?.regularUtil ?? 0) * 100 };
    })
    .sort((a, b) => b.pct - a.pct);

  const anyOver = assignedMachineUtil.some((x) => x.pct >= 90);
  const anyAltUsed = assigned.some((a) => a.route_type === 'ALT');

  let bodyHtml = `
    <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">
      Order <strong>${escapeHtml(order.order_id)}</strong> 
      ${wasAutoRescheduled ? `automatically scheduled for <strong>${scheduleLabel}</strong>` : `scheduled for <strong>${escapeHtml(monthLabel(order.month))}</strong>`}
    </div>
    ${refHtml}
    ${wasAutoRescheduled ? `<div class="hint" style="margin-bottom: 12px; background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); color: rgba(185, 28, 28, 0.95);">
      ${escapeHtml(autoRescheduleReason || '')}
    </div>` : ''}
    <div class="muted" style="margin-bottom: 12px;">Part: <strong>${escapeHtml(order.part_code)}</strong> | Quantity: <strong>${order.quantity}</strong></div>
  `;

  if (splitChildren.length) {
    const chain = [
      { label: 'Portion 1', month: originalMonth, qty: order.quantity, orderIds: [order.order_id] },
      ...splitChildren.map((ch, idx) => ({
        label: `Portion ${idx + 2}`,
        month: ch.month,
        qty: ch.quantity,
        orderIds: [ch.order_id]
      }))
    ];

    for (const c of chain) solveForMonth(c.month);

    const renderMonthBlock = (label, month, q, sol, orderIds) => {
      const assigns = sol.assignments.filter((a) => orderIds.includes(a.order_id));
      const bl = sol.backlogged_operations.filter((b) => orderIds.includes(b.order_id));

      const assignHtml = assigns.length
        ? assigns
            .map(
              (a) =>
                `<div class="small"><span class="muted">${escapeHtml(a.operation)}:</span> <strong>${escapeHtml(
                  a.machine
                )}</strong> — <strong style="color: rgba(34, 211, 238, 1);">${a.total_time_min.toFixed(
                  1
                )} min</strong></div>`
            )
            .join('')
        : `<div class="small" style="color: rgba(239, 68, 68, 1);">No assignment (backlogged)</div>`;

      const blHtml = bl.length
        ? bl
            .map(
              (b) =>
                `<div class="small" style="color: rgba(239, 68, 68, 1);"><strong>${escapeHtml(
                  b.operation
                )}:</strong> ${escapeHtml(simplifyReason(b.reason))}</div>`
            )
            .join('')
        : '';

      return `
        <div class="item" style="padding: 10px;">
          <div style="font-weight: 900; margin-bottom: 6px;">${escapeHtml(label)} — ${escapeHtml(
            monthLabel(month)
          )}</div>
          <div class="muted small" style="margin-bottom: 10px;">Quantity: <strong>${q}</strong></div>
          <div class="stack" style="gap: 8px;">
            <div>
              <div style="font-weight: 900; margin-bottom: 6px;">Assignments</div>
              <div class="stack" style="gap: 6px;">${assignHtml}</div>
            </div>
            ${blHtml ? `<div>
              <div style="font-weight: 900; margin-bottom: 6px; color: rgba(239, 68, 68, 1);">Backlogged</div>
              <div class="stack" style="gap: 6px;">${blHtml}</div>
            </div>` : ''}
          </div>
        </div>
      `;
    };

    bodyHtml += `
      <div style="font-weight: 900; margin-bottom: 8px;">Split schedule</div>
      <div class="stack" style="gap: 12px;">
        ${chain
          .map((c) => renderMonthBlock(c.label, c.month, c.qty, state.solutionsByMonth[c.month], c.orderIds))
          .join('')}
      </div>
    `;
  }

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
      .map((b) => `<div class="item" style="padding: 10px; border-color: rgba(239, 68, 68, 0.35);"><strong>${escapeHtml(
        b.operation
      )}:</strong> ${escapeHtml(simplifyReason(b.reason))}</div>`)
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

  if (wasAutoRescheduled || anyOver) {
    bodyHtml += `
      <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px;">Rescheduling Actions</div>
      <div class="actions" style="justify-content: flex-start; gap: 10px; flex-wrap: wrap;">
        ${wasAutoRescheduled ? `<button class="btn danger" type="button" id="cancelRescheduleBtn">Cancel & Revert to ${escapeHtml(
          monthLabel(state.jobForm.month)
        )}</button>` : ''}
        <button class="btn" type="button" id="rebalanceBtn" style="display: none;">Try Rebalance (allow alts earlier)</button>
        ${!wasAutoRescheduled ? `<button class="btn" type="button" id="nextMonthBtn">Move order to ${escapeHtml(
          nextMonth
        )}</button>` : ''}
      </div>
    `;
  }

  renderModalHtml({
    title: 'Schedule Result',
    titleColor: assigned.length && backlogged.length === 0 ? '#86efac' : '#fde68a',
    bodyHtml
  });

  if (wasAutoRescheduled || anyOver) {
    const cancelBtn = document.getElementById('cancelRescheduleBtn');
    const rebalanceBtn = document.getElementById('rebalanceBtn');
    const nextMonthBtn = document.getElementById('nextMonthBtn');

    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        if (splitChildren.length) {
          for (const ch of splitChildren) {
            try {
              await apiDeleteOrder(ch.id);
            } catch {
              // ignore
            }
            state.orders = state.orders.filter((o) => o.id !== ch.id);
          }

          order.month = originalMonth;
          order.quantity = originalQty;
          state.orders = state.orders.map((o) => (o.id === order.id ? { ...o, month: originalMonth, quantity: originalQty } : o));
          try {
            await apiUpdateOrder({
              id: order.id,
              order_id: order.order_id,
              part_code: order.part_code,
              quantity: order.quantity,
              month: order.month,
              priority: order.priority,
              created_at: order.createdAt
            });
          } catch {
            // ignore
          }

          solveForMonth(originalMonth);
          for (const ch of splitChildren) {
            solveForMonth(ch.month);
          }
          saveData();
          render();
        } else {
          await moveOrderToMonth(order.id, state.jobForm.month);
        }
        closeModal();
        alert(`Order reverted to ${splitChildren.length ? monthLabel(originalMonth) : monthLabel(state.jobForm.month)}`);
      });
    }

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
            ${splitRefInfo(order.order_id).isSplitChild ? `<div class="small muted" style="margin-bottom: 10px;">Parent: <strong>${escapeHtml(splitRefInfo(order.order_id).parentOrderId)}</strong></div>` : ''}
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
      nextMonthBtn.addEventListener('click', async () => {
        const oldMonth = order.month;
        const newMonth = nextMonthStr(order.month);

        // 1. Update the order object in the local state
        state.orders = state.orders.map((o) => (o.id === order.id ? { ...o, month: newMonth } : o));
        order.month = newMonth;

        // 2. Persist the change to the database
        try {
          await apiUpdateOrder({
            id: order.id,
            order_id: order.order_id,
            part_code: order.part_code,
            quantity: order.quantity,
            month: newMonth,
            priority: order.priority,
            created_at: order.createdAt
          });
        } catch (err) {
          console.error('Failed to update order month on server:', err);
        }

        // 3. Re-solve for both affected months
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
            ${splitRefInfo(order.order_id).isSplitChild ? `<div class="small muted" style="margin-bottom: 10px;">Parent: <strong>${escapeHtml(splitRefInfo(order.order_id).parentOrderId)}</strong></div>` : ''}
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
    <div class="util-legend" style="margin-top: 12px; margin-bottom: 0; justify-content: flex-start; gap: 12px;">
      <div class="small muted">Legend</div>
      <div class="util-legend-items">
        <span class="pill yellow">Under (&lt;70%)</span>
        <span class="pill green">Normal (70–89%)</span>
        <span class="pill red">Over (≥90%)</span>
      </div>
    </div>
  `;
  grid.appendChild(summary);

  for (const ms of solution.machine_summary) {
    const u = utilArr.find((x) => x.machine === ms.machine);
    const utilizationPct = (u?.regularUtil ?? 0) * 100;
    const shownPct = Number(utilizationPct.toFixed(1));
    const availableRegular = Math.max(0, ms.A_min - ms.U_min);
    const availableMax = Math.max(0, ms.A_min + ms.OT_max - ms.U_min);

    const statusText = shownPct < 70 ? 'UNDER-UTILIZED' : shownPct < 90 ? 'NORMAL' : 'OVER-UTILIZED';
    const barStyle = utilHeatStyle(shownPct);

    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="item-top" style="margin-bottom: 10px;">
        <div>
          <div style="font-weight: 900; font-size: 16px;">${escapeHtml(ms.machine)}</div>
          <div class="small">Status: <strong>${escapeHtml(statusText)}</strong></div>
        </div>
        <span class="pill ${getPillClass(shownPct)}">${shownPct.toFixed(1)}%</span>
      </div>
      <div class="stack" style="gap: 10px;">
        <div class="progress"><div style="width: ${Math.min(shownPct, 100)}%; background: ${barStyle.bg};"></div></div>
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
      wrap.style.borderColor = 'var(--over-outline)';
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
      ? `<div class="small" style="color: rgba(185, 28, 28, 0.95); margin-top: 6px;">Backlogged: ${escapeHtml(
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
      ${splitRefInfo(order.order_id).isSplitChild ? `<div class="small muted" style="margin-bottom: 10px;">Parent: <strong>${escapeHtml(splitRefInfo(order.order_id).parentOrderId)}</strong></div>` : ''}
      <div class="muted" style="margin-bottom: 12px;">Part: <strong>${escapeHtml(
        order.part_code
      )}</strong> | Quantity: <strong>${order.quantity}</strong> | Month: <strong>${escapeHtml(
        monthLabel(order.month)
      )}</strong>${order.createdBy ? ` | Created by: <strong>${escapeHtml(order.createdBy)}</strong>` : ''}</div>

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

      ${backlogged.length ? `
        <div style="font-weight: 900; margin-top: 14px; margin-bottom: 8px;">Actions</div>
        <div class="actions" style="justify-content: flex-start; gap: 10px; flex-wrap: wrap;">
          <button class="btn" type="button" id="splitBackloggedBtn">Split / Move to next month</button>
        </div>
      ` : ''}
    `
  });

  if (backlogged.length) {
    const btn = document.getElementById('splitBackloggedBtn');
    if (btn) {
      btn.addEventListener('click', async () => {
        const ok = confirm('Try to split this order into next month to remove backlog? If splitting is not possible, it will be moved entirely.');
        if (!ok) return;
        btn.disabled = true;
        btn.textContent = 'Optimizing...';
        const res = await splitOrderIntoNextMonth(order.id, 90);
        closeModal();
        if (!res.ok) {
          alert(res.reason || 'Unable to optimize this order');
          return;
        }
        if (res.didSplit) {
          alert(`Split created: kept ${res.keptQty} in ${monthLabel(order.month)}, moved ${res.childQty} to ${monthLabel(res.childMonth)} as ${res.childOrderId}`);
        } else {
          alert(`Order moved to ${monthLabel(res.movedTo)}`);
        }
      });
    }
  }
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

function solveGlobalReoptimization(allOrders) {
  // Sort orders by priority and date to maintain some stability
  const sortedOrders = [...allOrders].sort((a, b) => {
    const priorityMap = { high: 0, normal: 1, low: 2 };
    if (priorityMap[a.priority] !== priorityMap[b.priority]) {
      return priorityMap[a.priority] - priorityMap[b.priority];
    }
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

  const origMonthById = Object.fromEntries(allOrders.map((o) => [o.id, o.month]));

  const year = Number.parseInt(String(state.currentMonth || isoMonth(new Date())).slice(0, 4), 10);
  const baseYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const months = [...monthsOfYear(baseYear), ...monthsOfYear(baseYear + 1)];

  const optimizedOrders = [];

  const cap = Number.isFinite(SOLVER_CONFIG.primaryUtilizationCap)
    ? SOLVER_CONFIG.primaryUtilizationCap
    : 0.9;

  const evaluateMonth = (month, ordersInMonth) => {
    const sol = solveScheduleGreedy({
      machines: state.machines,
      orders: ordersInMonth.map((o) => ({
        order_id: o.order_id,
        part_code: o.part_code,
        quantity: o.quantity
      })),
      routingLong: ROUTING_LONG,
      machineRoute: MACHINE_ROUTE,
      times: TIMES,
      allowBacklog: SOLVER_CONFIG.allowBacklog,
      lambdaOT: SOLVER_CONFIG.lambdaOT,
      lambdaBL: SOLVER_CONFIG.lambdaBL,
      lambdaALT: SOLVER_CONFIG.lambdaALT,
      primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
    });

    const utilArr = computeUtilization({ machineSummary: sol.machine_summary });
    const maxRegularUtil = utilArr.reduce((acc, u) => Math.max(acc, u.regularUtil || 0), 0);
    return { sol, backlogCount: sol.backlogged_operations.length, maxRegularUtil };
  };

  const badMonths = new Set();
  const movableOrderIdsByMonth = {};
  for (const m of months) {
    const inMonth = allOrders.filter((o) => o.month === m);
    if (!inMonth.length) continue;

    const { sol, backlogCount, maxRegularUtil } = evaluateMonth(m, inMonth);
    if (backlogCount > 0 || maxRegularUtil > cap + 1e-6) badMonths.add(m);

    const utilArr = computeUtilization({ machineSummary: sol.machine_summary });
    const overMachines = new Set(
      utilArr.filter((u) => (u.regularUtil ?? 0) > cap + 1e-6).map((u) => u.machine)
    );

    const movableOrderIds = new Set();

    // Orders that consume time on any over-cap machine are eligible to move.
    for (const a of sol.assignments || []) {
      if (overMachines.has(a.machine)) movableOrderIds.add(a.order_id);
    }

    // Orders that are capacity-backlogged are also eligible to move.
    for (const b of sol.backlogged_operations || []) {
      if (!isCapacityBacklogReason(b.reason)) continue;
      movableOrderIds.add(b.order_id);
    }

    movableOrderIdsByMonth[m] = movableOrderIds;
  }

  const isMovableFromMonth = (o) => {
    if (!badMonths.has(o.month)) return false;
    const set = movableOrderIdsByMonth[o.month];
    if (!set || !set.size) return false;
    return set.has(o.order_id);
  };

  const isMovableFromOrigin = (o) => {
    const originMonth = origMonthById[o.id];
    if (!originMonth) return true;
    if (!badMonths.has(originMonth)) return false;
    const set = movableOrderIdsByMonth[originMonth];
    if (!set || !set.size) return false;
    return set.has(o.order_id);
  };

  const fixedOrders = sortedOrders.filter((o) => !isMovableFromMonth(o));
  for (const o of fixedOrders) optimizedOrders.push({ ...o, month: o.month });

  // Phase 1: move whole orders forward (no splitting), prefer fewer backlogs and lower over-cap.
  for (const order of sortedOrders.filter((o) => isMovableFromMonth(o))) {
    let bestMonth = order.month;
    let bestScore = null;

    const startIdx = months.indexOf(order.month);
    const searchMonths = startIdx === -1 ? [order.month] : months.slice(startIdx);

    for (const m of searchMonths) {
      const mIdx = months.indexOf(m);
      const shiftMonths = startIdx === -1 || mIdx === -1 ? 0 : Math.max(0, mIdx - startIdx);
      const current = optimizedOrders.filter((o) => o.month === m);
      const testOrders = [...current, { ...order, month: m }];
      const { backlogCount, maxRegularUtil } = evaluateMonth(m, testOrders);

      const overCap = Math.max(0, maxRegularUtil - cap);
      // Weighted score:
      // - backlog dominates
      // - then over-cap magnitude
      // - then penalty for moving too far forward (encourages smoother month distribution)
      const BACKLOG_W = 1_000_000_000;
      const OVERCAP_W = 1_000_000;
      const SHIFT_W = 1_000;
      const weighted = backlogCount * BACKLOG_W + overCap * OVERCAP_W + shiftMonths * SHIFT_W;
      const score = { backlogCount, overCap, shiftMonths, weighted };

      if (bestScore === null) {
        bestScore = score;
        bestMonth = m;
        continue;
      }

      if (score.weighted < bestScore.weighted) {
        bestScore = score;
        bestMonth = m;
      }

      // Conservative: if we found a month with no backlog and no over-cap, accept immediately.
      if (score.backlogCount === 0 && score.overCap <= 1e-6) {
        bestMonth = m;
        break;
      }
    }

    optimizedOrders.push({ ...order, month: bestMonth });
  }

  // Phase 2 (conservative split): if a month still exceeds the cap, split low-priority orders forward.
  const priorityRank = { high: 0, normal: 1, low: 2 };
  const idTaken = new Set(optimizedOrders.map((o) => o.id));

  const makeChildId = () => {
    let id = Math.floor(Date.now() + Math.random() * 100000);
    while (idTaken.has(id)) id += 1;
    idTaken.add(id);
    return id;
  };

  const monthIndexByValue = Object.fromEntries(months.map((m, idx) => [m, idx]));
  const monthAt = (idx) => months[Math.max(0, Math.min(months.length - 1, idx))];

  for (let mi = 0; mi < months.length - 1; mi += 1) {
    const m = monthAt(mi);
    let changed = true;
    let guard = 0;

    while (changed && guard < 20) {
      guard += 1;
      changed = false;

      const monthOrders = optimizedOrders.filter((o) => o.month === m);
      if (!monthOrders.length) break;

      const { maxRegularUtil } = evaluateMonth(m, monthOrders);
      if (maxRegularUtil <= cap + 1e-6) break;

      // Pick a candidate: lowest priority first, then newest first, then biggest quantity.
      const candidates = [...monthOrders]
        .filter((o) => isMovableFromOrigin(o))
        .filter((o) => (o.quantity ?? 0) > 1)
        .sort((a, b) => {
          const pa = priorityRank[a.priority] ?? 1;
          const pb = priorityRank[b.priority] ?? 1;
          if (pa !== pb) return pb - pa;
          const ta = new Date(a.createdAt || a.created_at || 0).getTime();
          const tb = new Date(b.createdAt || b.created_at || 0).getTime();
          if (ta !== tb) return tb - ta;
          return (b.quantity ?? 0) - (a.quantity ?? 0);
        });

      const target = candidates[0];
      if (!target) break;

      const nextM = monthAt(mi + 1);
      const baseQty = Number.parseFloat(target.quantity) || 0;
      const minKeep = 1;
      const maxKeep = Math.max(minKeep, Math.floor(baseQty));

      // Binary search max qty we can keep in current month while meeting cap.
      let lo = minKeep;
      let hi = maxKeep;
      let bestKeep = minKeep;

      const restOrders = monthOrders.filter((o) => o.id !== target.id);

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        const testOrders = [...restOrders, { ...target, quantity: mid, month: m }];
        const { maxRegularUtil: maxU } = evaluateMonth(m, testOrders);
        if (maxU <= cap + 1e-6) {
          bestKeep = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // If we can't reduce enough (keeping 1 still over-cap), skip splitting this order.
      if (bestKeep >= baseQty) break;

      const remainder = baseQty - bestKeep;
      if (remainder <= 0.0001) break;

      // Apply: reduce original qty, create child order in next month.
      const childId = makeChildId();
      const childSuffix = String(childId).slice(-4);
      const childOrderId = `${target.order_id}-S${childSuffix}`;

      for (let i = 0; i < optimizedOrders.length; i += 1) {
        if (optimizedOrders[i].id === target.id) {
          optimizedOrders[i] = { ...optimizedOrders[i], quantity: bestKeep };
          break;
        }
      }

      optimizedOrders.push({
        ...target,
        id: childId,
        order_id: childOrderId,
        quantity: remainder,
        month: nextM
      });

      changed = true;
    }
  }

  // Keep output stable-ish (by month then priority then createdAt)
  return [...optimizedOrders].sort((a, b) => {
    const ma = monthIndexByValue[a.month] ?? 999;
    const mb = monthIndexByValue[b.month] ?? 999;
    if (ma !== mb) return ma - mb;

    const pa = priorityRank[a.priority] ?? 1;
    const pb = priorityRank[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;

    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function renderForecast() {
  const stack = document.getElementById('forecastStack');
  stack.innerHTML = '';

  const months = monthsOfYear(state.viewYear);
  const monthLabels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const machineNames = state.machines.map((m) => m.name);
  const utilByMonthMachine = {};

  const curSol = getSolution(state.currentMonth);
  const curUtilArr = computeUtilization({ machineSummary: curSol.machine_summary });
  const overUtilCount = curUtilArr.filter((u) => ((u?.regularUtil ?? 0) * 100) >= 100).length;
  const showReoptBtn = overUtilCount < 3;

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
    <div style="margin-bottom: 20px;">
      ${
        showReoptBtn
          ? `
            <button class="btn primary" type="button" id="forecastReoptBtn" style="width: 100%;">
              <i data-lucide="refresh-cw" style="width:16px;height:16px;margin-right:8px;"></i>
              Re-optimize Load
            </button>
          `
          : ''
      }
    </div>
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

  const reoptBtn = document.getElementById('forecastReoptBtn');
  if (reoptBtn) reoptBtn.addEventListener('click', handleGlobalReoptimize);
}

async function handleGlobalReoptimize() {
  const optimizedOrders = solveGlobalReoptimization(state.orders);
  
  // Calculate preview data
  const months = monthsOfYear(state.viewYear);
  const machineNames = state.machines.map((m) => m.name);
  const monthLabels = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  const getTableHtml = (ordersList, title) => {
    const utilMap = {};
    months.forEach(m => {
      const sol = solveScheduleGreedy({
        machines: state.machines,
        orders: ordersList.filter(o => o.month === m).map(o => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity })),
        routingLong: ROUTING_LONG,
        machineRoute: MACHINE_ROUTE,
        times: TIMES,
        allowBacklog: SOLVER_CONFIG.allowBacklog,
        lambdaOT: SOLVER_CONFIG.lambdaOT,
        lambdaBL: SOLVER_CONFIG.lambdaBL,
        lambdaALT: SOLVER_CONFIG.lambdaALT,
        primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
      });
      const uArr = computeUtilization({ machineSummary: sol.machine_summary });
      utilMap[m] = {};
      sol.machine_summary.forEach(ms => {
        const u = uArr.find(x => x.machine === ms.machine);
        utilMap[m][ms.machine] = (u?.regularUtil ?? 0) * 100;
      });
    });

    return `
      <div class="reopt-section">
        <div class="reopt-section-title">${title}</div>
        <div class="util-table-scroll reopt-table-scroll">
          <table class="util-table" style="font-size: 11px;">
            <thead>
              <tr><th class="sticky-col">MACHINE</th>${monthLabels.map(m => `<th>${m}</th>`).join('')}</tr>
            </thead>
            <tbody>
              ${machineNames.map(mach => `
                <tr>
                  <th class="sticky-col">${escapeHtml(mach)}</th>
                  ${months.map(m => {
                    const pct = utilMap[m][mach] ?? 0;
                    const s = utilHeatStyle(pct);
                    return `<td style="background:${s.bg}; color:${s.fg};">${pct.toFixed(0)}%</td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  const buildUtilSnapshot = (ordersList) => {
    const utilMap = {};
    months.forEach((m) => {
      const sol = solveScheduleGreedy({
        machines: state.machines,
        orders: ordersList
          .filter((o) => o.month === m)
          .map((o) => ({ order_id: o.order_id, part_code: o.part_code, quantity: o.quantity })),
        routingLong: ROUTING_LONG,
        machineRoute: MACHINE_ROUTE,
        times: TIMES,
        allowBacklog: SOLVER_CONFIG.allowBacklog,
        lambdaOT: SOLVER_CONFIG.lambdaOT,
        lambdaBL: SOLVER_CONFIG.lambdaBL,
        lambdaALT: SOLVER_CONFIG.lambdaALT,
        primaryUtilizationCap: SOLVER_CONFIG.primaryUtilizationCap
      });
      const uArr = computeUtilization({ machineSummary: sol.machine_summary });
      utilMap[m] = {};
      sol.machine_summary.forEach((ms) => {
        const u = uArr.find((x) => x.machine === ms.machine);
        utilMap[m][ms.machine] = (u?.regularUtil ?? 0) * 100;
      });
    });
    return utilMap;
  };

  renderModalHtml({
    title: 'Global Re-optimization Preview',
    titleColor: '#22d3ee',
    bodyHtml: `
      <div class="reopt-modal">
        <div class="item" style="padding: 12px; margin-bottom: 12px;">
          <div style="font-weight: 900; margin-bottom: 8px;">History</div>
          <div id="reoptHistoryBox" class="small muted">Loading history...</div>
        </div>

        <div class="small muted" style="margin-bottom: 12px;">
          The system has calculated a new distribution of orders across the year to minimize over-utilization and backlogs.
        </div>

        ${getTableHtml(state.orders, 'Current utilization')}

        <div class="reopt-divider"></div>
        <br><br>
        ${getTableHtml(optimizedOrders, 'Optimized preview')}

        <div class="hint" style="margin-top: 14px;">
          Click <strong>Save Changes</strong> to apply this new schedule to all orders in the database.
        </div>
      </div>
    `
  });

  // Sync horizontal scrolling between the two preview tables.
  const modalBody = document.getElementById('modalBody');
  const scrollBoxes = modalBody ? [...modalBody.querySelectorAll('.reopt-table-scroll')] : [];
  if (scrollBoxes.length >= 2) {
    const a = scrollBoxes[0];
    const b = scrollBoxes[1];

    a.scrollLeft = 0;
    b.scrollLeft = 0;

    let syncing = false;
    const sync = (src, dst) => {
      if (syncing) return;
      syncing = true;
      dst.scrollLeft = src.scrollLeft;
      syncing = false;
    };

    a.addEventListener('scroll', () => sync(a, b));
    b.addEventListener('scroll', () => sync(b, a));
  }

  const modalBody2 = document.getElementById('modalBody');
  const actions = modalBody2?.querySelector('.actions');
  const modalClose = modalBody2?.querySelector('#modalClose');
  if (modalClose) modalClose.textContent = 'Cancel';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn primary';
  saveBtn.textContent = 'Save Changes';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      const beforeOrdersSnapshot = state.orders.map((o) => ({
        id: o.id,
        order_id: o.order_id,
        part_code: o.part_code,
        quantity: o.quantity,
        month: o.month,
        priority: o.priority,
        created_at: o.createdAt
      }));
      const afterOrdersSnapshot = optimizedOrders.map((o) => ({
        id: o.id,
        order_id: o.order_id,
        part_code: o.part_code,
        quantity: o.quantity,
        month: o.month,
        priority: o.priority,
        created_at: o.createdAt
      }));

      const beforeUtilSnapshot = buildUtilSnapshot(state.orders);
      const afterUtilSnapshot = buildUtilSnapshot(optimizedOrders);

      const originalById = Object.fromEntries(state.orders.map((o) => [o.id, o]));

      const toUpdate = optimizedOrders.filter((opt) => {
        const orig = originalById[opt.id];
        if (!orig) return false;
        const q0 = Number.parseFloat(orig.quantity) || 0;
        const q1 = Number.parseFloat(opt.quantity) || 0;
        return orig.month !== opt.month || Math.abs(q0 - q1) > 1e-6 || orig.priority !== opt.priority;
      });

      const toCreate = optimizedOrders.filter((opt) => !originalById[opt.id]);

      for (const order of toUpdate) {
        await apiUpdateOrder({
          id: order.id,
          order_id: order.order_id,
          part_code: order.part_code,
          quantity: order.quantity,
          month: order.month,
          priority: order.priority,
          created_at: order.createdAt
        });
      }

      for (const order of toCreate) {
        await apiCreateOrder({
          id: order.id,
          order_id: order.order_id,
          part_code: order.part_code,
          quantity: order.quantity,
          month: order.month,
          priority: order.priority,
          created_at: order.createdAt
        });
      }

      state.orders = optimizedOrders;
      state.solutionsByMonth = {}; // Clear cache
      solveForMonth(state.currentMonth);
      saveData();

      try {
        await apiCreateOptimizeHistory({
          note: 'Global re-optimization',
          base_year: year,
          before_orders_json: JSON.stringify(beforeOrdersSnapshot),
          after_orders_json: JSON.stringify(afterOrdersSnapshot),
          before_util_json: JSON.stringify(beforeUtilSnapshot),
          after_util_json: JSON.stringify(afterUtilSnapshot)
        });
      } catch {
        // ignore
      }

      closeModal();
      render();
      alert(`Successfully re-optimized ${toUpdate.length + toCreate.length} orders across the year.`);
    } catch (err) {
      alert('Failed to save some changes: ' + err.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
  actions.insertBefore(saveBtn, modalClose);

  // History UI
  const historyBox = document.getElementById('reoptHistoryBox');
  apiListOptimizeHistory({ limit: 30 })
    .then((rows) => {
      if (!historyBox) return;
      if (!rows.length) {
        historyBox.innerHTML = 'No saved history yet.';
        return;
      }

      const options = rows
        .map((h) => {
          const label = `${new Date(h.created_at).toLocaleString()}${h.note ? ` — ${h.note}` : ''}`;
          return `<option value="${escapeHtml(String(h.id))}">${escapeHtml(label)}</option>`;
        })
        .join('');

      historyBox.innerHTML = `
        <div class="small muted" style="margin-bottom: 8px;">Restore a previously saved schedule snapshot.</div>
        <div class="actions" style="justify-content: flex-start; gap: 10px; flex-wrap: wrap;">
          <select id="reoptHistorySelect" style="width: 100%; max-width: 100%;">${options}</select>
          <button class="btn" type="button" id="restoreBeforeBtn">Restore BEFORE</button>
          <button class="btn danger" type="button" id="restoreAfterBtn">Restore AFTER</button>
        </div>
      `;

      const getSelectedId = () => {
        const sel = document.getElementById('reoptHistorySelect');
        const v = sel ? Number(sel.value) : 0;
        return Number.isFinite(v) ? v : 0;
      };

      const wireRestore = (btnId, version) => {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', async () => {
          const id = getSelectedId();
          if (!id) return;
          const ok = confirm(`Restore ${version.toUpperCase()} snapshot for this history entry? This will overwrite the current orders.`);
          if (!ok) return;
          btn.disabled = true;
          btn.textContent = 'Restoring...';
          try {
            await apiRestoreOptimizeHistory({ id, version });
            const rows2 = await apiListOrders();
            state.orders = rows2.map((r) => ({
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
            closeModal();
            alert('Restored successfully');
          } catch (e) {
            alert(String(e?.message || 'Restore failed'));
            btn.disabled = false;
            btn.textContent = version === 'before' ? 'Restore BEFORE' : 'Restore AFTER';
          }
        });
      };

      wireRestore('restoreBeforeBtn', 'before');
      wireRestore('restoreAfterBtn', 'after');
    })
    .catch(() => {
      if (historyBox) historyBox.innerHTML = 'History unavailable (API not reachable).';
    });
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

  syncForecastYearSelect();

  document.getElementById('dashboardMonth').value = state.currentMonth;
  document.getElementById('calendarMonth').value = state.currentMonth;

  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'calendar') renderCalendar();
  if (state.activeTab === 'forecast') renderForecast();
  if (state.activeTab === 'account') renderAccount();

  renderIcons();
}

function wireEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  const themeBtn = document.getElementById('themeToggleBtn');
  if (themeBtn) {
    const setThemeBtnLabel = () => {
      const t = document.documentElement.getAttribute('data-theme') || 'dark';
      themeBtn.textContent = t === 'light' ? 'Dark' : 'Light';
    };
    setThemeBtnLabel();

    let lastThemeToggleAt = 0;
    const doToggleTheme = (e) => {
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();

      // Debounce to avoid double-fire on mobile (touch + click).
      const now = Date.now();
      if (now - lastThemeToggleAt < 350) return;
      lastThemeToggleAt = now;

      const cur = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = cur === 'light' ? 'dark' : 'light';
      if (next === 'dark') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      try {
        localStorage.setItem('theme', next);
      } catch {
        // ignore
      }
      setThemeBtnLabel();
      render();
      renderIcons();
    };

    // Prefer pointer events when available; fall back for older mobile browsers.
    // Some older mobile browsers throw if an options object is passed.
    const opts = supportsPassiveEvents ? { passive: false } : false;
    if (typeof window.PointerEvent !== 'undefined') {
      themeBtn.addEventListener('pointerup', doToggleTheme, opts);
    } else {
      themeBtn.addEventListener('touchend', doToggleTheme, opts);
    }
    themeBtn.addEventListener('click', doToggleTheme);
  }

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

  const forecastYear = document.getElementById('forecastYear');
  if (forecastYear) {
    forecastYear.addEventListener('change', (e) => {
      const y = Number.parseInt(String(e.target.value), 10);
      if (Number.isFinite(y)) state.viewYear = y;
      render();
    });
  }

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
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
  } catch {
    // ignore
  }

  const extraRoutingLong = {
    AC065: { Op1: [{ machine: 'Turret Machine 1', pi_ij: 0 }] },
    AC066: { Op1: [{ machine: 'Turret Machine 2', pi_ij: 0 }] },
    AC067: { Op1: [{ machine: 'Turret Machine 3', pi_ij: 0 }] },
    AC068: { Op1: [{ machine: 'Arc Welding Machine', pi_ij: 0 }] },
    AC069: { Op1: [{ machine: 'Spot Weld 1', pi_ij: 0 }] },
    AC070: { Op1: [{ machine: 'Spot Weld 2', pi_ij: 0 }] }
  };

  const extraTimes = {
    AC065: { Op1: { 'Turret Machine 1': { unit_time_min_per_unit: 1.77, setup_time_min: 6.98 } } },
    AC066: { Op1: { 'Turret Machine 2': { unit_time_min_per_unit: 1.78, setup_time_min: 8.27 } } },
    AC067: { Op1: { 'Turret Machine 3': { unit_time_min_per_unit: 0.82, setup_time_min: 6.51 } } },
    AC068: { Op1: { 'Arc Welding Machine': { unit_time_min_per_unit: 1.78, setup_time_min: 8.27 } } },
    AC069: { Op1: { 'Spot Weld 1': { unit_time_min_per_unit: 1.77, setup_time_min: 3.67 } } },
    AC070: { Op1: { 'Spot Weld 2': { unit_time_min_per_unit: 0.97, setup_time_min: 9.38 } } }
  };

  for (const p of Object.keys(extraRoutingLong)) {
    if (!ROUTING_LONG?.[p]) ROUTING_LONG[p] = extraRoutingLong[p];
    if (!TIMES?.[p]) TIMES[p] = extraTimes[p];
  }

  const partCodeSelect = document.getElementById('partCode');
  if (partCodeSelect) {
    const cur = String(partCodeSelect.value || state.jobForm.partCode || '');
    const partCodes = Object.keys(PART_SIZES || {}).sort();
    partCodeSelect.innerHTML =
      `<option value="">Choose a part code...</option>` +
      partCodes.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
    if (cur && partCodes.includes(cur)) partCodeSelect.value = cur;
  }

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
