# Production Dockerfile for Backend
FROM node:18-alpine

WORKDIR /app

# Install production dependencies only
COPY backend/package*.json ./
RUN npm install --omit=dev

# Copy backend code
COPY backend/ ./

EXPOSE 3000

CMD ["node", "server.js"]
