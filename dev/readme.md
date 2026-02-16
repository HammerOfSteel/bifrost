# Brimfrost v2 Development

## About This Folder

This `/dev` folder contains planning documents, progress tracking, and architecture notes for the **Brimfrost v2 rewrite** - a modern, self-hosted version of the family tree application.

## Files in This Directory

- **overview.md** - Project goals, current state, proposed tech stack, implementation phases
- **architecture.md** - Detailed technical architecture, database schema, API design
- **PROGRESS.md** - Implementation checklist and progress tracking
- **readme.md** - This file

## Getting Started

### Reading Order
1. Start here (readme.md)
2. Read [overview.md](./overview.md) - understand goals and tech stack
3. Read [architecture.md](./architecture.md) - detailed design decisions
4. Check [PROGRESS.md](./PROGRESS.md) - see what's been implemented

### Development

Once implementation starts:

```bash
# Navigate to the implementation folder
cd ../brimfrost-v2

# Install dependencies
npm install

# Start the compose stack
docker-compose up -d

# Seed the database
npm run seed

# Start development
npm run dev
```

## Key Decisions

### Why Docker Compose?
- One command to run entire stack (frontend, backend, database)
- No cloud dependency - fully self-hosted
- Easy to spin up identical environments locally and in production
- All services on isolated internal network

### Why PostgreSQL?
- Robust SQL database perfect for relational data (family relationships)
- Rich data types and extensions (JSONB for flexible metadata)
- Easy to set up in Docker

### Why Keep d3 + family-chart?
- Already well-implemented and working
- Significant time investment made
- Modern build tools (Vite) can easily serve these libraries
- JavaScript → TypeScript migration is optional later

### Why JWT + Local Auth?
- No third-party cloud provider needed
- Simple to understand and implement
- Passwords stored with bcrypt (industry standard)
- Can extend to OAuth later if needed

## Tech Stack Quick Reference

| Layer | Tech | Purpose |
|-------|------|---------|
| Frontend | Vite + Vanilla JS | Build tool + d3/family-chart visualization |
| Backend | Express.js | API server |
| Database | PostgreSQL 16 | Family data + user credentials |
| Auth | JWT + bcrypt | Stateless authentication |
| Ops | Docker Compose | Local development & deployment |

## Common Commands (When Implemented)

```bash
# Build & spin up everything
docker-compose up --build

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Connect to database
docker-compose exec db psql -U brimfrost_user -d brimfrost

# Stop everything
docker-compose down

# Seed test data
docker-compose exec backend npm run seed

# Run tests
npm run test:backend
npm run test:frontend
```

## Development Workflow

1. **Backend changes**: Auto-reload via `nodemon` (in Docker)
2. **Frontend changes**: HMR (hot module reload) via Vite
3. **Database changes**: Update schema file, re-seed if needed
4. **Environment vars**: Edit `.env` or `.env.local`

## Important Files to Know (When Created)

- `brimfrost-v2/docker-compose.yml` - All services configuration
- `brimfrost-v2/.env.example` - Environment variable template
- `brimfrost-v2/backend/server.js` - Express.js entry point
- `brimfrost-v2/frontend/src/main.js` - Vite entry point
- `brimfrost-v2/backend/db/schema.sql` - Database schema
- `brimfrost-v2/backend/db/seed.js` - Test data

## Troubleshooting

### Ports conflict
If ports 3000, 5000, or 5432 are already in use:
- Edit `docker-compose.yml` to change port mappings
- Or stop other services: `docker-compose down`

### Database won't start
```bash
docker-compose down -v        # Remove volumes
docker-compose up db          # Start fresh
```

### Frontend build fails
```bash
rm -rf brimfrost-v2/frontend/node_modules
npm install --prefix brimfrost-v2/frontend
npm run build --prefix brimfrost-v2/frontend
```

## Next Steps

1. Review [overview.md](./overview.md) for project context
2. Review [architecture.md](./architecture.md) for technical details
3. Flag any questions or concerns
4. Begin Phase 1: Backend setup and Docker Compose

---

**Status**: Planning phase ✈️  
**Last updated**: $(date)  
**Version**: v2.0 (in development)
