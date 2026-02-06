const STORAGE_KEYS = {
  machines: 'machines',
  schedules: 'schedules'
};

const DEFAULT_MACHINES = [
  { id: 1, name: 'AMADA 345', maxCapacity: 33484.8, workHours: 24, workDays: 8, type: 'Turret', currentLoad: 0 },
  { id: 2, name: 'AMADA 367', maxCapacity: 18278.4, workHours: 24, workDays: 8, type: 'Turret', currentLoad: 0 },
  { id: 3, name: 'LFK', maxCapacity: 10444.8, workHours: 24, workDays: 8, type: 'Turret', currentLoad: 0 },
  { id: 4, name: 'Spot Welding Machine 25KVA (A-Gun) #1 - WPI', maxCapacity: 111744, workHours: 24, workDays: 8, type: 'Spot Welding', currentLoad: 0 },
  { id: 5, name: 'ARC WELD #1', maxCapacity: 17126.4, workHours: 24, workDays: 8, type: 'Arc Weld', currentLoad: 0 },
  { id: 6, name: '50 KVA SPOT WELD', maxCapacity: 10636.8, workHours: 24, workDays: 8, type: 'Spot Welding', currentLoad: 0 }
];

function renderIcons() {
  if (typeof window.lucide?.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function isoMonth(date) {
  return date.toISOString().slice(0, 7);
}

function monthLabel(monthStr) {
  const d = new Date(`${monthStr}-01T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const state = {
  machines: structuredClone(DEFAULT_MACHINES),
  schedules: [],
  activeTab: 'schedule',
  currentMonth: isoMonth(new Date()),
  jobForm: {
    machineId: '',
    jobName: '',
    units: '',
    priority: 'normal',
    month: isoMonth(new Date())
  },
  recommendation: null,
  showRecommendation: false
};

function loadData() {
  try {
    const machinesRaw = localStorage.getItem(STORAGE_KEYS.machines);
    const schedulesRaw = localStorage.getItem(STORAGE_KEYS.schedules);

    if (machinesRaw) {
      const parsed = JSON.parse(machinesRaw);
      if (Array.isArray(parsed) && parsed.length) {
        state.machines = parsed;
      }
    }

    if (schedulesRaw) {
      const parsed = JSON.parse(schedulesRaw);
      if (Array.isArray(parsed)) {
        state.schedules = parsed;
      }
    }
  } catch {
    // ignore
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEYS.machines, JSON.stringify(state.machines));
  localStorage.setItem(STORAGE_KEYS.schedules, JSON.stringify(state.schedules));
}

function calculateMachineLoad(machineId, month) {
  return state.schedules
    .filter((s) => s.machineId === machineId && s.month === month && s.status === 'scheduled')
    .reduce((sum, s) => sum + s.totalCapacity, 0);
}

function getMachineUtilization(machine, month) {
  const load = calculateMachineLoad(machine.id, month);
  return (load / machine.maxCapacity) * 100;
}

function getUtilizationClass(percentage) {
  if (percentage < 70) return 'bar-green';
  if (percentage < 90) return 'bar-yellow';
  return 'bar-red';
}

function getPillClass(percentage) {
  if (percentage < 70) return 'green';
  if (percentage < 90) return 'yellow';
  return 'red';
}

function getMachineTypes() {
  return [...new Set(state.machines.map((m) => m.type))];
}

function findAlternativeMachine(machineType, requiredCapacity, month, excludeId) {
  const sameMachines = state.machines.filter((m) => m.type === machineType && m.id !== excludeId);

  for (const machine of sameMachines) {
    const currentLoad = calculateMachineLoad(machine.id, month);
    const available = machine.maxCapacity - currentLoad;
    if (available >= requiredCapacity) {
      return { machine, available };
    }
  }

  return null;
}

function setActiveTab(tabId) {
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

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function setJobForm(patch) {
  state.jobForm = { ...state.jobForm, ...patch };
  renderScheduleFormDerived();
}

function resetForm() {
  state.jobForm = {
    machineId: '',
    jobName: '',
    units: '',
    priority: 'normal',
    month: isoMonth(new Date())
  };
}

function updateScheduleButtonState() {
  const btn = document.getElementById('scheduleBtn');
  const enabled = Boolean(state.jobForm.machineId && state.jobForm.units && state.jobForm.jobName);
  btn.disabled = !enabled;
}

function renderMachineSelect() {
  const select = document.getElementById('machineId');
  const selected = state.jobForm.machineId;

  select.innerHTML = '<option value="">Choose a machine...</option>';

  const month = state.jobForm.month;
  const types = getMachineTypes();

  for (const type of types) {
    const group = document.createElement('optgroup');
    group.label = type;

    const machines = state.machines.filter((m) => m.type === type);
    for (const m of machines) {
      const option = document.createElement('option');
      option.value = String(m.id);
      option.textContent = `${m.name} - ${getMachineUtilization(m, month).toFixed(1)}% utilized`;
      group.appendChild(option);
    }

    select.appendChild(group);
  }

  select.value = selected;
}

function renderScheduleFormDerived() {
  const hint = document.getElementById('capacityHint');

  const unitsValue = state.jobForm.units;
  const machineIdValue = state.jobForm.machineId;

  if (!unitsValue || !machineIdValue) {
    hint.classList.add('hidden');
    hint.innerHTML = '';
    renderMachineInfo();
    updateScheduleButtonState();
    return;
  }

  const required = Number.parseFloat(unitsValue);
  const selectedMachine = state.machines.find((m) => m.id === Number.parseInt(machineIdValue, 10));

  if (!selectedMachine || !Number.isFinite(required)) {
    hint.classList.add('hidden');
    hint.innerHTML = '';
    renderMachineInfo();
    updateScheduleButtonState();
    return;
  }

  const currentLoad = calculateMachineLoad(selectedMachine.id, state.jobForm.month);
  const available = selectedMachine.maxCapacity - currentLoad;

  const warn = required > available;

  hint.classList.remove('hidden');
  hint.innerHTML = `
    <div><strong>Total Required Capacity:</strong> ${required.toFixed(2)}</div>
    <div class="small">Available on <strong>${escapeHtml(selectedMachine.name)}</strong>: ${available.toFixed(2)} ${
      warn ? '<span style="color: #fecaca; font-weight: 800;">(Exceeds capacity!)</span>' : ''
    }</div>
  `;

  renderMachineInfo();
  updateScheduleButtonState();
}

function renderMachineInfo() {
  const container = document.getElementById('machineInfo');
  const machineIdValue = state.jobForm.machineId;

  if (!machineIdValue) {
    container.className = 'placeholder';
    container.textContent = 'Select a machine to view details';
    return;
  }

  const machine = state.machines.find((m) => m.id === Number.parseInt(machineIdValue, 10));
  if (!machine) {
    container.className = 'placeholder';
    container.textContent = 'Select a machine to view details';
    return;
  }

  const utilization = getMachineUtilization(machine, state.jobForm.month);
  const currentLoad = calculateMachineLoad(machine.id, state.jobForm.month);
  const available = machine.maxCapacity - currentLoad;

  const sameType = state.machines.filter((m) => m.type === machine.type && m.id !== machine.id);

  container.className = '';
  container.innerHTML = `
    <div style="margin-bottom: 10px;">
      <div style="font-size: 18px; font-weight: 900; color: rgba(96, 165, 250, 1);">${escapeHtml(machine.name)}</div>
      <div class="small">Type: ${escapeHtml(machine.type)}</div>
    </div>

    <div class="stack" style="gap: 10px;">
      <div class="kv"><span>Max Capacity:</span><strong>${machine.maxCapacity.toFixed(2)}</strong></div>
      <div class="kv"><span>Current Load:</span><strong>${currentLoad.toFixed(2)}</strong></div>
      <div class="kv"><span>Available:</span><strong style="color: #86efac;">${available.toFixed(2)}</strong></div>
      <div class="kv"><span>Work Hours/Days:</span><strong>${machine.workHours}h × ${machine.workDays}d</strong></div>

      <div>
        <div class="kv" style="margin-bottom: 6px;"><span>Utilization</span><strong>${utilization.toFixed(1)}%</strong></div>
        <div class="progress"><div class="${getUtilizationClass(utilization)}" style="width: ${Math.min(utilization, 100)}%;"></div></div>
      </div>

      <div class="item" style="margin-top: 4px;">
        <div style="font-weight: 900; margin-bottom: 8px; color: rgba(34, 211, 238, 1);">Same Type Machines</div>
        ${
          sameType.length
            ? sameType
                .map((m) => {
                  const util = getMachineUtilization(m, state.jobForm.month);
                  const color = util < 90 ? 'color: #86efac;' : 'color: #fecaca;';
                  return `<div class="kv" style="grid-template-columns: 1fr auto;"><span style="color: rgba(226,232,240,0.85);">${escapeHtml(
                    m.name
                  )}</span><strong style="${color}">${util.toFixed(1)}%</strong></div>`;
                })
                .join('')
            : '<div class="small">No other machines of this type.</div>'
        }
      </div>
    </div>
  `;
}

function handleScheduleJob() {
  const machine = state.machines.find((m) => m.id === Number.parseInt(state.jobForm.machineId, 10));

  if (!machine) {
    alert('Please select a machine');
    return;
  }

  const totalCapacity = Number.parseFloat(state.jobForm.units);
  if (!totalCapacity || !state.jobForm.jobName) {
    alert('Please enter job name and required capacity');
    return;
  }

  const currentLoad = calculateMachineLoad(machine.id, state.jobForm.month);
  const available = machine.maxCapacity - currentLoad;

  if (totalCapacity <= available) {
    const newSchedule = {
      id: Date.now(),
      machineId: machine.id,
      machineName: machine.name,
      jobName: state.jobForm.jobName,
      units: Number.parseFloat(state.jobForm.units),
      totalCapacity,
      month: state.jobForm.month,
      priority: state.jobForm.priority,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    state.schedules = [...state.schedules, newSchedule];
    saveData();

    state.showRecommendation = true;
    state.recommendation = {
      type: 'success',
      message: `Job "${state.jobForm.jobName}" scheduled successfully on ${machine.name}`,
      details: `Capacity used: ${totalCapacity.toFixed(2)} / ${machine.maxCapacity.toFixed(2)} (${(
        (totalCapacity / machine.maxCapacity) *
        100
      ).toFixed(1)}%)`,
      schedule: newSchedule
    };

    resetForm();
    syncFormToInputs();
    render();
  } else {
    const alternative = findAlternativeMachine(machine.type, totalCapacity, state.jobForm.month, machine.id);

    const nextMonth = new Date(`${state.jobForm.month}-01T00:00:00`);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const nextMonthStr = isoMonth(nextMonth);

    state.showRecommendation = true;
    state.recommendation = {
      type: 'overload',
      message: `Machine ${machine.name} exceeds capacity`,
      details: `Required: ${totalCapacity.toFixed(2)} | Available: ${available.toFixed(2)} | Excess: ${(totalCapacity - available).toFixed(
        2
      )}`,
      alternative,
      nextMonth: nextMonthStr,
      originalJob: { ...state.jobForm, totalCapacity, machine }
    };

    renderModal();
  }
}

function applyRecommendation(option) {
  const rec = state.recommendation;
  if (!rec) return;

  if (option === 'alternative' && rec.alternative) {
    const newSchedule = {
      id: Date.now(),
      machineId: rec.alternative.machine.id,
      machineName: rec.alternative.machine.name,
      jobName: rec.originalJob.jobName,
      units: Number.parseFloat(rec.originalJob.units),
      totalCapacity: rec.originalJob.totalCapacity,
      month: rec.originalJob.month,
      priority: rec.originalJob.priority,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    state.schedules = [...state.schedules, newSchedule];
    saveData();
  } else if (option === 'reschedule') {
    const newSchedule = {
      id: Date.now(),
      machineId: rec.originalJob.machine.id,
      machineName: rec.originalJob.machine.name,
      jobName: rec.originalJob.jobName,
      units: Number.parseFloat(rec.originalJob.units),
      totalCapacity: rec.originalJob.totalCapacity,
      month: rec.nextMonth,
      priority: rec.originalJob.priority,
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };

    state.schedules = [...state.schedules, newSchedule];
    saveData();
  }

  closeModal();
  resetForm();
  syncFormToInputs();
  render();
}

function deleteSchedule(scheduleId) {
  state.schedules = state.schedules.filter((s) => s.id !== scheduleId);
  saveData();
  render();
}

function openModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  state.showRecommendation = false;
  state.recommendation = null;

  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');

  document.getElementById('modalBody').innerHTML = '';
}

function renderModal() {
  if (!state.showRecommendation || !state.recommendation) {
    closeModal();
    return;
  }

  const body = document.getElementById('modalBody');
  const rec = state.recommendation;

  if (rec.type === 'success') {
    body.innerHTML = `
      <h3 style="color: #86efac;">Schedule Confirmed</h3>
      <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">${escapeHtml(rec.message)}</div>
      <div class="muted">${escapeHtml(rec.details)}</div>
      <div class="actions">
        <button class="btn primary" type="button" id="modalClose">Close</button>
      </div>
    `;

    body.querySelector('#modalClose').addEventListener('click', closeModal);
    openModal();
    renderIcons();
    return;
  }

  const altHtml = rec.alternative
    ? `
      <div class="item" style="border-color: rgba(59, 130, 246, 0.55); background: rgba(59, 130, 246, 0.10);">
        <div style="font-weight: 900; margin-bottom: 6px;">Option 1: Transfer to Alternative Machine</div>
        <div class="small" style="margin-bottom: 6px;">
          Transfer to <strong style="color: rgba(96, 165, 250, 1);">${escapeHtml(
            rec.alternative.machine.name
          )}</strong> (same type: ${escapeHtml(rec.alternative.machine.type)})
        </div>
        <div class="small">Available capacity: ${rec.alternative.available.toFixed(2)}</div>
        <div class="actions" style="margin-top: 10px;">
          <button class="btn primary" type="button" id="applyAlt">Schedule on ${escapeHtml(
            rec.alternative.machine.name
          )}</button>
        </div>
      </div>
    `
    : '';

  const optionNum = rec.alternative ? 2 : 1;

  body.innerHTML = `
    <h3 style="color: #fecaca;">Capacity Exceeded</h3>
    <div style="font-size: 16px; font-weight: 900; margin-bottom: 6px;">${escapeHtml(rec.message)}</div>
    <div class="muted" style="margin-bottom: 12px;">${escapeHtml(rec.details)}</div>

    <div class="item" style="margin-bottom: 12px;">
      <div style="font-weight: 900; margin-bottom: 8px; color: rgba(34, 211, 238, 1);">Recommendations</div>
      ${altHtml}

      <div class="item" style="border-color: rgba(234, 179, 8, 0.55); background: rgba(234, 179, 8, 0.10);">
        <div style="font-weight: 900; margin-bottom: 6px;">Option ${optionNum}: Reschedule to Next Month</div>
        <div class="small" style="margin-bottom: 6px;">Move job to <strong style="color: #fde68a;">${escapeHtml(
          monthLabel(rec.nextMonth)
        )}</strong></div>
        <div class="actions" style="margin-top: 10px;">
          <button class="btn primary" type="button" id="applyRes">Reschedule to ${escapeHtml(rec.nextMonth)}</button>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn neutral" type="button" id="cancelModal">Cancel</button>
    </div>
  `;

  const cancelBtn = body.querySelector('#cancelModal');
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

  const altBtn = body.querySelector('#applyAlt');
  if (altBtn) altBtn.addEventListener('click', () => applyRecommendation('alternative'));

  const resBtn = body.querySelector('#applyRes');
  if (resBtn) resBtn.addEventListener('click', () => applyRecommendation('reschedule'));

  openModal();
  renderIcons();
}

function renderDashboard() {
  const grid = document.getElementById('dashboardGrid');
  const month = state.currentMonth;

  grid.innerHTML = '';

  for (const machine of state.machines) {
    const utilization = getMachineUtilization(machine, month);
    const currentLoad = calculateMachineLoad(machine.id, month);
    const available = machine.maxCapacity - currentLoad;

    const card = document.createElement('div');
    card.className = 'card';

    card.innerHTML = `
      <div class="item-top" style="margin-bottom: 10px;">
        <div>
          <div style="font-weight: 900; font-size: 16px;">${escapeHtml(machine.name)}</div>
          <div class="small">${escapeHtml(machine.type)}</div>
        </div>
        <span class="pill ${getPillClass(utilization)}">${utilization.toFixed(1)}%</span>
      </div>

      <div class="stack" style="gap: 10px;">
        <div class="progress"><div class="${getUtilizationClass(utilization)}" style="width: ${Math.min(utilization, 100)}%"></div></div>

        <div class="grid-2" style="grid-template-columns: 1fr 1fr; gap: 10px;">
          <div class="item">
            <div class="small">Max Capacity</div>
            <div style="font-weight: 900;">${machine.maxCapacity.toFixed(0)}</div>
          </div>
          <div class="item">
            <div class="small">Current Load</div>
            <div style="font-weight: 900;">${currentLoad.toFixed(0)}</div>
          </div>
          <div class="item">
            <div class="small">Available</div>
            <div style="font-weight: 900; color: #86efac;">${available.toFixed(0)}</div>
          </div>
          <div class="item">
            <div class="small">Scheduled Jobs</div>
            <div style="font-weight: 900;">${state.schedules.filter((s) => s.machineId === machine.id && s.month === month).length}</div>
          </div>
        </div>
      </div>
    `;

    grid.appendChild(card);
  }
}

function renderCalendar() {
  const list = document.getElementById('calendarList');
  const month = state.currentMonth;

  const items = state.schedules
    .filter((s) => s.month === month)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!items.length) {
    list.innerHTML = `<div class="placeholder">No jobs scheduled for this month</div>`;
    return;
  }

  list.innerHTML = '';

  for (const schedule of items) {
    const wrap = document.createElement('div');
    wrap.className = 'item';

    const priority = schedule.priority || 'normal';
    const pillClass = priority === 'high' ? 'red' : priority === 'low' ? 'yellow' : 'green';

    wrap.innerHTML = `
      <div class="item-top">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
            <h3>${escapeHtml(schedule.jobName)}</h3>
            <span class="pill ${pillClass}">${escapeHtml(priority.toUpperCase())}</span>
          </div>
          <div class="muted" style="margin-bottom: 8px;">${escapeHtml(schedule.machineName)}</div>

          <div class="grid-2" style="grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px;">
            <div class="small"><span class="muted">Required:</span> <strong>${escapeHtml(schedule.units)}</strong></div>
            <div class="small"><span class="muted">Total Load:</span> <strong style="color: rgba(34, 211, 238, 1);">${schedule.totalCapacity.toFixed(
              2
            )}</strong></div>
            <div class="small"><span class="muted">Scheduled:</span> <strong>${new Date(schedule.createdAt).toLocaleDateString()}</strong></div>
            <div class="small"><span class="muted">Month:</span> <strong>${escapeHtml(schedule.month)}</strong></div>
          </div>
        </div>
        <div>
          <button class="btn danger" type="button" data-del="${schedule.id}">Delete</button>
        </div>
      </div>
    `;

    wrap.querySelector('[data-del]').addEventListener('click', () => deleteSchedule(schedule.id));
    list.appendChild(wrap);
  }
}

function renderForecast() {
  const stack = document.getElementById('forecastStack');
  stack.innerHTML = '';

  const months = [];
  const today = new Date();
  for (let i = 0; i < 3; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() + i, 1);
    months.push(isoMonth(date));
  }

  for (const month of months) {
    const section = document.createElement('div');
    section.className = 'item';

    const innerCards = state.machines
      .map((machine) => {
        const utilization = getMachineUtilization(machine, month);
        const currentLoad = calculateMachineLoad(machine.id, month);

        return `
          <div class="item" style="padding: 10px;">
            <div class="item-top" style="margin-bottom: 6px;">
              <div style="font-weight: 800; font-size: 13px;">${escapeHtml(machine.name)}</div>
              <span class="pill ${getPillClass(utilization)}">${utilization.toFixed(1)}%</span>
            </div>
            <div class="progress" style="height: 10px;"><div class="${getUtilizationClass(utilization)}" style="width: ${Math.min(
          utilization,
          100
        )}%;"></div></div>
            <div class="small" style="margin-top: 6px;">Load: ${currentLoad.toFixed(0)} / ${machine.maxCapacity.toFixed(0)}</div>
          </div>
        `;
      })
      .join('');

    section.innerHTML = `
      <div style="font-size: 18px; font-weight: 900; margin-bottom: 10px; color: rgba(96, 165, 250, 1);">${escapeHtml(
        monthLabel(month)
      )}</div>
      <div class="grid-cards">${innerCards}</div>
    `;

    stack.appendChild(section);
  }
}

function syncFormToInputs() {
  document.getElementById('jobName').value = state.jobForm.jobName;
  document.getElementById('units').value = state.jobForm.units;
  document.getElementById('priority').value = state.jobForm.priority;
  document.getElementById('targetMonth').value = state.jobForm.month;
  document.getElementById('machineId').value = state.jobForm.machineId;
}

function render() {
  renderMachineSelect();
  renderScheduleFormDerived();

  document.getElementById('dashboardMonth').value = state.currentMonth;
  document.getElementById('calendarMonth').value = state.currentMonth;

  if (state.activeTab === 'dashboard') renderDashboard();
  if (state.activeTab === 'calendar') renderCalendar();
  if (state.activeTab === 'forecast') renderForecast();

  if (state.showRecommendation && state.recommendation) {
    renderModal();
  }

  renderIcons();
}

function wireEvents() {
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
  });

  document.getElementById('jobName').addEventListener('input', (e) => setJobForm({ jobName: e.target.value }));
  document.getElementById('units').addEventListener('input', (e) => setJobForm({ units: e.target.value }));
  document.getElementById('priority').addEventListener('change', (e) => setJobForm({ priority: e.target.value }));

  document.getElementById('targetMonth').addEventListener('change', (e) => {
    setJobForm({ month: e.target.value });
    renderMachineSelect();
    renderScheduleFormDerived();
  });

  document.getElementById('machineId').addEventListener('change', (e) => {
    setJobForm({ machineId: e.target.value });
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
  loadData();

  state.currentMonth = isoMonth(new Date());
  state.jobForm.month = isoMonth(new Date());

  document.getElementById('targetMonth').value = state.jobForm.month;
  document.getElementById('dashboardMonth').value = state.currentMonth;
  document.getElementById('calendarMonth').value = state.currentMonth;

  wireEvents();
  render();
  updateScheduleButtonState();
  renderIcons();
}

init();
