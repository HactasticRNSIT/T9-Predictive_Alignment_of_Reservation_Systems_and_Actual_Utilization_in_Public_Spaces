// ════════════════════════════════════════════════════════════════════════
//  UI RENDERING
// ════════════════════════════════════════════════════════════════════════

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
  document.getElementById('tab-' + name).classList.add('active');
  if (name === 'mybookings') renderMyBookings();
}

let currentFilter_ = 'all';
function filterSpaces(type, btn) {
  currentFilter = type;
  if (btn) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
  }
  renderSpacesGrid();
}

function getAvailability(spaceId) {
  const active = userBookings.filter(b => b.spaceId === spaceId && b.status === 'CONFIRMED').length;
  const space = SPACES[spaceId];
  const taken = Math.round(space.capacity * space.base_utilization) + active;
  const free = Math.max(0, space.capacity - taken);
  return { free, taken, total: space.capacity };
}

const DAY_ABBR = ['M','T','W','T','F','S','S'];
function renderSpaceWeeklyMini(spaceId) {
  const pcts = getSpaceWeeklyDemand(spaceId);
  if (!pcts) return '';
  const maxP = Math.max(...pcts, 1);
  const colors = pcts.map(p => {
    const ratio = p / maxP;
    if (ratio >= 0.9) return '#c2446e';
    if (ratio >= 0.7) return '#b87ab8';
    if (ratio >= 0.5) return '#a07ac8';
    return '#a7abde';
  });
  const bars = pcts.map((p, i) => {
    const h = Math.max(4, Math.round((p / maxP) * 28));
    return `<div class="space-day-bar" data-tip="${DAY_ABBR[i]}: ${p}%" style="height:${h}px;background:${colors[i]};opacity:0.75;border-radius:3px 3px 0 0;flex:1;"></div>`;
  }).join('');
  const labels = DAY_ABBR.map(d => `<div class="space-weekly-day">${d}</div>`).join('');
  return `
    <div style="margin-bottom:12px;">
      <div style="font-family:var(--mono);font-size:9px;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.05em;">Busiest days</div>
      <div style="display:flex;gap:3px;align-items:flex-end;height:32px;">${bars}</div>
      <div style="display:flex;gap:3px;">${labels}</div>
    </div>`;
}

function renderSpacesGrid() {
  const query = (document.getElementById('searchInput').value || '').toLowerCase();
  const grid = document.getElementById('spacesGrid');
  let filtered = SPACES.filter(s => {
    if (currentFilter !== 'all' && s.type !== currentFilter) return false;
    if (query && !s.name.toLowerCase().includes(query) && !s.type.toLowerCase().includes(query)) return false;
    return true;
  });

  grid.innerHTML = filtered.map(space => {
    const av = getAvailability(space.id);
    const utilPct = ((av.taken / av.total) * 100).toFixed(0);
    const isFull = av.free === 0;
    const isBusy = av.free < av.total * 0.15;

    let dotClass = '', dotLabel = '', barColor = 'var(--green)';
    if (isFull) { dotClass = 'full'; dotLabel = 'Full'; barColor = 'var(--red)'; }
    else if (isBusy) { dotClass = 'busy'; dotLabel = 'Limited'; barColor = 'var(--orange)'; }
    else { dotLabel = `${av.free} spots free`; barColor = 'var(--teal)'; }

    return `
      <div class="space-card" style="--card-color:${space.color}">
        <div class="space-card-header">
          <span class="space-type-chip">${space.type.toUpperCase()}</span>
          <span class="space-avail" style="color:${barColor}">
            <span class="avail-dot ${dotClass}"></span>${dotLabel}
          </span>
        </div>
        <div class="space-name">${space.icon} ${space.name}</div>
        <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:4px;display:flex;align-items:center;gap:4px;"><i class="ti ti-map-pin" style="font-size:12px"></i>${space.area || ''}</div>
        <div class="space-cap"><i class="ti ti-users" style="font-size:14px"></i> Capacity ${space.total || space.capacity} people</div>
        <div class="util-bar-wrap">
          <div class="util-bar-fill" style="width:${utilPct}%;background:${barColor}"></div>
        </div>
        <div class="util-label"><span>Occupancy</span><span>${utilPct}%</span></div>
        ${renderSpaceWeeklyMini(space.id)}
        <button class="book-btn" ${isFull ? 'disabled' : ''} onclick="openBookModal(${space.id})">
          ${isFull ? '<i class="ti ti-lock"></i> Fully Booked' : '<i class="ti ti-calendar-plus"></i> Reserve Now'}
        </button>
      </div>`;
  }).join('');
}

function renderMyBookings() {
  const list = document.getElementById('bookingsList');
  const stats = document.getElementById('myStats');
  const active = userBookings.filter(b => b.status === 'CONFIRMED');
  const cancelled = userBookings.filter(b => b.status === 'CANCELLED');

  stats.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Total Bookings</div>
      <div class="stat-value" style="color:var(--blue)">${userBookings.length}</div>
      <div class="stat-sub">all time</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Active</div>
      <div class="stat-value" style="color:var(--teal)">${active.length}</div>
      <div class="stat-sub">confirmed</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Cancelled</div>
      <div class="stat-value" style="color:var(--red)">${cancelled.length}</div>
      <div class="stat-sub">released slots</div>
    </div>`;

  if (userBookings.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-ticket"></i>
        <h3>No bookings yet</h3>
        <p>Browse available spaces and reserve a slot.</p>
      </div>`;
    return;
  }

  const sorted = [...userBookings].sort((a, b) => new Date(b.bookedAt) - new Date(a.bookedAt));

  list.innerHTML = sorted.map(b => `
    <div class="booking-item">
      <div class="booking-icon" style="background:${b.spaceColor}20;color:${b.spaceColor}">
        ${b.spaceIcon}
      </div>
      <div class="booking-info">
        <div class="booking-name">${b.spaceName}</div>
        <div class="booking-meta">
          <span><i class="ti ti-calendar"></i> ${formatDate(b.date)}</span>
          <span><i class="ti ti-clock"></i> ${formatHour(b.hour)} · ${b.duration}h</span>
          ${b.notes ? `<span><i class="ti ti-note"></i> ${b.notes}</span>` : ''}
          <span class="booking-id">${b.id}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <span class="booking-status status-${b.status.toLowerCase()}">${b.status}</span>
        ${b.status === 'CONFIRMED' ? `
          <button class="btn-cancel-booking" onclick="openCancelModal('${b.id}')">
            <i class="ti ti-x"></i> Cancel
          </button>` : ''}
      </div>
    </div>`).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday:'short', month:'short', day:'numeric' });
}
function formatHour(h) {
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:00 ${ampm}`;
}

// ── Toast ────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  const icon = type === 'success' ? 'ti-circle-check' : 'ti-alert-circle';
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="ti ${icon} toast-icon"></i><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS & EMAIL
// ════════════════════════════════════════════════════════════════════════

let notifications = [];
let unreadCount = 0;

function pushNotification({ title, desc, time, unread = true }) {
  notifications.unshift({ title, desc, time, unread, id: Date.now() });
  if (unread) unreadCount++;
  renderNotifPanel();
  updateNotifBadge();
}

function renderNotifPanel() {
  const list = document.getElementById('notifList');
  if (notifications.length === 0) {
    list.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:13px;">No notifications yet</div>';
    return;
  }
  list.innerHTML = notifications.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}">
      <div class="notif-dot ${n.unread ? '' : 'read'}"></div>
      <div class="notif-body">
        <div class="notif-title">${n.title}</div>
        <div class="notif-desc">${n.desc}</div>
        <div class="notif-time">${n.time}</div>
      </div>
    </div>`).join('');
}

function clearNotifs() {
  notifications.forEach(n => n.unread = false);
  unreadCount = 0;
  renderNotifPanel();
  updateNotifBadge();
}

function updateNotifBadge() {
  const badge = document.getElementById('notifBadge');
  if (unreadCount > 0) { badge.textContent = unreadCount; badge.style.display = 'flex'; }
  else { badge.style.display = 'none'; }
}

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) clearNotifs();
}

// Close notif panel on outside click
document.addEventListener('click', e => {
  const panel = document.getElementById('notifPanel');
  const btn   = document.getElementById('notifBellBtn');
  if (panel && !panel.contains(e.target) && !btn.contains(e.target)) {
    panel.classList.remove('open');
  }
});

function showEmailPreview(booking) {
  const space = SPACES[booking.spaceId];
  const emailHtml = `
    <div style="border-bottom:1px solid var(--border2);padding-bottom:12px;margin-bottom:12px;">
      <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:4px;">FROM: noreply@spacebook.app</div>
      <div style="font-size:11px;color:var(--muted);font-family:var(--mono);margin-bottom:4px;">TO: ${booking.email || 'arjun@example.com'}</div>
      <div style="font-size:11px;color:var(--muted);font-family:var(--mono);">SUBJECT: ✅ Booking Confirmed — ${booking.spaceName} [${booking.id}]</div>
    </div>
    <p style="margin-bottom:12px;">Hi <strong>${booking.name}</strong>,</p>
    <p style="margin-bottom:12px;">Your reservation has been confirmed. Here are your booking details:</p>
    <div style="background:var(--surface);border:1px solid var(--border2);border-radius:10px;padding:14px;margin-bottom:14px;">
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:20px;">${space.icon} <strong>${booking.spaceName}</strong></div>
      <table style="width:100%;font-size:12px;border-collapse:collapse;">
        <tr><td style="color:var(--muted);padding:3px 0;width:120px;">Booking ID</td><td style="font-family:var(--mono);font-weight:600;color:var(--accent)">${booking.id}</td></tr>
        <tr><td style="color:var(--muted);padding:3px 0;">Date</td><td>${formatDate(booking.date)}</td></tr>
        <tr><td style="color:var(--muted);padding:3px 0;">Time</td><td>${formatHour(booking.hour)} for ${booking.duration} hour${booking.duration > 1 ? 's' : ''}</td></tr>
        <tr><td style="color:var(--muted);padding:3px 0;">Space Type</td><td>${booking.spaceType}</td></tr>
        ${booking.notes ? `<tr><td style="color:var(--muted);padding:3px 0;">Notes</td><td>${booking.notes}</td></tr>` : ''}
      </table>
    </div>
    <p style="margin-bottom:8px;font-size:12px;color:var(--muted);">To cancel or modify your booking, visit the <strong>My Bookings</strong> section on SpaceBook.</p>
    <p style="font-size:12px;color:var(--muted);">— The SpaceBook Team 🏢</p>`;
  document.getElementById('emailPreviewContent').innerHTML = emailHtml;
  document.getElementById('emailPreviewModal').classList.add('open');
  pushNotification({
    title: '📧 Confirmation Email Sent',
    desc: `Booking confirmation for ${booking.spaceName} sent to ${booking.email || 'your email'}.`,
    time: 'Just now',
    unread: true,
  });
}

// ════════════════════════════════════════════════════════════════════════
//  ANALYTICS DASHBOARD RENDERING
// ════════════════════════════════════════════════════════════════════════

function riskLevel(r) { return r >= 0.25 ? 'high' : r >= 0.12 ? 'med' : 'low'; }
function riskBadge(r) {
  const l = riskLevel(r);
  return `<span class="badge badge-${l === 'high' ? 'high' : l === 'med' ? 'med' : 'low'}">${l.charAt(0).toUpperCase()+l.slice(1)}</span>`;
}
function utilBar(pct, color) {
  return `<span class="bar-wrap"><span class="bar-fill" style="width:${Math.min(pct,100)}%;background:${color}"></span></span><span style="font-family:var(--mono);font-size:12px">${pct.toFixed(1)}%</span>`;
}
function utilColor(pct) {
  if (pct >= 65) return 'var(--teal)';
  if (pct >= 50) return 'var(--orange)';
  return 'var(--red)';
}

function renderAnalyticsDashboard(stats, allocResults, forecast, accuracy, n) {
  document.getElementById('simStatus').innerHTML =
    `Simulated bookings<span class="val"> ${n}</span><br>
     Spaces<span class="val"> ${SPACES.length}</span><br>
     Model accuracy<span class="val"> ${(accuracy*100).toFixed(1)}%</span><br>
     Alloc decisions<span class="val"> ${allocResults.length}</span>`;

  document.getElementById('modelStrip').innerHTML =
    ['bias','hour','day','advance','repeat','peak','weekend','cancel_hist'].map(w =>
      `<div class="model-strip-item">${w}<span>N/A</span></div>`).join('') +
    `<div class="model-strip-item">Epochs<span>200</span></div>` +
    `<div class="model-strip-item">LR α<span>0.05</span></div>` +
    `<div class="model-strip-item">No-show<span>${(stats.noShowRate*100).toFixed(1)}%</span></div>` +
    `<div class="model-strip-item">Cancel<span>${(stats.cancelRate*100).toFixed(1)}%</span></div>`;

  const ss = stats.spaceStats;
  const avgUtil = ss.reduce((s, sp) => s + sp.utilization * 100, 0) / ss.length;
  document.getElementById('metricGrid').innerHTML = [
    { label: 'Overall Utilization', value: avgUtil.toFixed(1) + '%', sub: 'avg across spaces' },
    { label: 'No-show Rate',        value: (stats.noShowRate*100).toFixed(1) + '%', sub: 'system-wide' },
    { label: 'Walk-in Demand',      value: stats.informal, sub: 'informal occupancies' },
    { label: 'Total Bookings',      value: stats.total, sub: 'simulated records' },
    { label: 'Wasted Slots',        value: stats.wastedTotal, sub: 'reserved but unused' },
    { label: 'Total No-shows',      value: stats.noShows, sub: 'across all spaces' },
  ].map(m => `<div class="metric"><div class="metric-label">${m.label}</div><div class="metric-value">${m.value}</div><div class="metric-sub">${m.sub}</div></div>`).join('');

  const tbody = document.getElementById('statusTable');
  ss.forEach(sp => {
    const pct = sp.utilization * 100;
    const c = utilColor(pct);
    tbody.innerHTML += `<tr>
      <td><b>${sp.space.name}</b></td>
      <td style="color:var(--muted);font-size:12px">${sp.space.type}</td>
      <td>${utilBar(pct, c)}</td>
      <td style="font-family:var(--mono)">${sp.reserved}</td>
      <td style="font-family:var(--mono)">${sp.actual}</td>
      <td style="font-family:var(--mono)">${sp.noShowCount}</td>
      <td style="font-family:var(--mono)">${sp.walkins}</td>
    </tr>`;
  });

  const ptbody = document.getElementById('predTable');
  ss.forEach(sp => {
    const hist = (sp.noShowRate * 100).toFixed(1);
    const pred = Math.min(65, sp.noShowRate * 100 * 1.15 + 2).toFixed(1);
    const risk = riskLevel(sp.noShowRate);
    const action = risk === 'high' ? 'Overbook' : risk === 'med' ? 'Moderate overbook' : 'Normal';
    ptbody.innerHTML += `<tr>
      <td><b>${sp.space.name}</b></td>
      <td style="font-family:var(--mono)">${hist}%</td>
      <td style="font-family:var(--mono)">${pred}%</td>
      <td>${riskBadge(sp.noShowRate)}</td>
      <td style="color:var(--muted);font-size:12px">${action}</td>
    </tr>`;
  });

  const rtbody = document.getElementById('reallocTable');
  ss.forEach(sp => {
    const spAlloc = allocResults.filter(r => r.space_id === sp.space.id);
    if (!spAlloc.length) {
      rtbody.innerHTML += `<tr><td><b>${sp.space.name}</b></td><td colspan="3" style="color:var(--muted);font-size:12px">No peak-hour data</td></tr>`;
      return;
    }
    const totalWas = spAlloc.reduce((s,r) => s + r.reserved_slots, 0);
    const totalRec = spAlloc.reduce((s,r) => s + r.reserved_slots + r.walk_in_capacity, 0);
    const diff = totalRec - totalWas;
    const badge = diff >= 0
      ? `<span class="badge badge-up">▲ ${totalRec}</span>`
      : `<span class="badge badge-down">▼ ${totalRec}</span>`;
    const reason = sp.noShowRate >= 0.25
      ? `Open ${spAlloc.reduce((s,r) => s + r.walk_in_capacity, 0)} walk-in slots`
      : `Light overbook (+${diff})`;
    rtbody.innerHTML += `<tr>
      <td><b>${sp.space.name}</b></td>
      <td style="color:var(--muted);font-family:var(--mono)">${totalWas}</td>
      <td>${badge}</td>
      <td style="color:var(--muted);font-size:12px">${reason}</td>
    </tr>`;
  });

  const labels = ss.map(s => s.space.name.replace(' Block','').replace(' Floor',' F').replace(' Zone',' Z').replace(' Hall',' H').replace(' Court',' C'));

  Chart.defaults.color = 'rgba(46,26,61,0.55)';
  Chart.defaults.borderColor = 'rgba(160,122,200,0.10)';

  new Chart(document.getElementById('utilChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'Utilization %', data: ss.map(s => (s.utilization*100).toFixed(1)),
        backgroundColor: ss.map(s => { const p = s.utilization*100; return p>=65?'rgba(160,122,200,0.85)':p>=50?'rgba(200,167,216,0.8)':'rgba(194,68,110,0.75)'; }),
        borderRadius: 5, borderSkipped: false }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales: { x:{ticks:{font:{size:10,family:"'IBM Plex Mono'"},maxRotation:40},grid:{display:false}}, y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:10}}} } }
  });

  new Chart(document.getElementById('nsChart'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{ label: 'No-show %', data: ss.map(s => (s.noShowRate*100).toFixed(1)),
        backgroundColor: ss.map(s => { const ns=s.noShowRate; return ns>=0.25?'rgba(194,68,110,0.8)':ns>=0.12?'rgba(200,122,180,0.8)':'rgba(160,122,200,0.8)'; }),
        borderRadius: 5, borderSkipped: false }]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}},
      scales: { x:{ticks:{font:{size:10,family:"'IBM Plex Mono'"},maxRotation:40},grid:{display:false}}, y:{min:0,ticks:{callback:v=>v+'%',font:{size:10}}} } }
  });

  new Chart(document.getElementById('forecastChart'), {
    type: 'line',
    data: {
      labels: forecast.map(f => f.hour + ':00'),
      datasets: [{ label: 'Predicted Demand', data: forecast.map(f => (f.predicted_demand*100).toFixed(1)),
        borderColor: 'rgba(160,122,200,0.85)', backgroundColor: 'rgba(160,122,200,0.08)',
        tension: 0.4, fill: true, pointRadius: 2,
        pointBackgroundColor: forecast.map(f => f.is_peak ? 'var(--red)' : 'rgba(160,122,200,0.45)') }]
    },
    options: { responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>' Demand: '+ctx.raw+'%'}}},
      scales:{x:{ticks:{font:{size:9,family:"'IBM Plex Mono'"},maxTicksLimit:12},grid:{display:false}},y:{ticks:{callback:v=>v+'%',font:{size:9}},min:0,max:100}} }
  });

  const topUtil    = [...ss].sort((a,b) => b.utilization - a.utilization)[0];
  const bottomUtil = [...ss].sort((a,b) => a.utilization - b.utilization)[0];
  const topNS      = [...ss].sort((a,b) => b.noShowRate  - a.noShowRate)[0];
  const bestOverbook = [...ss].filter(s => s.noShowRate >= 0.25).sort((a,b) => b.noShowRate - a.noShowRate)[0];

  const insightsData = [
    { icon: 'ti-flame', text: `<b>Hotspot:</b> ${topUtil.space.name} is most utilized at ${(topUtil.utilization*100).toFixed(1)}% — consider expanding capacity or limiting walk-ins.` },
    { icon: 'ti-alert-circle', text: `<b>Underused:</b> ${bottomUtil.space.name} at ${(bottomUtil.utilization*100).toFixed(1)}% — high no-show rate of ${(bottomUtil.noShowRate*100).toFixed(1)}% is the primary cause.` },
    { icon: 'ti-user-x', text: `<b>No-show risk:</b> ${topNS.space.name} has the highest no-show rate at ${(topNS.noShowRate*100).toFixed(1)}%. Introduce cancellation incentives and waitlists.` },
    { icon: 'ti-walk', text: `<b>Walk-in demand:</b> ${stats.informal} informal occupancies detected — unmet demand not captured by the current reservation system.` },
    ...(bestOverbook ? [{ icon: 'ti-chart-arrows-vertical', text: `<b>Overbooking opportunity:</b> ${bestOverbook.space.name} predicted ${(bestOverbook.noShowRate*100).toFixed(1)}% no-show — safe to overbook by ${Math.floor(bestOverbook.space.capacity * 0.1)} slots per session.` }] : []),
    { icon: 'ti-cpu', text: `<b>Model performance:</b> Logistic regression trained on ${n} records achieved ${(accuracy*100).toFixed(1)}% accuracy predicting no-shows using 7 behavioral features.` },
  ];
  const iDiv = document.getElementById('insights');
  insightsData.forEach(ins => {
    iDiv.innerHTML += `<div class="insight"><i class="ti ${ins.icon} insight-icon"></i><div>${ins.text}</div></div>`;
  });
}

// ════════════════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════════════════

async function log(msg) {
  const el = document.getElementById('logLines');
  const line = document.createElement('div');
  line.className = 'log-line';
  line.innerHTML = msg;
  el.appendChild(line);
  await new Promise(r => setTimeout(r, 160));
}

function renderWeeklyBusyness(dataset) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // day_of_week: 0=Mon..6=Sun (based on dataset generator: intBetween(0,6))
  const counts = new Array(7).fill(0);
  const totals = new Array(7).fill(0);
  for (const b of dataset) {
    if (b.status === 'ATTENDED' || b.status === 'CONFIRMED') {
      counts[b.day_of_week]++;
    }
    totals[b.day_of_week]++;
  }
  const pcts = counts.map((c, i) => totals[i] > 0 ? Math.round((c / totals[i]) * 100) : 0);
  const maxPct = Math.max(...pcts);
  const minPct = Math.min(...pcts);
  const grid = document.getElementById('weeklyGrid');
  if (!grid) return;
  const colors = pcts.map(p => {
    if (p === maxPct) return '#c2446e';
    if (p >= maxPct * 0.85) return '#b87ab8';
    if (p >= maxPct * 0.70) return '#d8bee5';
    if (p === minPct) return '#a7abde';
    return '#a07ac8';
  });
  grid.innerHTML = days.map((d, i) => {
    const isBusiest = pcts[i] === maxPct;
    const isQuietest = pcts[i] === minPct;
    const barHeight = Math.max(10, Math.round((pcts[i] / maxPct) * 80));
    return `
      <div class="day-col">
        <div class="day-label">${d}</div>
        <div class="day-bar-wrap">
          <div class="day-bar-fill ${isBusiest ? 'peak' : ''}" style="height:${barHeight}px;background:${colors[i]};opacity:0.82;"></div>
        </div>
        <div class="day-pct">${pcts[i]}%</div>
        ${isBusiest ? '<span class="day-badge busiest">Busiest</span>' : isQuietest ? '<span class="day-badge quietest">Quietest</span>' : '<span style="height:18px;display:block"></span>'}
      </div>`;
  }).join('');
}

// Also add per-space weekly mini-chart in space cards
function getSpaceWeeklyDemand(spaceId) {
  if (!window._datasetCache) return null;
  const days = new Array(7).fill(0);
  const tots = new Array(7).fill(0);
  for (const b of window._datasetCache) {
    if (b.space_id === spaceId) {
      tots[b.day_of_week]++;
      if (b.status === 'ATTENDED') days[b.day_of_week]++;
    }
  }
  return days.map((d, i) => tots[i] > 0 ? Math.round((d / tots[i]) * 100) : 0);
}

// ── Live clock ────────────────────────────────────────────────────────────────
function updateClock() {
  const el = document.getElementById('navClock');
  if (el) el.textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
setInterval(updateClock, 1000);
updateClock();

// ════════════════════════════════════════════════════════════════════════
//  USER AUTH & PROFILE
// ════════════════════════════════════════════════════════════════════════

let currentUser = null;

function switchLoginTab(tab) {
  document.getElementById('loginForm').style.display   = tab === 'login'  ? 'block' : 'none';
  document.getElementById('signupForm').style.display  = tab === 'signup' ? 'block' : 'none';
  document.getElementById('loginTabBtn').classList.toggle('active',  tab === 'login');
  document.getElementById('signupTabBtn').classList.toggle('active', tab === 'signup');
}

function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  if (!email || !pass) { showToast('Please fill in all fields.', 'error'); return; }
  const namePart = email.split('@')[0];
  const parts = namePart.split(/[._]/);
  const first = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'User';
  const last  = parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '';
  currentUser = { firstName: first, lastName: last, email, phone: '+91 98765 43210', password: pass };
  finishLogin();
}

function doSignup() {
  const first = document.getElementById('signupFirst').value.trim();
  const last  = document.getElementById('signupLast').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const phone = document.getElementById('signupPhone').value.trim();
  const pass  = document.getElementById('signupPassword').value;
  if (!first || !email || !pass) { showToast('Please fill in required fields.', 'error'); return; }
  if (pass.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
  currentUser = { firstName: first, lastName: last, email, phone: phone || '+91 00000 00000', password: pass };
  finishLogin();
}

function finishLogin() {
  document.getElementById('loginScreen').style.display = 'none';
  document.querySelector('.nav').style.display = 'flex';
  updateNavUser();
  showToast(`Welcome, ${currentUser.firstName}! 👋`, 'success');
}

function updateNavUser() {
  if (!currentUser) return;
  const initials = (currentUser.firstName[0] + (currentUser.lastName ? currentUser.lastName[0] : '')).toUpperCase();
  const shortName = currentUser.firstName + (currentUser.lastName ? ' ' + currentUser.lastName[0] + '.' : '');
  document.getElementById('navAvatar').textContent = initials;
  document.getElementById('navUserName').textContent = shortName;
  document.getElementById('profileAvatarBig').textContent = initials;
  document.getElementById('profileName').textContent = currentUser.firstName + ' ' + (currentUser.lastName || '');
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('profilePhone').textContent = currentUser.phone || '';
}

function doLogout() {
  currentUser = null;
  userBookings = [];
  notifications = [];
  unreadCount = 0;
  updateNotifBadge();
  updateBookingBadge();
  closeProfileDropdown();
  document.querySelector('.nav').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  showToast('You have been signed out.', 'success');
}

function toggleProfileDropdown() {
  const dd = document.getElementById('profileDropdown');
  dd.classList.toggle('open');
  // close notif panel
  document.getElementById('notifPanel').classList.remove('open');
}

function closeProfileDropdown() {
  document.getElementById('profileDropdown').classList.remove('open');
}

// Close profile dropdown on outside click
document.addEventListener('click', e => {
  const dd  = document.getElementById('profileDropdown');
  const chip = document.getElementById('userChip');
  if (dd && !dd.contains(e.target) && chip && !chip.contains(e.target)) {
    dd.classList.remove('open');
  }
});

let editingField = null;
function openEditProfile(field) {
  editingField = field || 'all';
  closeProfileDropdown();
  const titles = { all:'Edit Profile', email:'Change Email', phone:'Change Phone', password:'Change Password' };
  document.getElementById('editProfileTitle').textContent = titles[editingField] || 'Edit Profile';
  let html = '';
  if (editingField === 'all') {
    html = `
      <div class="form-row">
        <div class="form-group"><label class="form-label">First Name</label><input type="text" class="form-input" id="ep_first" value="${currentUser?.firstName||''}"></div>
        <div class="form-group"><label class="form-label">Last Name</label><input type="text" class="form-input" id="ep_last" value="${currentUser?.lastName||''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="ep_email" value="${currentUser?.email||''}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input type="tel" class="form-input" id="ep_phone" value="${currentUser?.phone||''}"></div>`;
  } else if (editingField === 'email') {
    html = `<div class="form-group"><label class="form-label">New Email</label><input type="email" class="form-input" id="ep_email" placeholder="new@example.com" value="${currentUser?.email||''}"></div>
            <div class="form-group"><label class="form-label">Confirm Password</label><input type="password" class="form-input" id="ep_confirm" placeholder="••••••••"></div>`;
  } else if (editingField === 'phone') {
    html = `<div class="form-group"><label class="form-label">New Phone Number</label><input type="tel" class="form-input" id="ep_phone" placeholder="+91 98765 43210" value="${currentUser?.phone||''}"></div>`;
  } else if (editingField === 'password') {
    html = `<div class="form-group"><label class="form-label">Current Password</label><input type="password" class="form-input" id="ep_old_pass" placeholder="••••••••"></div>
            <div class="form-group"><label class="form-label">New Password</label><input type="password" class="form-input" id="ep_new_pass" placeholder="Min 8 characters"></div>
            <div class="form-group"><label class="form-label">Confirm New Password</label><input type="password" class="form-input" id="ep_confirm_pass" placeholder="Min 8 characters"></div>`;
  }
  document.getElementById('editProfileFields').innerHTML = html;
  document.getElementById('editProfileModal').classList.add('open');
}

function saveProfile() {
  if (!currentUser) return;
  if (editingField === 'all') {
    currentUser.firstName = document.getElementById('ep_first')?.value.trim() || currentUser.firstName;
    currentUser.lastName  = document.getElementById('ep_last')?.value.trim()  || currentUser.lastName;
    currentUser.email     = document.getElementById('ep_email')?.value.trim() || currentUser.email;
    currentUser.phone     = document.getElementById('ep_phone')?.value.trim() || currentUser.phone;
  } else if (editingField === 'email') {
    const newEmail = document.getElementById('ep_email')?.value.trim();
    if (!newEmail) { showToast('Email cannot be empty.', 'error'); return; }
    currentUser.email = newEmail;
  } else if (editingField === 'phone') {
    currentUser.phone = document.getElementById('ep_phone')?.value.trim() || currentUser.phone;
  } else if (editingField === 'password') {
    const np = document.getElementById('ep_new_pass')?.value;
    const cp = document.getElementById('ep_confirm_pass')?.value;
    if (!np || np.length < 8) { showToast('Password must be at least 8 characters.', 'error'); return; }
    if (np !== cp) { showToast('Passwords do not match.', 'error'); return; }
    currentUser.password = np;
    closeModal('editProfileModal');
    showToast('Password updated successfully!', 'success');
    return;
  }
  updateNavUser();
  closeModal('editProfileModal');
  showToast('Profile updated successfully!', 'success');
}

// ════════════════════════════════════════════════════════════════════════
//  TIME × SPACE × DAY HEATMAP
// ════════════════════════════════════════════════════════════════════════

const HEAT_HOURS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const HEAT_DAYS  = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function buildHeatmapData(dataset, spaceId) {
  // Returns 7×16 matrix [day][hour_idx] = attended_count
  const matrix = Array.from({length:7}, () => new Array(HEAT_HOURS.length).fill(0));
  const counts  = Array.from({length:7}, () => new Array(HEAT_HOURS.length).fill(0));
  for (const b of dataset) {
    if (spaceId !== 'all' && b.space_id !== parseInt(spaceId)) continue;
    const hi = HEAT_HOURS.indexOf(b.hour_of_day);
    if (hi === -1) continue;
    counts[b.day_of_week][hi]++;
    if (b.status === 'ATTENDED') matrix[b.day_of_week][hi]++;
  }
  // Normalize to 0-1
  let globalMax = 0;
  for (let d=0;d<7;d++) for (let h=0;h<HEAT_HOURS.length;h++) globalMax = Math.max(globalMax, matrix[d][h]);
  return { matrix, counts, max: globalMax || 1 };
}

function heatColor(val, max) {
  const r = val / max;
  if (r === 0)    return 'rgba(160,122,200,0.07)';
  if (r < 0.2)   return 'rgba(160,122,200,0.22)';
  if (r < 0.40)  return 'rgba(160,122,200,0.45)';
  if (r < 0.60)  return 'rgba(217,119,6,0.60)';
  if (r < 0.80)  return 'rgba(220,38,38,0.72)';
  return 'rgba(185,28,28,0.92)';
}

function renderHeatmap() {
  const dataset = window._datasetCache;
  if (!dataset) return;
  const sel = document.getElementById('heatmapSpaceSelect');
  const spaceId = sel ? sel.value : 'all';
  const { matrix, counts, max } = buildHeatmapData(dataset, spaceId);

  let html = '<table class="heatmap-table"><thead><tr><th></th>';
  HEAT_HOURS.forEach(h => {
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h > 12 ? h-12 : h;
    html += `<th>${hh}${ampm}</th>`;
  });
  html += '</tr></thead><tbody>';

  HEAT_DAYS.forEach((day, di) => {
    html += `<tr><td class="heatmap-row-label">${day}</td>`;
    HEAT_HOURS.forEach((hr, hi) => {
      const val = matrix[di][hi];
      const cnt = counts[di][hi];
      const pct = cnt > 0 ? Math.round((val/cnt)*100) : 0;
      const color = heatColor(val, max);
      const ampm = hr >= 12 ? 'PM' : 'AM';
      const hh = hr > 12 ? hr-12 : hr;
      html += `<td><div class="heatmap-cell" style="background:${color}" data-tip="${day} ${hh}:00${ampm} — ${pct}% busy (${val}/${cnt})"></div></td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  document.getElementById('heatmapGrid').innerHTML = html;
}

async function main() {
  await log('<span class="ok">[ 1/5 ]</span> Simulating 500 historical booking records…');
  const dataset = generateDataset(500);
  await log(`<span class="ok">[ 1/5 ]</span> Generated ${dataset.length} bookings across ${SPACES.length} spaces.`);
  await log('<span class="ok">[ 2/5 ]</span> Training No-Show Predictor (Logistic Regression)…');
  const predictor = new NoShowPredictor();
  predictor.train(dataset);
  const accuracy = predictor.evaluate(dataset);
  await log(`<span class="ok">[ 2/5 ]</span> Training complete. Accuracy: ${(accuracy*100).toFixed(1)}%`);
  await log('<span class="ok">[ 3/5 ]</span> Running Demand Forecaster…');
  const forecaster = new DemandForecaster();
  forecaster.fit(dataset);
  const forecast = forecaster.predict(24);
  await log('<span class="ok">[ 3/5 ]</span> Forecast generated for next 24 hours.');
  await log('<span class="ok">[ 4/5 ]</span> Running Space Allocator…');
  const allocator = new SpaceAllocator();
  const allocResults = allocator.optimize(dataset, predictor);
  await log(`<span class="ok">[ 4/5 ]</span> Optimized ${allocResults.length} peak-hour slots.`);
  await log('<span class="ok">[ 5/5 ]</span> Building user interface…');

  await new Promise(r => setTimeout(r, 250));

  globalStats = runAnalytics(dataset, allocResults);
  window._datasetCache = dataset; // cache for per-space weekly charts

  document.getElementById('init-loading').style.display = 'none';
  document.getElementById('app').style.display = 'block';

  renderSpacesGrid();
  renderAnalyticsDashboard(globalStats, allocResults, forecast, accuracy, dataset.length);
  renderWeeklyBusyness(dataset);

  // Populate heatmap space selector
  const sel = document.getElementById('heatmapSpaceSelect');
  if (sel) {
    SPACES.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = s.icon + ' ' + s.name;
      sel.appendChild(opt);
    });
  }
  renderHeatmap();
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(o => {
  o.addEventListener('click', e => { if (e.target === o) o.classList.remove('open'); });
});

main().catch(console.error);

// ════════════════════════════════════════════════════════════════════════
//  PWA INSTALL PROMPT
// ════════════════════════════════════════════════════════════════════════
<script>
  // PWA Install prompt (Android Chrome)
  let deferredPrompt = null;
  const banner = document.getElementById('pwaInstallBanner');

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    banner.style.display = 'flex';
  });

  document.getElementById('pwaInstallBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    banner.style.display = 'none';
  });

  document.getElementById('pwaDismissBtn').addEventListener('click', () => {
    banner.style.display = 'none';
  });

  window.addEventListener('appinstalled', () => {
    banner.style.display = 'none';
    deferredPrompt = null;
  });

  // Register a minimal service worker inline for PWA offline support
  if ('serviceWorker' in navigator) {
    const swCode = `
      const CACHE = 'spacebook-v1';
      self.addEventListener('install', e => {
        self.skipWaiting();
      });
      self.addEventListener('activate', e => {
        self.clients.claim();
      });
      self.addEventListener('fetch', e => {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
      });
    `;
    const blob = new Blob([swCode], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);
    navigator.serviceWorker.register(swUrl).catch(() => {});
  }
</script>
