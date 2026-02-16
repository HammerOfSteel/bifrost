# Brimfrost v2 - Architecture & Technical Design

## Table of Contents
1. [System Architecture](#system-architecture)
2. [Technology Stack Details](#technology-stack-details)
3. [Database Schema](#database-schema)
4. [API Design](#api-design)
5. [Authentication Flow](#authentication-flow)
6. [Deployment with Docker Compose](#deployment-with-docker-compose)
7. [Development Environment](#development-environment)

---

## System Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────┐
│                   User's Browser                     │
│  (Vite Dev Server on :3000 / Nginx on :80)          │
│                                                     │
│  - Login page                                       │
│  - Family tree visualization (d3 + family-chart)   │
│  - Search, profiles, comparison panels              │
└────────────────┬────────────────────────────────────┘
                 │ HTTP/CORS
                 │
         Docker Compose Network
         (internal, no external access)
         │
┌─────────────────────────────────────────────────────┐
│                   Backend Container                  │
│         (Express.js + Node.js on :3000)             │
│                                                     │
│  Routes:                                            │
│  /api/auth/login        → JWT token                │
│  /api/persons           → GET family data          │
│  /api/persons/:id       → GET single person        │
│  /api/search            → Search query             │
│  /api/admin/persons     → POST/PATCH (protected)   │
└─────────────────┬───────────────────────────────────┘
                  │ SQL
                  │
┌──────────────────────────────────────────────────────┐
│         Database Container                           │
│    (PostgreSQL 16 on :5432 internal)                │
│                                                     │
│  Tables:                                            │
│  - users                   (auth credentials)       │
│  - persons                 (family members)         │
│  - relationships           (family connections)     │
│  - media                   (photos/videos)          │
│  - locations               (places referenced)      │
│  - person_locations        (junction table)         │
│  - person_tags             (junction table)         │
└──────────────────────────────────────────────────────┘
```

### Service Components

#### 1. Frontend
- **Runtime**: Browser (vanilla JavaScript)
- **Build Tool**: Vite
- **Purpose**: User interface for family tree visualization
- **Key Libraries**: d3, family-chart (via CDN or npm)
- **State**: JWT token in localStorage

#### 2. Backend API
- **Runtime**: Node.js
- **Framework**: Express.js
- **Purpose**: API for authentication, data queries, admin operations
- **Key Dependencies**: 
  - `express` - HTTP framework
  - `pg` - PostgreSQL client
  - `jsonwebtoken` - JWT auth
  - `bcryptjs` - Password hashing
  - `cors` - CORS middleware
  - `dotenv` - Environment variables

#### 3. Database
- **System**: PostgreSQL 16
- **Purpose**: Persistent storage for family data + users
- **Access**: SQL via `pg` driver from backend
- **Backups**: Volume mount ensures data persistence

---

## Technology Stack Details

### Backend (Express.js + Node.js)

#### Core Dependencies
```json
{
  "express": "^4.18.0",
  "pg": "^8.11.0",
  "jsonwebtoken": "^9.1.0",
  "bcryptjs": "^2.4.3",
  "cors": "^2.8.5",
  "dotenv": "^16.3.1",
  "helmet": "^7.0.0",
  "morgan": "^1.10.0"
}
```

#### File Structure
```
backend/
├── server.js                    # Express app entry
├── config/
│   └── database.js             # PostgreSQL connection
├── middleware/
│   ├── auth.js                 # JWT verification
│   └── errorHandler.js         # Error handling
├── routes/
│   ├── auth.js                 # POST /auth/login, /auth/register
│   ├── persons.js              # GET /persons, /persons/:id, /search
│   └── admin.js                # POST/PATCH/DELETE persons (protected)
├── controllers/
│   ├── authController.js
│   ├── personController.js
│   └── adminController.js
├── db/
│   ├── schema.sql              # Table definitions
│   ├── seed.js                 # Test data loader
│   └── migrations/             # Future: schema changes
└── package.json
```

#### Key Endpoints

**Authentication**
```
POST   /api/auth/login
       Body: { email: string, password: string }
       Response: { token: string, user: { id, email, name } }

POST   /api/auth/register       (optional, restricted)
       Body: { email, password, name }
       Response: { token, user }
```

**Data (Public, needs token)**
```
GET    /api/persons
       Response: [{ id, name, bio, birth_year, photo_url, ... }, ...]

GET    /api/persons/:id
       Response: { id, name, bio, spouses: [...], children: [...], ... }

GET    /api/search?q=query
       Response: [{ id, name, match_type: "name|bio|tag|location", ... }, ...]

GET    /api/persons/:id/media
       Response: [{ id, type: "photo|video|file", url, ... }, ...]
```

**Admin (Protected - requires token + admin role)**
```
POST   /api/admin/persons
       Body: { name, bio, birth_year, photo_url, ... }
       Response: { id, ... }

PATCH  /api/admin/persons/:id
       Body: { name?, bio?, birth_year?, ... }
       Response: { id, ... }

DELETE /api/admin/persons/:id
       Response: { success: true }
```

### Frontend (Vite + Vanilla JS)

#### Entry Point
```
frontend/
├── src/
│   ├── main.js                 # Vite entry
│   ├── index.html              # HTML shell
│   ├── api.js                  # HTTP client + auth
│   ├── tree.js                 # d3 + family-chart wrapper
│   ├── ui/
│   │   ├── search.js           # Search component
│   │   ├── profile-modal.js    # Profile display
│   │   ├── compare-panel.js    # Comparison view
│   │   └── login-page.js       # Auth UI
│   └── styles/
│       └── main.css            # Styling
├── public/
│   └── (static assets)
└── vite.config.js
```

#### Build Output
```
dist/
├── index.html
├── main-{hash}.js
├── main-{hash}.css
└── (other assets)
```

---

## Database Schema

### Tables

#### `users` - Authentication
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,     -- bcrypt
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INDEXES:
- UNIQUE(email)
```

#### `persons` - Family Members
```sql
CREATE TABLE persons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  photo_url VARCHAR(1024),
  gender VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

INDEXES:
- btree(name) -- for search
```

#### `relationships` - Family Connections
```sql
CREATE TABLE relationships (
  id SERIAL PRIMARY KEY,
  person_a_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person_b_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL,  -- 'spouse', 'parent', 'child', 'sibling'
  started_year INTEGER,
  ended_year INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

INDEXES:
- btree(person_a_id, person_b_id)
- btree(relation_type)
```

#### `locations` - Places
```sql
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  region VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

INDEXES:
- btree(name)
```

#### `person_locations` - Junction Table
```sql
CREATE TABLE person_locations (
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, location_id)
);
```

#### `tags` - Metadata Tags
```sql
CREATE TABLE tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7)  -- hex color
);
```

#### `person_tags` - Junction Table
```sql
CREATE TABLE person_tags (
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, tag_id)
);
```

#### `media` - Photos, Videos, Files
```sql
CREATE TABLE media (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'photo', 'video', 'file'
  url VARCHAR(1024) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

INDEXES:
- btree(person_id)
- btree(type)
```

### Sample Query Patterns

```javascript
// Get a person with all relationships + media
SELECT 
  p.*,
  json_agg(DISTINCT r.*) AS relationships,
  json_agg(DISTINCT m.*) AS media,
  json_agg(DISTINCT l.*) AS locations,
  json_agg(DISTINCT t.*) AS tags
FROM persons p
LEFT JOIN relationships r ON (p.id = r.person_a_id OR p.id = r.person_b_id)
LEFT JOIN media m ON p.id = m.person_id
LEFT JOIN person_locations pl ON p.id = pl.person_id
LEFT JOIN locations l ON pl.location_id = l.id
LEFT JOIN person_tags pt ON p.id = pt.person_id
LEFT JOIN tags t ON pt.tag_id = t.id
WHERE p.id = $1
GROUP BY p.id;

// Full-text search
SELECT p.* FROM persons p
WHERE 
  p.name ILIKE '%' || $1 || '%' OR
  p.bio ILIKE '%' || $1 || '%' OR
  EXISTS (
    SELECT 1 FROM person_tags pt 
    JOIN tags t ON pt.tag_id = t.id 
    WHERE pt.person_id = p.id AND t.name ILIKE '%' || $1 || '%'
  )
LIMIT 50;
```

---

## API Design

### Request/Response Format

#### Success Response
```json
{
  "success": true,
  "data": { /* actual data */ },
  "timestamp": "2024-02-14T10:30:00Z"
}
```

#### Error Response
```json
{
  "success": false,
  "error": "NOT_FOUND",
  "message": "Person with ID 999 not found",
  "status": 404,
  "timestamp": "2024-02-14T10:30:00Z"
}
```

### Authentication Headers
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### CORS Configuration
```javascript
// Backend CORS setup
cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
})
```

---

## Authentication Flow

### Login Flow

```
1. User enters email/password on frontend
   ↓
2. POST /api/auth/login { email, password }
   ↓
3. Backend:
   - Look up user by email
   - Compare password with bcrypt
   - If valid, generate JWT (expires in 24h)
   ↓
4. Return { token: "jwt...", user: { id, email, name } }
   ↓
5. Frontend stores token in localStorage
   ↓
6. All future requests include: Authorization: Bearer {token}
   ↓
7. Backend middleware validates JWT on protected routes
```

### JWT Structure
```javascript
{
  "sub": 123,           // userId
  "email": "user@example.com",
  "iat": 1708000000,    // issued at
  "exp": 1708086400     // expires (24h later)
}
```

### Protected Routes Middleware
```javascript
// routes/persons.js
router.get('/persons', authenticate, async (req, res) => {
  // req.user = { sub: 123, email: "..." }
  // ... fetch and return data
});

// Admin-only routes
router.post('/admin/persons', authenticate, authorize('admin'), async (req, res) => {
  // Only users with is_admin = true can create
});
```

### Password Security
- Minimum 8 characters
- Stored as bcrypt hash (cost factor 10)
- Never returned in API responses
- Reset flow: (future) email verification

---

## Deployment with Docker Compose

### docker-compose.yml Structure

```yaml
version: '3.8'

services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: brimfrost_user
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: brimfrost
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/db/schema.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U brimfrost_user"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    build:
      context: ./
      dockerfile: ./backend/Dockerfile
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://brimfrost_user:${DB_PASSWORD}@db:5432/brimfrost
      JWT_SECRET: ${JWT_SECRET}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: npm start

  frontend:
    build:
      context: ./frontend
      dockerfile: ../docker/frontend.Dockerfile
    environment:
      VITE_API_URL: http://localhost:3000/api
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:

networks:
  default:
    name: brimfrost_network
```

### Environment Variables (.env)
```
# Database
DB_PASSWORD=secure_random_password_here
DATABASE_URL=postgresql://brimfrost_user:${DB_PASSWORD}@db:5432/brimfrost

# JWT
JWT_SECRET=another_secure_random_key_here
JWT_EXPIRES_IN=24h

# Frontend
VITE_API_URL=http://localhost:3000/api

# Backend
NODE_ENV=development
PORT=3000
LOG_LEVEL=info
```

### Build & Run
```bash
# Development
docker-compose up

# Production
docker-compose -f docker-compose.yml up -d

# View logs
docker-compose logs -f backend
docker-compose logs -f db

# Seed test data
docker-compose exec backend npm run seed

# Access database
docker-compose exec db psql -U brimfrost_user -d brimfrost
```

### Data Persistence
- PostgreSQL data stored in named volume `postgres_data`
- Survives container restarts
- Backup: `docker run --rm -v postgres_data:/data -v $(pwd):/backup postgres:16 tar czf /backup/db-backup.tar.gz -C /data .`

---

## Development Environment

### Local Development (Without Docker)

```bash
# Terminal 1: Database
docker run -d \
  -e POSTGRES_USER=brimfrost_user \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=brimfrost \
  -p 5432:5432 \
  postgres:16

# Terminal 2: Backend
cd backend
npm install
export DATABASE_URL="postgresql://brimfrost_user:dev_password@localhost:5432/brimfrost"
export JWT_SECRET="dev_secret_key"
npm run dev       # Uses nodemon for auto-reload

# Terminal 3: Frontend
cd frontend
npm install
npm run dev       # Vite dev server (HMR enabled)
```

### IDE Setup

**VS Code**
```json
{
  "extensions": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.rest-client",
    "ckolkmann.vscode-postgres"
  ]
}
```

### Code Style

**Prettier config**
```json
{
  "semi": true,
  "singleQuote": true,
  "trailing-comma": "es5",
  "printWidth": 100
}
```

**ESLint**
```json
{
  "env": {
    "node": true,
    "browser": true,
    "es2021": true
  },
  "extends": ["eslint:recommended"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  }
}
```

---

## Roadmap

### MVP (Phase 1-4)
- ✅ Backend API with auth
- ✅ PostgreSQL schema
- ✅ Frontend with family tree (migrated)
- ✅ Docker Compose setup

### v2.1 (Phase 5)
- Admin interface for data management
- Media upload (S3 or local storage)
- Export to PDF

### v2.2
- OAuth2 (Google/GitHub login)
- Role-based access control (RBAC)
- Activity logging
- Full-text search improvements

### Future
- Mobile app (React Native)
- Machine learning for relationship suggestions
- Graph analytics dashboard
- Historical timeline view

---

## References

- Express.js: https://expressjs.com/
- PostgreSQL Docs: https://www.postgresql.org/docs/
- Vite: https://vitejs.dev/
- JWT: https://jwt.io/
- Docker Compose: https://docs.docker.com/compose/
- bcryptjs: https://github.com/dcodeIO/bcrypt.js
- family-chart: https://github.com/max-davidson/family-chart/
- d3: https://d3js.org/

