import pool from '../config/database.js';
import bcryptjs from 'bcryptjs';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Parse the freeform birthday field from Firebase into birth_year / death_year.
 * Examples:
 *   "1964 - 2008"       → { birth_year: 1964, death_year: 2008 }
 *   "† 2016 — Östersund" → { death_year: 2016 }
 *   "2005–2009 †"       → { birth_year: 2005, death_year: 2009 }
 *   "1941"              → { birth_year: 1941 }
 *   "39 — Norrköping"   → {} (age, not year)
 *   "15"                → {} (age)
 *   ""                  → {}
 */
function parseBirthday(birthday) {
  if (!birthday || !birthday.trim()) return {};

  const result = {};
  const s = birthday.trim();

  // "2005–2009 †" or "1964 - 2008"
  const rangeMatch = s.match(/(\d{4})\s*[\-–—]\s*(\d{4})/);
  if (rangeMatch) {
    result.birth_year = parseInt(rangeMatch[1], 10);
    result.death_year = parseInt(rangeMatch[2], 10);
    return result;
  }

  // "† 2016 — Östersund" or "† 2016"
  const deathMatch = s.match(/†\s*(\d{4})/);
  if (deathMatch) {
    result.death_year = parseInt(deathMatch[1], 10);
    return result;
  }

  // Plain 4-digit year like "1941" or "1935"
  const yearMatch = s.match(/^(\d{4})$/);
  if (yearMatch) {
    result.birth_year = parseInt(yearMatch[1], 10);
    return result;
  }

  // Everything else (ages like "39", "15", "33 — Seoul") — skip
  return result;
}

async function seed() {
  const client = await pool.connect();

  try {
    console.log('🌱 Importing Firebase data into Brimfrost v2 database...\n');

    // Read the Firebase JSON export (copied into backend/db/)
    const jsonPath = resolve(__dirname, 'firebase-export.json');
    const raw = readFileSync(jsonPath, 'utf-8');
    const firebaseData = JSON.parse(raw);
    console.log(`📦 Loaded ${firebaseData.length} entries from Firebase export`);

    // Filter out empty placeholders and to_add entries
    const people = firebaseData.filter(p => {
      // Skip to_add placeholder entries (UUID-style IDs with minimal data)
      if (p.to_add) return false;
      // Skip entries with no first name AND no last name AND no meaningful rels
      const firstName = p.data?.['first name'] || '';
      const lastName = p.data?.['last name'] || '';
      if (!firstName && !lastName) {
        const rels = p.rels || {};
        const hasRels = rels.father || rels.mother ||
          (rels.spouses && rels.spouses.length > 0) ||
          (rels.children && rels.children.length > 0);
        if (!hasRels) return false;
      }
      return true;
    });

    console.log(`✅ ${people.length} valid people after filtering (skipped ${firebaseData.length - people.length} empty/placeholder entries)\n`);

    await client.query('BEGIN');

    // ── Clear existing data (in dependency order) ──
    console.log('🗑️  Clearing existing data...');
    await client.query('DELETE FROM media');
    await client.query('DELETE FROM person_tags');
    await client.query('DELETE FROM person_locations');
    await client.query('DELETE FROM relationships');
    await client.query('DELETE FROM tags');
    await client.query('DELETE FROM locations');
    await client.query('DELETE FROM persons');
    // Reset sequences
    await client.query("ALTER SEQUENCE persons_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE tags_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE locations_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE media_id_seq RESTART WITH 1");
    await client.query("ALTER SEQUENCE relationships_id_seq RESTART WITH 1");

    // ── Ensure test user exists ──
    const password_hash = await bcryptjs.hash('test123', 10);
    await client.query(
      `INSERT INTO users (email, password_hash, name, is_admin)
       VALUES ('test@example.com', $1, 'Test User', true)
       ON CONFLICT (email) DO NOTHING`,
      [password_hash]
    );

    // ── Insert persons ──
    // Map: firebase_id → postgres_id
    const idMap = new Map();

    for (const p of people) {
      const firstName = p.data?.['first name'] || '';
      const lastName = p.data?.['last name'] || '';
      const name = [firstName, lastName].filter(Boolean).join(' ') || `Unknown (${p.id})`;
      const bio = p.data?.bio || '';
      const gender = p.data?.gender || null;
      const avatar = p.data?.avatar || null;
      const { birth_year, death_year } = parseBirthday(p.data?.birthday || '');
      const social = p.data?.social || {};

      const res = await client.query(
        `INSERT INTO persons (name, bio, birth_year, death_year, photo_url, gender, social_links)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [name, bio || null, birth_year || null, death_year || null, avatar, gender, JSON.stringify(social)]
      );

      idMap.set(p.id, res.rows[0].id);
    }
    console.log(`✅ Inserted ${idMap.size} persons`);

    // ── Insert relationships ──
    // Use father/mother from each person + deduplicated spouse pairs
    const relCount = { parent: 0, spouse: 0 };
    const seenSpousePairs = new Set();

    for (const p of people) {
      const myId = idMap.get(p.id);
      if (!myId) continue;
      const rels = p.rels || {};

      // Father → child relationship
      if (rels.father && idMap.has(rels.father)) {
        await client.query(
          `INSERT INTO relationships (person_a_id, person_b_id, relation_type)
           VALUES ($1, $2, 'father')`,
          [idMap.get(rels.father), myId]
        );
        relCount.parent++;
      }

      // Mother → child relationship
      if (rels.mother && idMap.has(rels.mother)) {
        await client.query(
          `INSERT INTO relationships (person_a_id, person_b_id, relation_type)
           VALUES ($1, $2, 'mother')`,
          [idMap.get(rels.mother), myId]
        );
        relCount.parent++;
      }

      // Spouse relationships (deduplicate)
      if (rels.spouses && Array.isArray(rels.spouses)) {
        for (const spouseFirebaseId of rels.spouses) {
          if (!idMap.has(spouseFirebaseId)) continue;
          const pairKey = [p.id, spouseFirebaseId].sort().join('|');
          if (seenSpousePairs.has(pairKey)) continue;
          seenSpousePairs.add(pairKey);

          await client.query(
            `INSERT INTO relationships (person_a_id, person_b_id, relation_type)
             VALUES ($1, $2, 'spouse')`,
            [myId, idMap.get(spouseFirebaseId)]
          );
          relCount.spouse++;
        }
      }
    }
    console.log(`✅ Inserted ${relCount.parent} parent + ${relCount.spouse} spouse relationships`);

    // ── Insert tags ──
    const tagNameToId = new Map();

    async function getOrCreateTag(tagName) {
      if (tagNameToId.has(tagName)) return tagNameToId.get(tagName);
      const res = await client.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tagName]
      );
      tagNameToId.set(tagName, res.rows[0].id);
      return res.rows[0].id;
    }

    let tagLinkCount = 0;
    for (const p of people) {
      const myId = idMap.get(p.id);
      const tags = p.data?.tags || [];
      for (const tag of tags) {
        if (!tag || typeof tag !== 'string') continue;
        const tagId = await getOrCreateTag(tag);
        await client.query(
          `INSERT INTO person_tags (person_id, tag_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [myId, tagId]
        );
        tagLinkCount++;
      }
    }
    console.log(`✅ Created ${tagNameToId.size} tags with ${tagLinkCount} person-tag links`);

    // ── Insert locations ──
    const locNameToId = new Map();

    async function getOrCreateLocation(locName) {
      const normalized = locName.charAt(0).toUpperCase() + locName.slice(1);
      if (locNameToId.has(normalized)) return locNameToId.get(normalized);
      const res = await client.query(
        `INSERT INTO locations (name) VALUES ($1)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [normalized]
      );
      if (res.rows.length > 0) {
        locNameToId.set(normalized, res.rows[0].id);
        return res.rows[0].id;
      }
      // Already exists (shouldn't happen after clear, but just in case)
      const existing = await client.query('SELECT id FROM locations WHERE name = $1', [normalized]);
      locNameToId.set(normalized, existing.rows[0].id);
      return existing.rows[0].id;
    }

    let locLinkCount = 0;
    for (const p of people) {
      const myId = idMap.get(p.id);
      const locations = p.data?.locations || [];
      for (const loc of locations) {
        if (!loc || typeof loc !== 'string') continue;
        const locId = await getOrCreateLocation(loc);
        await client.query(
          `INSERT INTO person_locations (person_id, location_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [myId, locId]
        );
        locLinkCount++;
      }
    }
    console.log(`✅ Created ${locNameToId.size} locations with ${locLinkCount} person-location links`);

    // ── Insert media (photos, videos, files) ──
    let mediaCount = { photos: 0, videos: 0, files: 0 };

    for (const p of people) {
      const myId = idMap.get(p.id);
      const media = p.data?.media || {};

      // Photos
      if (media.photos && Array.isArray(media.photos)) {
        for (const url of media.photos) {
          if (!url) continue;
          const photoUrl = typeof url === 'string' ? url : url.url;
          if (!photoUrl) continue;
          await client.query(
            `INSERT INTO media (person_id, type, url) VALUES ($1, 'photo', $2)`,
            [myId, photoUrl]
          );
          mediaCount.photos++;
        }
      }

      // Videos
      if (media.videos && Array.isArray(media.videos)) {
        for (const url of media.videos) {
          if (!url) continue;
          const videoUrl = typeof url === 'string' ? url : url.url;
          if (!videoUrl) continue;
          await client.query(
            `INSERT INTO media (person_id, type, url) VALUES ($1, 'video', $2)`,
            [myId, videoUrl]
          );
          mediaCount.videos++;
        }
      }

      // Files
      if (media.files && Array.isArray(media.files)) {
        for (const item of media.files) {
          if (!item) continue;
          const fileUrl = typeof item === 'string' ? item : item.url;
          if (!fileUrl) continue;
          await client.query(
            `INSERT INTO media (person_id, type, url) VALUES ($1, 'file', $2)`,
            [myId, fileUrl]
          );
          mediaCount.files++;
        }
      }
    }
    console.log(`✅ Inserted media: ${mediaCount.photos} photos, ${mediaCount.videos} videos, ${mediaCount.files} files`);

    await client.query('COMMIT');

    // ── Summary ──
    console.log('\n────────────────────────────────────────');
    console.log('🎉 Firebase import complete!');
    console.log('────────────────────────────────────────');
    console.log(`  Persons:       ${idMap.size}`);
    console.log(`  Relationships: ${relCount.parent + relCount.spouse}`);
    console.log(`  Tags:          ${tagNameToId.size}`);
    console.log(`  Locations:     ${locNameToId.size}`);
    console.log(`  Media:         ${mediaCount.photos + mediaCount.videos + mediaCount.files}`);
    console.log('────────────────────────────────────────');
    console.log('  Login: test@example.com / test123');
    console.log('────────────────────────────────────────\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Import failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
