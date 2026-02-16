# Brimfrost v2 - Project README

## Quick Start

### Prerequisites
- Docker & Docker Compose installed
- Node.js 18+ (for local development without Docker)

### Run with Docker Compose

```bash
# Clone or navigate to project
cd brimfrost-v2

# Copy environment template
cp .env.example .env

# Start all services (database, backend, frontend)
docker-compose up --build

# In another terminal, seed the database with test data
docker-compose exec backend npm run seed
```

Then visit:
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api
- **pgAdmin** (optional): http://localhost:5050 (use `dev` profile)

### Default Credentials

```
Email: test@example.com
Password: test123
```

---

## Local Development (Without Docker)

### Terminal 1: Database
```bash
docker run -d \
  -e POSTGRES_USER=brimfrost_user \
  -e POSTGRES_PASSWORD=brimfrost_pass \
  -e POSTGRES_DB=brimfrost \
  -p 5432:5432 \
  postgres:16
```

### Terminal 2: Backend
```bash
cd backend
npm install
npm run dev
```

### Terminal 3: Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Project Structure

```
brimfrost-v2/
├── backend/
│   ├── server.js              # Express app entry
│   ├── package.json
│   ├── config/
│   │   └── database.js
│   ├── middleware/
│   │   ├── auth.js            # JWT + authorization
│   │   └── errorHandler.js
│   ├── routes/
│   │   ├── auth.js            # /api/auth/login, /register
│   │   ├── persons.js         # /api/persons
│   │   └── admin.js           # /api/admin (protected)
│   ├── controllers/
│   │   └── authController.js
│   └── db/
│       ├── schema.sql         # Database schema
│       └── seed.js            # Test data
├── frontend/
│   ├── src/
│   │   ├── main.js            # Entry point
│   │   ├── api.js             # API client
│   │   └── index.html         # HTML shell
│   ├── vite.config.js
│   └── package.json
├── docker/
│   ├── backend.Dockerfile
│   └── frontend.Dockerfile
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Endpoints

### Authentication

```bash
# Login
POST /api/auth/login
Body: { email: string, password: string }
Response: { token: string, user: { id, email, name, is_admin } }

# Register
POST /api/auth/register
Body: { email: string, password: string, name: string }
Response: { token: string, user: {...} }
```

### Family Data (Requires Auth)

```bash
# Get all persons
GET /api/persons
Headers: Authorization: Bearer {token}

# Get single person
GET /api/persons/:id
Headers: Authorization: Bearer {token}

# Search
GET /api/search?q=query
Headers: Authorization: Bearer {token}

# Get person media
GET /api/persons/:id/media
Headers: Authorization: Bearer {token}
```

### Admin Operations (Requires Auth + Admin Role)

```bash
# Create person
POST /api/admin/persons
Body: { name: string, bio?: string, birth_year?: number, ... }

# Update person
PATCH /api/admin/persons/:id
Body: { name?, bio?, birth_year?, ... }

# Delete person
DELETE /api/admin/persons/:id
```

---

## Database Schema

### Users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### Persons
```sql
CREATE TABLE persons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  photo_url VARCHAR(1024),
  gender VARCHAR(20),
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

Plus: relationships, locations, tags, media, and junction tables.
See [/dev/architecture.md](../dev/architecture.md) for full schema.

---

## Features

### MVP (Phase 1-4)
- ✅ Authentication (JWT + bcrypt)
- ✅ Family member database (PostgreSQL)
- ✅ REST API for data access
- ⏳ Family tree visualization (d3 + family-chart)
- ⏳ Search functionality
- ⏳ Profile modal + comparison panel

### Future (Phase 5+)
- Admin interface for data management
- Media upload
- Export to PDF
- OAuth2 integration
- Mobile app

---

## Environment Variables

See [.env.example](./.env.example)

Key variables:
- `DB_PASSWORD` - PostgreSQL password
- `JWT_SECRET` - JWT signing key (change in production!)
- `VITE_API_URL` - Frontend API endpoint

---

## Troubleshooting

### Port already in use
```bash
# Change port in docker-compose.yml or .env
# Or stop conflicting containers
docker ps
docker stop <container_id>
```

### Database won't initialize
```bash
docker-compose down -v              # Remove volumes
docker-compose up db -d             # Start fresh
```

### Frontend can't connect to backend
- Check `VITE_API_URL` in `.env`
- Ensure backend is running and healthy
- Check CORS configuration in `backend/server.js`

---

## Development Workflow

1. **Backend changes**: Auto-reload via `nodemon` in Docker
2. **Frontend changes**: HMR (hot module reload) via Vite
3. **Database schema**: Update `/backend/db/schema.sql`, restart container
4. **Test data**: Run `docker-compose exec backend npm run seed`

---

## Next Steps

See [/dev/PROGRESS.md](../dev/PROGRESS.md) for implementation status and roadmap.

---

## Resources

- [Architecture & Design](../dev/architecture.md)
- [Project Overview](../dev/overview.md)
- [Planning & Progress](../dev/PROGRESS.md)

---

**Status**: Phase 1 Complete ✅ | Phase 2-4 In Progress 🔨  
**Last Updated**: February 14, 2026
