# Dockerfile for Node.js Backend
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY backend/package*.json ./
RUN npm install --production

# Install dev dependencies
RUN npm install --save-dev nodemon

# Copy backend code
COPY backend/ ./

# Expose port
EXPOSE 3000

# Start development server
CMD ["npm", "run", "dev"]
