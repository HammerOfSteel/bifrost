import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import personRoutes from './routes/persons.js';
import adminRoutes from './routes/admin.js';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// Middleware
// ============================================================================
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Request logging
app.use(cors({ // CORS
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json()); // Body parser
app.use(express.urlencoded({ extended: true }));

// ============================================================================
// Health Check
// ============================================================================
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// API Routes
// ============================================================================
app.use('/api/auth', authRoutes);
app.use('/api/persons', personRoutes);
app.use('/api/admin', adminRoutes);

// ============================================================================
// Error Handling
// ============================================================================
app.use(notFound);
app.use(errorHandler);

// ============================================================================
// Start Server
// ============================================================================
app.listen(PORT, () => {
  console.log(`
╭────────────────────────────────────────────────────╮
│  🧊 Brimfrost v2 Backend                           │
│  Server running on http://localhost:${PORT}        │
│  Environment: ${process.env.NODE_ENV || 'development'}    │
│  Database: ${process.env.DATABASE_URL ? 'Connected' : 'NOT CONFIGURED'}    │
╰────────────────────────────────────────────────────╯
  `);
});

export default app;
