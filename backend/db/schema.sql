-- ============================================================================
-- Brimfrost v2 - Database Schema
-- PostgreSQL 16
-- ============================================================================

-- Create extension for UUID (if needed)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Users Table - Authentication
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users (email);

-- ============================================================================
-- Persons Table - Family Members
-- ============================================================================
CREATE TABLE IF NOT EXISTS persons (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  bio TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  photo_url VARCHAR(1024),
  gender VARCHAR(20),
  social_links JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_persons_name ON persons (name);
CREATE INDEX idx_persons_birth_year ON persons (birth_year);

-- ============================================================================
-- Relationships Table - Family Connections
-- ============================================================================
CREATE TABLE IF NOT EXISTS relationships (
  id SERIAL PRIMARY KEY,
  person_a_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  person_b_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  relation_type VARCHAR(50) NOT NULL,
  started_year INTEGER,
  ended_year INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_relationships_person_a ON relationships (person_a_id);
CREATE INDEX idx_relationships_person_b ON relationships (person_b_id);
CREATE INDEX idx_relationships_type ON relationships (relation_type);

-- ============================================================================
-- Locations Table - Places
-- ============================================================================
CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  country VARCHAR(100),
  region VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_locations_name ON locations (name);

-- ============================================================================
-- Person_Locations Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS person_locations (
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, location_id)
);

CREATE INDEX idx_person_locations_location ON person_locations (location_id);

-- ============================================================================
-- Tags Table - Metadata Tags
-- ============================================================================
CREATE TABLE IF NOT EXISTS tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) UNIQUE NOT NULL,
  color VARCHAR(7),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tags_name ON tags (name);

-- ============================================================================
-- Person_Tags Junction Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS person_tags (
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (person_id, tag_id)
);

CREATE INDEX idx_person_tags_tag ON person_tags (tag_id);

-- ============================================================================
-- Media Table - Photos, Videos, Files
-- ============================================================================
CREATE TABLE IF NOT EXISTS media (
  id SERIAL PRIMARY KEY,
  person_id INTEGER NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  url VARCHAR(1024) NOT NULL,
  title VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_person ON media (person_id);
CREATE INDEX idx_media_type ON media (type);

-- ============================================================================
-- End of Schema
-- ============================================================================
