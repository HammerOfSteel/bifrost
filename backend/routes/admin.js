import express from 'express';
import bcryptjs from 'bcryptjs';
import { authenticate, authorize } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * POST /api/admin/persons
 * Create a new person (admin only)
 */
router.post('/persons', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, bio, birth_year, death_year, photo_url, gender } = req.body;
    
    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Name is required'
      });
    }
    
    const result = await pool.query(
      `INSERT INTO persons (name, bio, birth_year, death_year, photo_url, gender)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, bio, birth_year, death_year, photo_url, gender]
    );
    
    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating person:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

/**
 * PATCH /api/admin/persons/:id
 * Update a person (admin only)
 */
router.patch('/persons/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, bio, birth_year, death_year, photo_url, gender } = req.body;
    
    const updates = [];
    const values = [];
    let paramIndex = 1;
    
    if (name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (bio !== undefined) {
      updates.push(`bio = $${paramIndex++}`);
      values.push(bio);
    }
    if (birth_year !== undefined) {
      updates.push(`birth_year = $${paramIndex++}`);
      values.push(birth_year);
    }
    if (death_year !== undefined) {
      updates.push(`death_year = $${paramIndex++}`);
      values.push(death_year);
    }
    if (photo_url !== undefined) {
      updates.push(`photo_url = $${paramIndex++}`);
      values.push(photo_url);
    }
    if (gender !== undefined) {
      updates.push(`gender = $${paramIndex++}`);
      values.push(gender);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'No fields to update'
      });
    }
    
    values.push(id);
    
    const query = `UPDATE persons SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Person with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating person:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

/**
 * DELETE /api/admin/persons/:id
 * Delete a person (admin only)
 */
router.delete('/persons/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM persons WHERE id = $1',
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Person with ID ${id} not found`
      });
    }
    
    res.json({
      success: true,
      data: { deleted: true, id }
    });
  } catch (error) {
    console.error('Error deleting person:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

// ============================================================================
// RELATIONSHIP MANAGEMENT
// ============================================================================

/**
 * POST /api/admin/relationships
 * Create a relationship between two persons
 */
router.post('/relationships', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { person_a_id, person_b_id, relation_type, started_year, ended_year } = req.body;
    if (!person_a_id || !person_b_id || !relation_type) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'person_a_id, person_b_id, and relation_type are required' });
    }
    const result = await pool.query(
      'INSERT INTO relationships (person_a_id, person_b_id, relation_type, started_year, ended_year) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [person_a_id, person_b_id, relation_type, started_year || null, ended_year || null]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating relationship:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * DELETE /api/admin/relationships/:id
 * Delete a relationship
 */
router.delete('/relationships/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM relationships WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Relationship not found' });
    }
    res.json({ success: true, data: { deleted: true, id } });
  } catch (error) {
    console.error('Error deleting relationship:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * GET /api/admin/relationships
 * Get all relationships
 */
router.get('/relationships', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
        pa.name as person_a_name, 
        pb.name as person_b_name 
      FROM relationships r
      LEFT JOIN persons pa ON r.person_a_id = pa.id
      LEFT JOIN persons pb ON r.person_b_id = pb.id
      ORDER BY r.id
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching relationships:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

// ============================================================================
// USER MANAGEMENT (admin only)
// ============================================================================

/**
 * GET /api/admin/users
 * List all users
 */
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name, is_admin, created_at, updated_at FROM users ORDER BY id'
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { email, password, name, is_admin } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'Email, password, and name are required' });
    }
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'USER_EXISTS', message: 'A user with this email already exists' });
    }
    const password_hash = await bcryptjs.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash, name, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, email, name, is_admin, created_at',
      [email.toLowerCase(), password_hash, name, is_admin || false]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Update a user (name, email, is_admin, password)
 */
router.patch('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, is_admin } = req.body;
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email !== undefined) { updates.push(`email = $${paramIndex++}`); values.push(email.toLowerCase()); }
    if (name !== undefined) { updates.push(`name = $${paramIndex++}`); values.push(name); }
    if (is_admin !== undefined) { updates.push(`is_admin = $${paramIndex++}`); values.push(is_admin); }
    if (password) {
      const hash = await bcryptjs.hash(password, 10);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(hash);
    }
    if (updates.length === 0) {
      return res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: 'No fields to update' });
    }
    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, name, is_admin, created_at, updated_at`;
    const result = await pool.query(query, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete a user
 */
router.delete('/users/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    // Prevent deleting yourself
    if (parseInt(id) === req.user.sub) {
      return res.status(400).json({ success: false, error: 'SELF_DELETE', message: 'You cannot delete your own account' });
    }
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'User not found' });
    }
    res.json({ success: true, data: { deleted: true, id } });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

/**
 * GET /api/admin/stats
 * Dashboard stats
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
  try {
    const [persons, rels, users, tags, locations, media] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM persons'),
      pool.query('SELECT COUNT(*) FROM relationships'),
      pool.query('SELECT COUNT(*) FROM users'),
      pool.query('SELECT COUNT(*) FROM tags'),
      pool.query('SELECT COUNT(*) FROM locations'),
      pool.query('SELECT COUNT(*) FROM media'),
    ]);
    res.json({
      success: true,
      data: {
        persons: parseInt(persons.rows[0].count),
        relationships: parseInt(rels.rows[0].count),
        users: parseInt(users.rows[0].count),
        tags: parseInt(tags.rows[0].count),
        locations: parseInt(locations.rows[0].count),
        media: parseInt(media.rows[0].count),
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: 'QUERY_ERROR', message: error.message });
  }
});

export default router;
