/**
 * SpaceBook — Backend Server (Node.js / Express)
 * ════════════════════════════════════════════════
 * Exposes REST API endpoints that mirror the in-browser
 * simulation logic found in engine.js.
 *
 * Run:
 *   npm install express cors
 *   node server.js
 *
 * Base URL: http://localhost:3000/api
 */

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ── Serve frontend ────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../frontend')));

// ── In-memory data store (replace with a real DB in production) ──────────
const SpaceType = {
  PARKING:        'Parking',
  COWORKING:      'Coworking',
  STUDY_ZONE:     'Study Zone',
  SPORTS_VENUE:   'Sports Venue',
  COMMUNITY_HALL: 'Community Hall',
};

const BookingStatus = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
  NO_SHOW:   'NO_SHOW',
  ATTENDED:  'ATTENDED',
  INFORMAL:  'INFORMAL',
};

const SPACES = [
  { id:0, name:'Cubbon Park Parking',         type:SpaceType.PARKING,        capacity:50,  base_utilization:0.62, icon:'🅿',  color:'#c8ceee', area:'Cubbon Park, CBD' },
  { id:1, name:'Lalbagh Parking Zone',        type:SpaceType.PARKING,        capacity:40,  base_utilization:0.55, icon:'🅿',  color:'#a7abde', area:'Lalbagh, South Bengaluru' },
  { id:2, name:'Koramangala CoWork Hub',      type:SpaceType.COWORKING,      capacity:30,  base_utilization:0.71, icon:'💼', color:'#d8bee5', area:'Koramangala, 4th Block' },
  { id:3, name:'Indiranagar CoWork Loft',     type:SpaceType.COWORKING,      capacity:25,  base_utilization:0.68, icon:'💼', color:'#e8daf0', area:'Indiranagar, 100ft Road' },
  { id:4, name:'Jayanagar Study Lounge',      type:SpaceType.STUDY_ZONE,     capacity:20,  base_utilization:0.80, icon:'📚', color:'#fcdce1', area:'Jayanagar, 4th Block' },
  { id:5, name:'HSR Layout Reading Room',     type:SpaceType.STUDY_ZONE,     capacity:15,  base_utilization:0.75, icon:'📚', color:'#f3e4f5', area:'HSR Layout, Sector 1' },
  { id:6, name:'Kanteerava Stadium Court',    type:SpaceType.SPORTS_VENUE,   capacity:10,  base_utilization:0.58, icon:'🏅', color:'#d8bee5', area:'Kanteerava, CBD' },
  { id:7, name:'Whitefield Sports Arena',     type:SpaceType.SPORTS_VENUE,   capacity:10,  base_utilization:0.50, icon:'🏅', color:'#c8ceee', area:'Whitefield, ITPL Road' },
  { id:8, name:'Town Hall Auditorium',        type:SpaceType.COMMUNITY_HALL, capacity:100, base_utilization:0.45, icon:'🏛',  color:'#e8daf0', area:'Town Hall, MG Road' },
  { id:9, name:'Bannerghatta Community Hall', type:SpaceType.COMMUNITY_HALL, capacity:80,  base_utilization:0.48, icon:'🏛',  color:'#fcdce1', area:'Bannerghatta Road' },
];

// Simple in-memory user store
const users = [
  { id:1, email:'arjun@spacebook.in', password:'password123', firstName:'Arjun', lastName:'Sharma', phone:'+91 98765 43210', role:'admin' },
];

// In-memory bookings store
let bookings = [];
let bookingIdSeq = 1;

// ── Helpers ───────────────────────────────────────────────────────────────
function getAvailability(spaceId, date) {
  const space = SPACES.find(s => s.id === spaceId);
  if (!space) return null;
  const confirmed = bookings.filter(b =>
    b.space_id === spaceId &&
    b.date === date &&
    b.status === BookingStatus.CONFIRMED
  ).length;
  const free  = Math.max(0, space.capacity - confirmed);
  const total = space.capacity;
  return { spaceId, date, total, confirmed, free, utilization: confirmed / total };
}

// ── Routes ────────────────────────────────────────────────────────────────

// GET /api/spaces  — list all spaces with live availability for today
app.get('/api/spaces', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const result = SPACES.map(s => ({
    ...s,
    availability: getAvailability(s.id, today),
  }));
  res.json({ spaces: result });
});

// GET /api/spaces/:id  — single space detail
app.get('/api/spaces/:id', (req, res) => {
  const space = SPACES.find(s => s.id === parseInt(req.params.id));
  if (!space) return res.status(404).json({ error: 'Space not found' });
  const today = new Date().toISOString().slice(0, 10);
  res.json({ space: { ...space, availability: getAvailability(space.id, today) } });
});

// GET /api/availability?spaceId=&date=
app.get('/api/availability', (req, res) => {
  const { spaceId, date } = req.query;
  if (!spaceId || !date) return res.status(400).json({ error: 'spaceId and date required' });
  const av = getAvailability(parseInt(spaceId), date);
  if (!av) return res.status(404).json({ error: 'Space not found' });
  res.json(av);
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  // Demo: accept any credentials (mirror in-browser behaviour)
  let user = users.find(u => u.email === email);
  if (!user) {
    // Auto-create demo user
    const parts    = email.split('@')[0].split('.');
    const newUser  = {
      id: users.length + 1,
      email,
      password,
      firstName: parts[0].charAt(0).toUpperCase() + parts[0].slice(1),
      lastName:  parts[1] ? parts[1].charAt(0).toUpperCase() + parts[1].slice(1) : '',
      phone: '',
      role: 'user',
    };
    users.push(newUser);
    user = newUser;
  }
  const { password: _pw, ...safeUser } = user;
  res.json({ user: safeUser, token: `demo-token-${user.id}` });
});

// GET /api/bookings?userId=
app.get('/api/bookings', (req, res) => {
  const { userId } = req.query;
  const result = userId
    ? bookings.filter(b => b.user_id === parseInt(userId))
    : bookings;
  res.json({ bookings: result });
});

// POST /api/bookings  — create a booking
app.post('/api/bookings', (req, res) => {
  const { user_id, space_id, date, time_slot, people_count, purpose } = req.body;
  if (!user_id || space_id === undefined || !date || !time_slot)
    return res.status(400).json({ error: 'user_id, space_id, date and time_slot are required' });

  const space = SPACES.find(s => s.id === space_id);
  if (!space) return res.status(404).json({ error: 'Space not found' });

  const av = getAvailability(space_id, date);
  if (av.free <= 0)
    return res.status(409).json({ error: 'Space fully booked for this date' });

  const booking = {
    id:           bookingIdSeq++,
    user_id,
    space_id,
    space_name:   space.name,
    date,
    time_slot,
    people_count: people_count || 1,
    purpose:      purpose || '',
    status:       BookingStatus.CONFIRMED,
    created_at:   new Date().toISOString(),
    booking_ref:  `SB-${Date.now().toString(36).toUpperCase()}`,
  };
  bookings.push(booking);
  res.status(201).json({ booking });
});

// PATCH /api/bookings/:id/cancel
app.patch('/api/bookings/:id/cancel', (req, res) => {
  const booking = bookings.find(b => b.id === parseInt(req.params.id));
  if (!booking)  return res.status(404).json({ error: 'Booking not found' });
  if (booking.status !== BookingStatus.CONFIRMED)
    return res.status(400).json({ error: 'Only confirmed bookings can be cancelled' });
  booking.status = BookingStatus.CANCELLED;
  res.json({ booking });
});

// GET /api/analytics  — aggregate stats
app.get('/api/analytics', (req, res) => {
  const stats = SPACES.map(space => {
    const spaceBookings = bookings.filter(b => b.space_id === space.id);
    const confirmed     = spaceBookings.filter(b => b.status === BookingStatus.CONFIRMED).length;
    const cancelled     = spaceBookings.filter(b => b.status === BookingStatus.CANCELLED).length;
    const noShows       = spaceBookings.filter(b => b.status === BookingStatus.NO_SHOW).length;
    return {
      space_id:      space.id,
      space_name:    space.name,
      total_bookings: spaceBookings.length,
      confirmed,
      cancelled,
      no_shows:      noShows,
      utilization:   confirmed / space.capacity,
    };
  });
  res.json({ analytics: stats });
});

// ── Start ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`SpaceBook API running → http://localhost:${PORT}`);
  console.log(`Frontend served   → http://localhost:${PORT}`);
});
