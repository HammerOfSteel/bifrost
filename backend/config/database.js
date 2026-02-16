// Database connection configuration
import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://brimfrost_user:brimfrost_pass@localhost:5432/brimfrost',
  // Connection pool settings
  max: 20,                // Max clients in pool
  idleTimeoutMillis: 30000, // How long a client sits idle in pool
  connectionTimeoutMillis: 2000, // Connection timeout
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default pool;
