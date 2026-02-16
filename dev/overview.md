# Brimfrost v2 - Overview

## Current State (v1)

**Brimfrost** is an interactive family tree visualization application built as a single `index.html` file with:

### Features
- **Interactive Graph**: Uses d3@6 and family-chart@0.7.2 for family tree rendering
- **Live Search**: Search by name, bio, tags, locations - real-time suggestions
- **Profile Modal**: Detailed person view with portrait, bio, tags, locations, media (images/video/files)
- **Comparison Panel**: Shift+click two people to compare - shows relationship path, shared tags/locations
- **Data**: All hardcoded in-memory JavaScript array `DATA`
- **Auth**: Vercel edge middleware with basic username/password + cookie sessions
- **Deployment**: Vercel (static)

### Tech Stack (v1)
- Frontend: Plain HTML + inline CSS/JS
- CDN: d3, family-chart, Firebase (compat)
- Auth: Vercel edge middleware + environment variables
- Storage: In-memory JavaScript

### Limitations
- Single HTML file (2500+ lines)
- No persistent data storage
- Auth tied to Vercel deployment
- No admin/edit interface for data
- Hard to scale or modify

---

## Goals for v2 Rewrite

### Keep
✅ d3 and family-chart libraries (graph implementation is solid)  
✅ Interactive features (search, comparison, profiles)  
✅ Visual design (dark theme, modal layouts)  

### Improve
🔄 **Architecture**: Separate frontend/backend/database  
🔄 **Persistence**: Real database for family data + user management  
🔄 **Auth**: Local authentication (no cloud dependency) with encrypted passwords  
🔄 **Developer Experience**: Modern build tools, organized codebase  
🔄 **Deployment**: Docker Compose for self-hosted environment  
🔄 **Scalability**: Admin interface for data management (future phase)  

---

## v2 Tech Stack (Proposed)

### Frontend
- **Bundler**: Vite (fast dev server, HMR)
- **Runtime**: Vanilla JavaScript (keep existing d3/family-chart code)
- **Styling**: CSS (PostCSS/Tailwind optional)
- **Build**: `npm run build` → static files

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js (lightweight, proven)
- **Port**: 3000 (configurable)

### Database
- **SQL**: PostgreSQL 16 (robust, relational)
- **Containerized**: Docker image in compose stack
- **Port**: 5432 (internal to compose network)

### Authentication
- **Strategy**: JWT + bcrypt
- **Flow**: Login → verify credentials in DB → issue JWT → frontend stores in localStorage
- **Sessions**: Optional (JWT stateless by default)
- **Users**: Stored in `users` table with hashed passwords

### Deployment
- **Containerization**: Docker Compose
- **Services**:
  - `frontend` - Nginx serving Vite-built static files
  - `backend` - Express.js API container
  - `db` - PostgreSQL 16 container
  - Optional: pgAdmin for DB inspection (dev only)
- **Networking**: Internal compose network
- **Volumes**: PostgreSQL data persisted to named volume

---

## Implementation Phases

### Phase 1: Setup & Structure ✨
- Create Node.js backend project structure
- Set up Express.js with basic middleware
- Create Docker Compose stack (db + backend + frontend)
- Implement PostgreSQL schema for family data
- Set up Vite frontend build

### Phase 2: Authentication 🔐
- User table schema + migrations
- Bcrypt password hashing
- JWT token generation
- Login endpoint `/api/auth/login`
- Protected route middleware
- Frontend login page + token storage

### Phase 3: Data API 📊
- Family data schema (persons, relationships, media)
- REST endpoints:
  - `GET /api/persons` - all family members
  - `GET /api/persons/:id` - single person
  - `GET /api/search?q=...` - search
  - `POST /api/persons` - add person (admin)
  - `PATCH /api/persons/:id` - edit person (admin)

### Phase 4: Frontend Integration 🎨
- Migrate current `index.html` to Vite project
- Fetch family data from `/api/persons`
- Keep d3/family-chart rendering intact
- Integrate JWT auth (login page → token → API calls)
- Profile page + comparison features

### Phase 5: Admin Interface (Future) ⚙️
- Dashboard for editing family data
- Add/edit/delete persons
- Manage relationships
- Media upload

---

## Why This Stack?

| Aspect | Choice | Why |
|--------|--------|-----|
| **Frontend** | Vite + Vanilla JS | Fast HMR, no build overhead, preserves existing d3 code |
| **Backend** | Express.js | Lightweight, proven, perfect for small-to-medium APIs |
| **Database** | PostgreSQL | Robust SQL, great for relational data (family trees) |
| **Auth** | JWT + bcrypt | Stateless, self-contained, no cloud dependency |
| **Ops** | Docker Compose | Single command to spin up entire stack locally |
| **Language** | JavaScript | Consistency across frontend/backend |

---

## Directory Structure (Target)

```
hammerofsteel/
├── dev/                    (planning & docs)
│   ├── overview.md
│   ├── readme.md
│   ├── architecture.md
│   └── PROGRESS.md
├── brimfrost-v2/           (new implementation)
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── backend/
│   │   ├── package.json
│   │   ├── server.js
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── db/
│   ├── frontend/
│   │   ├── vite.config.js
│   │   ├── package.json
│   │   ├── src/
│   │   └── public/
│   └── docker/
│       ├── backend.Dockerfile
│       └── frontend.Dockerfile
└── brimfrost/              (original v1)
```

---

## Next Steps

1. ✅ Create `/dev` planning documents ← **We are here**
2. Initialize backend Node.js project with Express  
3. Set up PostgreSQL schema
4. Create Docker Compose configuration
5. Build authentication system
6. Implement family data API
7. Migrate & integrate frontend
8. Testing & deployment docs

