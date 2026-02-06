function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isoMonth(date) {
  return date.toISOString().slice(0, 7);
}

function monthLabel(monthStr) {
  const d = new Date(`${monthStr}-01T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function renderIcons() {
  if (typeof window.lucide?.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function openModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  const overlay = document.getElementById('modalOverlay');
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
  document.getElementById('modalBody').innerHTML = '';
}

function renderModalHtml({ title, titleColor, bodyHtml }) {
  const body = document.getElementById('modalBody');
  body.innerHTML = `
    <h3 style="color: ${escapeHtml(titleColor)};">${escapeHtml(title)}</h3>
    ${bodyHtml}
    <div class="actions">
      <button class="btn primary" type="button" id="modalClose">Close</button>
    </div>
  `;

  body.querySelector('#modalClose').addEventListener('click', closeModal);
  openModal();
  renderIcons();
}

function renderSelectedPartSize({ partCode }) {
  const el = document.getElementById('partSize');
  if (!el) return;

  if (!partCode) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }

  const size = PART_SIZES[partCode];
  if (!size) {
    el.textContent = '';
    el.classList.add('hidden');
    return;
  }

  el.textContent = `Size: ${size}`;
  el.classList.remove('hidden');
}

function getUtilizationClass(percentage) {
  if (percentage < 70) return 'bar-yellow';
  if (percentage < 90) return 'bar-green';
  return 'bar-red';
}

function getPillClass(percentage) {
  if (percentage < 70) return 'yellow';
  if (percentage < 90) return 'green';
  return 'red';
}
