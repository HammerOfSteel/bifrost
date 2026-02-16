import express from 'express';
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

export default router;
