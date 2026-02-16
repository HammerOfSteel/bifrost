# Brimfrost v2 - Quick Start Guide

## What Was Created

This is a complete modern rebuild of Brimfrost with:

✅ **Frontend**: Vite + Vanilla JS (keep d3/family-chart libraries)  
✅ **Backend**: Express.js REST API with JWT auth  
✅ **Database**: PostgreSQL with full relational schema  
✅ **Auth**: Local authentication (no cloud dependency)  
✅ **Docker**: Complete Docker Compose stack for easy setup  

---

## Prerequisites

- **Docker & Docker Compose** installed
- Or **Node.js 18+** + **PostgreSQL 16** for local development

---

## Option 1: Start with Docker Compose (Recommended)

### Step 1: Prepare

```bash
# Navigate to project
cd brimfrost-v2

# Copy environment template
cp .env.example .env

# Review .env if you want to customize ports/passwords
cat .env
```

### Step 2: Start Services

```bash
# Build and start all containers
docker-compose up --build

# In another terminal, seed the database
docker-compose exec backend npm run seed
```

You should see:
```
✅ User created: { id: 1 }
✅ Persons created: 5
✅ Locations created: 3
✅ Tags created: 4
✅ Database seeded successfully!

Default Login:
  Email: test@example.com
  Password: test123
```

### Step 3: Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000/api/persons
- **Database Admin** (pgAdmin): http://localhost:5050 (optional)

### Step 4: Test Login

1. Navigate to http://localhost:5173
2. Login with:
   - Email: `test@example.com`
   - Password: `test123`

---

## Option 2: Local Development (Without Docker)

### Step 1: Start PostgreSQL

```bash
# This will create a PostgreSQL container for the database only
docker run -d \
  -e POSTGRES_USER=brimfrost_user \
  -e POSTGRES_PASSWORD=brimfrost_pass \
  -e POSTGRES_DB=brimfrost \
  -p 5432:5432 \
  postgres:16
```

### Step 2: Initialize Database

```bash
# Connect and run the schema
docker exec -i <container_id> psql -U brimfrost_user -d brimfrost < backend/db/schema.sql

# Or manually:
psql postgresql://brimfrost_user:brimfrost_pass@localhost:5432/brimfrost -f backend/db/schema.sql
```

### Step 3: Backend (Terminal 1)

```bash
cd backend
npm install
npm run seed        # Seed test data
npm run dev         # Start with auto-reload
```

You should see:
```
╭────────────────────────────────────────────────────╮
│  🧊 Brimfrost v2 Backend                           │
│  Server running on http://localhost:3000           │
│  Environment: development                          │
│  Database: Connected                               │
╰────────────────────────────────────────────────────╯
```

### Step 4: Frontend (Terminal 2)

```bash
cd frontend
npm install
npm run dev
```

You should see:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  press h to show help
```

### Step 5: Test

Navigate to http://localhost:5173 and login with test@example.com / test123

---

## Testing the API

### 1. Login

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "test123"
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "test@example.com",
      "name": "Test User",
      "is_admin": true
    }
  }
}
```

### 2. Get All Persons

```bash
curl -X GET http://localhost:3000/api/persons \
  -H "Authorization: Bearer <your_token_here>"
```

### 3. Search

```bash
curl -X GET "http://localhost:3000/api/persons/search?q=erik" \
  -H "Authorization: Bearer <your_token_here>"
```

---

## Common Commands

### Docker Compose

```bash
# Start services
docker-compose up

# Start in background
docker-compose up -d

# View logs
docker-compose logs -f backend      # Backend logs
docker-compose logs -f frontend     # Frontend logs
docker-compose logs -f db           # Database logs

# Stop everything
docker-compose down

# Remove volumes (data)
docker-compose down -v

# Access database directly
docker-compose exec db psql -U brimfrost_user -d brimfrost

# Seed again
docker-compose exec backend npm run seed
```

### Local Development

```bash
# Backend
cd backend
npm run dev         # Auto-reload via nodemon
npm run start       # Production mode

# Frontend  
cd frontend
npm run dev         # HMR enabled
npm run build       # Create dist/

# Database
npm run seed        # (from backend dir) Populate test data
```

---

## Project Structure

```
brimfrost-v2/
├── backend/
│   ├── server.js              🔴 Express entry point
│   ├── package.json
│   ├── config/
│   │   └── database.js        📊 PostgreSQL connection
│   ├── middleware/
│   │   ├── auth.js            🔐 JWT verification
│   │   └── errorHandler.js    ⚠️  Error handling
│   ├── routes/
│   │   ├── auth.js            /api/auth/login, /register
│   │   ├── persons.js         /api/persons, /search
│   │   └── admin.js           /api/admin (protected)
│   ├── controllers/
│   │   └── authController.js
│   └── db/
│       ├── schema.sql         📋 Database schema
│       └── seed.js            🌱 Test data
├── frontend/
│   ├── src/
│   │   ├── main.js            🎨 Entry & app logic
│   │   ├── api.js             🌐 API client
│   │   └── index.html         📄 HTML shell
│   ├── vite.config.js
│   └── package.json
├── docker/
│   ├── backend.Dockerfile
│   └── frontend.Dockerfile
├── docker-compose.yml         🐳 Services config
├── .env.example               ⚙️  Environment template
├── README.md                  📖 Full documentation
└── QUICK_START.md            ⬅️  This file
```

---

## What's Next?

### Phase 2: Complete Authentication ✅
- [x] Login/register endpoints
- [x] JWT token generation
- [x] Protected routes

### Phase 3: Data API 📊
- [ ] Finish persons endpoints
- [ ] Implement search
- [ ] Admin CRUD operations

### Phase 4: Frontend Integration 🎨
- [ ] Migrate d3 + family-chart visualization
- [ ] Connect to API
- [ ] Implement profile modal
- [ ] Implement search UI
- [ ] Implement comparison panel

### Phase 5: Docker & Deployment 🐳
- [ ] Test full Docker Compose stack
- [ ] Production configuration
- [ ] Deployment docs

---

## Troubleshooting

### ❌ "Address already in use"

Ports 3000, 5173, or 5432 are taken:

```bash
# Option 1: Stop Docker containers
docker ps
docker stop <container_id>

# Option 2: Change ports in docker-compose.yml or .env
# BACKEND_PORT=3001, FRONTEND_PORT=5174, DB_PORT=5433
```

### ❌ "Cannot connect to database"

```bash
# Check database is running
docker-compose logs db

# Restart database
docker-compose restart db

# Or manually check connection
docker-compose exec db psql -U brimfrost_user -d brimfrost -c "SELECT 1"
```

### ❌ "CORS Error"

- Verify `FRONTEND_URL` in backend `.env` matches your frontend URL
- Check `VITE_API_URL` in frontend `.env` matches your backend URL

### ❌ "Failed to fetch family data"

- Ensure backend is running: http://localhost:3000/api/health
- Ensure you're logged in with a valid token
- Check browser console for errors

---

## Environment Variables

For full list, see [.env.example](.env.example)

Key variables:

```
# Database
DB_USER=brimfrost_user
DB_PASSWORD=brimfrost_pass          ⚠️  CHANGE IN PRODUCTION
DB_NAME=brimfrost
DB_PORT=5432

# Backend
NODE_ENV=development
BACKEND_PORT=3000
JWT_SECRET=dev_secret_key...        ⚠️  CHANGE IN PRODUCTION

# Frontend
FRONTEND_PORT=5173
VITE_API_URL=http://localhost:3000/api
```

---

## Architecture Diagram

```
┌─────────────────────────────────┐
│  Browser (http://localhost)     │
│  ├─ Login Page                  │
│  ├─ Family Tree (d3 + d3chart)  │
│  └─ Modals & UI                 │
└────────────────┬────────────────┘
                 │ HTTP/REST
┌─────────────────────────────────────────────────────┐
│  Docker Compose Network                             │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │ Frontend Container (Vite Dev Server)        │  │
│  │ Port: 5173                                   │  │
│  └──────────────────────────────────────────────┘  │
│                     ↕ /api                         │
│  ┌──────────────────────────────────────────────┐  │
│  │ Backend Container (Express.js)               │  │
│  │ Port: 3000                                   │  │
│  │ ├─ Auth: /api/auth/login                    │  │
│  │ ├─ Data: /api/persons, /search              │  │
│  │ └─ Admin: /api/admin/persons                │  │
│  └──────────────────────────────────────────────┘  │
│                     ↕ SQL                          │
│  ┌──────────────────────────────────────────────┐  │
│  │ Database Container (PostgreSQL 16)          │  │
│  │ Port: 5432                                   │  │
│  │ ├─ users                                    │  │
│  │ ├─ persons                                  │  │
│  │ ├─ relationships                            │  │
│  │ ├─ locations, tags, media                   │  │
│  │ └─ Junction tables                          │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Documentation Files

- [README.md](./README.md) - Full project documentation
- [../dev/overview.md](../dev/overview.md) - Project goals & motivation
- [../dev/architecture.md](../dev/architecture.md) - Detailed technical design
- [../dev/PROGRESS.md](../dev/PROGRESS.md) - Implementation progress tracker

---

## Need Help?

1. **Check logs**: `docker-compose logs <service>`
2. **Review architecture**: [../dev/architecture.md](../dev/architecture.md)
3. **Read API docs**: [README.md](./README.md#api-endpoints)
4. **Check progress**: [../dev/PROGRESS.md](../dev/PROGRESS.md)

---

**Status**: Phase 1 Complete ✅ Ready to Test  
**Created**: February 14, 2026  
**Last Updated**: Today
