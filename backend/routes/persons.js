import express from 'express';
import { authenticate } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * GET /api/persons
 * Get all family members with their relationships
 */
router.get('/', authenticate, async (req, res) => {
  try {
    // Get all persons (including social_links)
    const personResult = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.bio,
        p.photo_url,
        p.birth_year,
        p.death_year,
        p.gender,
        p.social_links,
        p.created_at,
        p.updated_at
      FROM persons p
      ORDER BY p.name ASC
    `);
    
    const persons = personResult.rows;
    
    // Get all relationships
    const relResult = await pool.query(`
      SELECT 
        person_a_id,
        person_b_id,
        relation_type,
        started_year,
        ended_year
      FROM relationships
    `);

    // Get all tags for all persons
    const tagResult = await pool.query(`
      SELECT pt.person_id, t.id, t.name, t.color
      FROM person_tags pt
      JOIN tags t ON pt.tag_id = t.id
    `);

    // Get all locations for all persons
    const locResult = await pool.query(`
      SELECT pl.person_id, l.id, l.name, l.country, l.region
      FROM person_locations pl
      JOIN locations l ON pl.location_id = l.id
    `);

    // Get all media for all persons
    const mediaResult = await pool.query(`
      SELECT id, person_id, type, url, title, description
      FROM media
    `);
    
    // Add relationships to each person
    const personMap = {};
    persons.forEach(p => {
      personMap[p.id] = p;
      p.relationships = [];
      p.tags = [];
      p.locations = [];
      p.media = [];
    });

    // Tags
    tagResult.rows.forEach(row => {
      if (personMap[row.person_id]) {
        personMap[row.person_id].tags.push({ id: row.id, name: row.name, color: row.color });
      }
    });

    // Locations
    locResult.rows.forEach(row => {
      if (personMap[row.person_id]) {
        personMap[row.person_id].locations.push({ id: row.id, name: row.name, country: row.country, region: row.region });
      }
    });

    // Media
    mediaResult.rows.forEach(row => {
      if (personMap[row.person_id]) {
        personMap[row.person_id].media.push({ id: row.id, type: row.type, url: row.url, title: row.title, description: row.description });
      }
    });
    
    relResult.rows.forEach(rel => {
      // Add relationship in both directions for easier processing
      if (personMap[rel.person_a_id]) {
        personMap[rel.person_a_id].relationships.push({
          person_a_id: rel.person_a_id,
          person_b_id: rel.person_b_id,
          related_person_id: rel.person_b_id,
          relation_type: rel.relation_type,
          started_year: rel.started_year,
          ended_year: rel.ended_year
        });
      }
      if (personMap[rel.person_b_id]) {
        personMap[rel.person_b_id].relationships.push({
          person_a_id: rel.person_a_id,
          person_b_id: rel.person_b_id,
          related_person_id: rel.person_a_id,
          relation_type: rel.relation_type,
          started_year: rel.started_year,
          ended_year: rel.ended_year
        });
      }
    });
    
    res.json({
      success: true,
      data: persons
    });
  } catch (error) {
    console.error('Error fetching persons:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/persons/search?q=query
 * Full-text search in persons and tags - MUST COME BEFORE /:id
 */
router.get('/search', authenticate, async (req, res) => {
  try {
    const q = req.query.q || '';
    
    if (q.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }
    
    const searchTerm = `%${q}%`;
    
    const result = await pool.query(`
      SELECT DISTINCT
        p.id,
        p.name,
        p.bio,
        p.photo_url,
        'name' as match_type
      FROM persons p
      WHERE p.name ILIKE $1 OR p.bio ILIKE $1
      
      UNION
      
      SELECT DISTINCT
        p.id,
        p.name,
        p.bio,
        p.photo_url,
        'tag' as match_type
      FROM persons p
      JOIN person_tags pt ON p.id = pt.person_id
      JOIN tags t ON pt.tag_id = t.id
      WHERE t.name ILIKE $1
      
      UNION
      
      SELECT DISTINCT
        p.id,
        p.name,
        p.bio,
        p.photo_url,
        'location' as match_type
      FROM persons p
      JOIN person_locations pl ON p.id = pl.person_id
      JOIN locations l ON pl.location_id = l.id
      WHERE l.name ILIKE $1
      
      LIMIT 50
    `, [searchTerm]);
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/persons/:id
 * Get single person with relationships and media
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get person details
    const personResult = await pool.query(
      'SELECT * FROM persons WHERE id = $1',
      [id]
    );
    
    if (personResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Person with ID ${id} not found`
      });
    }
    
    const person = personResult.rows[0];
    
    // Get relationships
    const relResult = await pool.query(`
      SELECT 
        CASE 
          WHEN person_a_id = $1 THEN person_b_id
          ELSE person_a_id
        END as related_person_id,
        relation_type,
        started_year,
        ended_year
      FROM relationships
      WHERE person_a_id = $1 OR person_b_id = $1
    `, [id]);
    
    // Get media
    const mediaResult = await pool.query(
      'SELECT id, type, url, title, description FROM media WHERE person_id = $1',
      [id]
    );
    
    // Get locations
    const locResult = await pool.query(`
      SELECT l.* FROM locations l
      JOIN person_locations pl ON l.id = pl.location_id
      WHERE pl.person_id = $1
    `, [id]);
    
    // Get tags
    const tagResult = await pool.query(`
      SELECT t.* FROM tags t
      JOIN person_tags pt ON t.id = pt.tag_id
      WHERE pt.person_id = $1
    `, [id]);
    
    res.json({
      success: true,
      data: {
        ...person,
        relationships: relResult.rows,
        media: mediaResult.rows,
        locations: locResult.rows,
        tags: tagResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching person:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/persons/:id/media
 * Get media for a person
 */
router.get('/:id/media', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM media WHERE person_id = $1 ORDER BY id DESC',
      [id]
    );
    
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({
      success: false,
      error: 'QUERY_ERROR',
      message: error.message
    });
  }
});

export default router;
