# SpaceBook — Lilac Dreamer Edition

Public space reservation system for Bengaluru.

---

## Project Structure

```
spacebook/
├── frontend/
│   ├── index.html   ← App shell & all HTML markup
│   ├── style.css    ← Lilac Dreamer design system + all component styles
│   └── app.js       ← UI rendering, navigation, auth, charts, PWA
│
└── backend/
    ├── engine.js    ← Core data models, simulation engine, booking logic
    ├── server.js    ← Node.js / Express REST API server
    └── package.json
```

---

## Run Locally

### Option A — Open directly in browser (no server needed)
Just open `frontend/index.html` in Chrome. Everything runs client-side.

### Option B — With Node.js backend
```bash
cd backend
npm install
npm start
# → http://localhost:3000
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/spaces` | List all spaces with today's availability |
| GET | `/api/spaces/:id` | Single space detail |
| GET | `/api/availability?spaceId=&date=` | Slot availability for a date |
| POST | `/api/auth/login` | Sign in (body: `{ email, password }`) |
| GET | `/api/bookings?userId=` | List bookings for a user |
| POST | `/api/bookings` | Create a booking |
| PATCH | `/api/bookings/:id/cancel` | Cancel a booking |
| GET | `/api/analytics` | Aggregate stats per space |

---

## Tech Stack

**Frontend**
- Vanilla HTML/CSS/JS (no framework)
- Chart.js 4 for analytics charts
- Tabler Icons + Space Grotesk font
- PWA-ready (installable on Android via Chrome)

**Backend**
- Node.js + Express
- In-memory store (swap for PostgreSQL / MongoDB in production)
