// ════════════════════════════════════════════════════════════════════════
//  BACKEND ENGINE (ported from C++)
// ════════════════════════════════════════════════════════════════════════

class SeededRNG {
  constructor(seed = 42) { this.state = seed >>> 0; }
  next() {
    let x = this.state;
    x ^= x << 13; x ^= x >> 17; x ^= x << 5;
    this.state = x >>> 0;
    return (this.state >>> 0) / 4294967296;
  }
  intBetween(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  realBetween(a, b) { return a + this.next() * (b - a); }
}

const SpaceType = { PARKING:'Parking', COWORKING:'Coworking', STUDY_ZONE:'Study Zone', SPORTS_VENUE:'Sports Venue', COMMUNITY_HALL:'Community Hall' };
const BookingStatus = { CONFIRMED:'CONFIRMED', CANCELLED:'CANCELLED', NO_SHOW:'NO_SHOW', ATTENDED:'ATTENDED', INFORMAL:'INFORMAL' };

const SPACES = [
  { id:0, name:'Cubbon Park Parking',       type:SpaceType.PARKING,        capacity:50,  base_utilization:0.62, icon:'🅿', color:'#c8ceee', area:'Cubbon Park, CBD' },
  { id:1, name:'Lalbagh Parking Zone',      type:SpaceType.PARKING,        capacity:40,  base_utilization:0.55, icon:'🅿', color:'#a7abde', area:'Lalbagh, South Bengaluru' },
  { id:2, name:'Koramangala CoWork Hub',    type:SpaceType.COWORKING,      capacity:30,  base_utilization:0.71, icon:'💼', color:'#d8bee5', area:'Koramangala, 4th Block' },
  { id:3, name:'Indiranagar CoWork Loft',   type:SpaceType.COWORKING,      capacity:25,  base_utilization:0.68, icon:'💼', color:'#e8daf0', area:'Indiranagar, 100ft Road' },
  { id:4, name:'Jayanagar Study Lounge',    type:SpaceType.STUDY_ZONE,     capacity:20,  base_utilization:0.80, icon:'📚', color:'#fcdce1', area:'Jayanagar, 4th Block' },
  { id:5, name:'HSR Layout Reading Room',   type:SpaceType.STUDY_ZONE,     capacity:15,  base_utilization:0.75, icon:'📚', color:'#f3e4f5', area:'HSR Layout, Sector 1' },
  { id:6, name:'Kanteerava Stadium Court',  type:SpaceType.SPORTS_VENUE,   capacity:10,  base_utilization:0.58, icon:'🏅', color:'#d8bee5', area:'Kanteerava, CBD' },
  { id:7, name:'Whitefield Sports Arena',   type:SpaceType.SPORTS_VENUE,   capacity:10,  base_utilization:0.50, icon:'🏅', color:'#c8ceee', area:'Whitefield, ITPL Road' },
  { id:8, name:'Town Hall Auditorium',      type:SpaceType.COMMUNITY_HALL, capacity:100, base_utilization:0.45, icon:'🏛', color:'#e8daf0', area:'Town Hall, MG Road' },
  { id:9, name:'Bannerghatta Community Hall', type:SpaceType.COMMUNITY_HALL, capacity:80, base_utilization:0.48, icon:'🏛', color:'#fcdce1', area:'Bannerghatta Road' },
];

function noShowProbability(b) {
  let p = 0.10;
  if (!b.is_repeat_user)          p += 0.12;
  if (b.advance_days > 7)         p += 0.08;
  if (b.is_weekend)               p += 0.05;
  if (b.hour_of_day < 7 || b.hour_of_day > 21) p += 0.10;
  p += b.cancellation_rate_user * 0.3;
  return Math.min(p, 0.65);
}

function features(b) {
  return [
    b.hour_of_day / 23.0,
    b.day_of_week / 6.0,
    b.advance_days / 30.0,
    b.is_repeat_user ? 1.0 : 0.0,
    b.is_peak_hour   ? 1.0 : 0.0,
    b.is_weekend     ? 1.0 : 0.0,
    b.cancellation_rate_user
  ];
}

function generateDataset(n = 500) {
  const rng = new SeededRNG(42);
  const seenUsers = new Set();
  const data = [];
  for (let i = 0; i < n; i++) {
    const b = {
      booking_id: i + 1,
      space_id:   rng.intBetween(0, 9),
      user_id:    rng.intBetween(1, 100),
      hour_of_day:  rng.intBetween(6, 22),
      day_of_week:  rng.intBetween(0, 6),
      advance_days: rng.intBetween(0, 30),
    };
    b.is_weekend   = b.day_of_week >= 5;
    b.is_peak_hour = (b.hour_of_day >= 9  && b.hour_of_day <= 11) || (b.hour_of_day >= 14 && b.hour_of_day <= 17);
    b.cancellation_rate_user = rng.realBetween(0, 0.5);
    b.is_repeat_user = seenUsers.has(b.user_id);
    seenUsers.add(b.user_id);
    const noShowP = noShowProbability(b);
    const r = rng.next();
    if      (r < noShowP * 0.4) b.status = BookingStatus.CANCELLED;
    else if (r < noShowP)       b.status = BookingStatus.NO_SHOW;
    else if (rng.next() < 0.05) b.status = BookingStatus.INFORMAL;
    else                        b.status = BookingStatus.ATTENDED;
    data.push(b);
  }
  return data;
}

class NoShowPredictor {
  constructor() { this.weights = new Array(8).fill(0.0); }
  sigmoid(z) { return 1.0 / (1.0 + Math.exp(-z)); }
  predictRaw(f) {
    let z = this.weights[0];
    for (let i = 0; i < f.length; i++) z += this.weights[i+1] * f[i];
    return this.sigmoid(z);
  }
  train(data, lr = 0.05, epochs = 200) {
    const n = data.length;
    for (let epoch = 0; epoch < epochs; epoch++) {
      const grad = new Array(8).fill(0.0);
      for (const b of data) {
        const f = features(b);
        const pred = this.predictRaw(f);
        const label = (b.status === BookingStatus.NO_SHOW) ? 1.0 : 0.0;
        const err = pred - label;
        grad[0] += err;
        for (let i = 0; i < f.length; i++) grad[i+1] += err * f[i];
      }
      for (let i = 0; i < 8; i++) this.weights[i] -= (lr / n) * grad[i];
    }
  }
  predictNoShowProb(b) { return this.predictRaw(features(b)); }
  evaluate(data) {
    let correct = 0;
    for (const b of data) {
      const predicted = this.predictNoShowProb(b) >= 0.5;
      const actual    = b.status === BookingStatus.NO_SHOW;
      if (predicted === actual) correct++;
    }
    return correct / data.length;
  }
}

class DemandForecaster {
  constructor() {
    this.hourlyDemand = Array.from({length:10}, () => new Array(24).fill(0));
    this.hourlyCounts = Array.from({length:10}, () => new Array(24).fill(0));
  }
  seasonalWeight(h) {
    if (h >= 9  && h <= 11) return 1.3;
    if (h >= 14 && h <= 17) return 1.25;
    if (h >= 19 && h <= 21) return 1.1;
    if (h < 7)              return 0.5;
    return 1.0;
  }
  fit(data) {
    for (const b of data) {
      if (b.status === BookingStatus.ATTENDED || b.status === BookingStatus.CONFIRMED) {
        this.hourlyDemand[b.space_id][b.hour_of_day] += 1.0;
        this.hourlyCounts[b.space_id][b.hour_of_day]++;
      }
    }
  }
  predict(horizonHours) {
    const forecasts = [];
    for (let h = 0; h < horizonHours; h++) {
      const hour = h % 24;
      let totalDemand = 0, count = 0;
      for (let s = 0; s < 10; s++) {
        const c = this.hourlyCounts[s][hour];
        if (c > 0) {
          const days = Math.max(1, Math.floor(c / 2));
          totalDemand += (this.hourlyDemand[s][hour] / days) * this.seasonalWeight(hour);
          count++;
        }
      }
      const avgDemand = count > 0 ? totalDemand / count : 0.3;
      const normalized = Math.min(1.0, avgDemand / 5.0);
      forecasts.push({ hour, predicted_demand: normalized, is_peak: normalized > 0.6, confidence: 0.75 + 0.1 * Math.sin(hour * 0.5) });
    }
    return forecasts;
  }
}

class SpaceAllocator {
  optimize(data, predictor) {
    const results = [];
    const peakHours = [9, 10, 14, 15, 16, 17, 19];
    for (let spaceId = 0; spaceId < SPACES.length; spaceId++) {
      const space = SPACES[spaceId];
      for (const hour of peakHours) {
        const slice = data.filter(b => b.space_id === spaceId && b.hour_of_day === hour);
        if (!slice.length) continue;
        const confirmed = slice.filter(b => b.status === BookingStatus.CONFIRMED || b.status === BookingStatus.ATTENDED).length;
        const totalShowP = slice.reduce((s, b) => s + (1 - predictor.predictNoShowProb(b)), 0);
        const predictedActual = Math.max(1, Math.round(totalShowP));
        const unusedReserved = Math.max(0, confirmed - predictedActual);
        const walkInCap = Math.min(unusedReserved, Math.floor(space.capacity * 0.15));
        const naiveUtil    = confirmed / space.capacity;
        const optimUtil    = Math.min(1.0, (predictedActual + walkInCap) / space.capacity);
        results.push({ space_id: spaceId, hour, reserved_slots: confirmed, predicted_actual: predictedActual, walk_in_capacity: walkInCap, utilization_rate: optimUtil, efficiency_gain: optimUtil - naiveUtil });
      }
    }
    return results;
  }
}

function runAnalytics(data, allocResults) {
  const total = data.length;
  const noShows  = data.filter(b => b.status === BookingStatus.NO_SHOW).length;
  const cancels  = data.filter(b => b.status === BookingStatus.CANCELLED).length;
  const informal = data.filter(b => b.status === BookingStatus.INFORMAL).length;
  let utilBefore = 0, utilAfter = 0, wastedTotal = 0, walkinTotal = 0, count = 0;
  for (const r of allocResults) {
    const space = SPACES[r.space_id];
    utilBefore += r.reserved_slots / space.capacity;
    utilAfter  += r.utilization_rate;
    wastedTotal += Math.max(0, r.reserved_slots - r.predicted_actual);
    walkinTotal += r.walk_in_capacity;
    count++;
  }
  if (count) { utilBefore /= count; utilAfter /= count; }
  const spaceStats = SPACES.map(space => {
    const spaceData = data.filter(b => b.space_id === space.id);
    const spNS      = spaceData.filter(b => b.status === BookingStatus.NO_SHOW).length;
    const spTot     = spaceData.length;
    const spActual  = spaceData.filter(b => b.status === BookingStatus.ATTENDED).length;
    const spConfirmed = spaceData.filter(b => b.status === BookingStatus.ATTENDED || b.status === BookingStatus.CONFIRMED).length;
    const spInformal  = spaceData.filter(b => b.status === BookingStatus.INFORMAL).length;
    const spAlloc   = allocResults.filter(r => r.space_id === space.id);
    const spWasted  = spAlloc.reduce((s,r) => s + Math.max(0, r.reserved_slots - r.predicted_actual), 0);
    const spWalkin  = spAlloc.reduce((s,r) => s + r.walk_in_capacity, 0);
    const spPredAvg = spAlloc.length ? spAlloc.reduce((s,r) => s + r.utilization_rate, 0) / spAlloc.length : (spActual / Math.max(1, space.capacity));
    return { space, noShowRate: spTot > 0 ? spNS / spTot : 0, utilization: spPredAvg, wasted: spWasted, recovered: spWalkin, reserved: spConfirmed, actual: spActual, walkins: spInformal, noShowCount: spNS };
  });
  return { total, noShows, cancels, informal, noShowRate: noShows/total, cancelRate: cancels/total, utilBefore, utilAfter, wastedTotal, walkinTotal, spaceStats };
}

// ════════════════════════════════════════════════════════════════════════
//  USER BOOKING STATE
// ════════════════════════════════════════════════════════════════════════

let userBookings = []; // { id, spaceId, spaceName, date, hour, duration, notes, status, bookedAt }
let pendingCancelId = null;
let pendingBookSpaceId = null;
let currentFilter = 'all';
let globalStats = null;

function generateBookingId() {
  return 'BK' + Date.now().toString(36).toUpperCase().slice(-6);
}

function openBookModal(spaceId) {
  const space = SPACES[spaceId];
  pendingBookSpaceId = spaceId;

  document.getElementById('bookModalTitle').textContent = 'Reserve ' + space.name;
  document.getElementById('bookModalSub').innerHTML =
    `<span style="font-size:20px">${space.icon}</span>
     <span>${space.type} · Capacity ${space.capacity}</span>`;

  // Default date to today
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0];
  document.getElementById('bookDate').value = dateStr;
  document.getElementById('bookDate').min = dateStr;

  // Show no-show warning if high risk
  const spStats = globalStats ? globalStats.spaceStats.find(s => s.space.id === spaceId) : null;
  const warn = document.getElementById('noShowWarning');
  if (spStats && spStats.noShowRate >= 0.25) {
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }

  document.getElementById('bookModal').classList.add('open');
}

function confirmBooking() {
  const name     = document.getElementById('bookName').value.trim();
  const email    = document.getElementById('bookEmail').value.trim();
  const date     = document.getElementById('bookDate').value;
  const hour     = parseInt(document.getElementById('bookHour').value);
  const duration = parseInt(document.getElementById('bookDuration').value);
  const notes    = document.getElementById('bookNotes').value.trim();
  const sendEmail = document.getElementById('emailToggle').classList.contains('on');

  if (!name || !date) {
    showToast('Please fill in your name and date.', 'error');
    return;
  }

  const space = SPACES[pendingBookSpaceId];
  const booking = {
    id: generateBookingId(),
    spaceId: pendingBookSpaceId,
    spaceName: space.name,
    spaceIcon: space.icon,
    spaceColor: space.color,
    spaceType: space.type,
    name,
    email,
    date,
    hour,
    duration,
    notes,
    status: 'CONFIRMED',
    bookedAt: new Date().toISOString(),
  };
  userBookings.push(booking);

  closeModal('bookModal');
  updateBookingBadge();

  // Push in-app notification
  pushNotification({
    title: '✅ Booking Confirmed',
    desc: `${space.name} on ${formatDate(date)} at ${formatHour(hour)} for ${duration}h. ID: ${booking.id}`,
    time: 'Just now',
    unread: true,
  });

  showToast(`Booking confirmed! ID: ${booking.id}`, 'success');

  // Show email preview if toggle is on
  if (sendEmail) {
    setTimeout(() => showEmailPreview(booking), 600);
  }

  renderSpacesGrid();
}

function openCancelModal(bookingId) {
  const booking = userBookings.find(b => b.id === bookingId);
  if (!booking) return;
  pendingCancelId = bookingId;
  document.getElementById('cancelModalDesc').innerHTML =
    `Booking <strong>${bookingId}</strong> for <strong>${booking.spaceName}</strong> on ${formatDate(booking.date)} at ${formatHour(booking.hour)} will be cancelled. Walk-in users may take your spot.`;
  document.getElementById('cancelModal').classList.add('open');
}

function confirmCancel() {
  const idx = userBookings.findIndex(b => b.id === pendingCancelId);
  if (idx !== -1) {
    const booking = userBookings[idx];
    userBookings[idx].status = 'CANCELLED';
    closeModal('cancelModal');
    updateBookingBadge();
    renderMyBookings();
    renderSpacesGrid();
    pushNotification({
      title: '🚫 Booking Cancelled',
      desc: `${booking.spaceName} on ${formatDate(booking.date)} at ${formatHour(booking.hour)}. Slot released for others.`,
      time: 'Just now',
      unread: true,
    });
    showToast('Booking cancelled. Your slot has been released.', 'success');
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

function updateBookingBadge() {
  const active = userBookings.filter(b => b.status === 'CONFIRMED').length;
  const badge = document.getElementById('booking-badge');
  if (active > 0) { badge.textContent = active; badge.style.display = 'inline'; }
  else { badge.style.display = 'none'; }
}

