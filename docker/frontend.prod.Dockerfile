# Production Dockerfile for Frontend (context: project root)
# Stage 1: Build static files
FROM node:18-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./

# Set the API URL to use relative path (will be proxied by nginx)
ENV VITE_API_URL=/api

RUN npm run build

# Stage 2: Serve with nginx
FROM nginx:alpine

# Copy built static files
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY docker/nginx-frontend.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
