import pool from '../config/database.js';
import bcryptjs from 'bcryptjs';

async function seed() {
  try {
    console.log('🌱 Seeding database with old Brimfrost data...');
    
    // Create test user
    const saltRounds = 10;
    const password_hash = await bcryptjs.hash('test123', saltRounds);
    
    const userResult = await pool.query(
      `INSERT INTO users (email, password_hash, name, is_admin)
       VALUES ('test@example.com', $1, 'Test User', true)
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [password_hash]
    );
    
    console.log('✅ User created:', userResult.rows[0]);
    
    // Create test persons - from old Brimfrost project
    const persons = [
      // Grandparents
      { name: 'Bengt Eneborg', bio: '', birth_year: null, gender: 'M' },
      { name: 'Åsa Eneborg', bio: '', birth_year: null, gender: 'F' },
      { name: 'Jan Stålhammar', bio: '', birth_year: null, gender: 'M' },
      { name: 'Anita Stålhammar', bio: '', birth_year: null, gender: 'F' },
      
      // Parents generation
      { name: 'Ingrid Eneborg', bio: 'Älskad mamma. Äldre syster: Karin (Sundsvall). Äldre bror: Åke (Manchester).', birth_year: null, gender: 'F' },
      { name: 'Hendrik Stålhammar', bio: 'Pappa. Bror: Per Stålhammar (Stockholm).', birth_year: 1964, death_year: 2008, gender: 'M' },
      { name: 'Karin Berg Klawing', bio: 'Äldre syster till Ingrid (Ninni).', birth_year: null, gender: 'F' },
      { name: 'Åke Eneborg', bio: 'Äldre bror till Ingrid (Ninni).', birth_year: null, gender: 'M' },
      { name: 'Per Stålhammar', bio: 'Bror till Hendrik.', birth_year: null, gender: 'M' },
      
      // Main generation
      { name: 'Sofia Stålhammar', bio: 'Lärare i Norrköping.', birth_year: 1985, gender: 'F' },
      { name: 'Eric Stålhammar', bio: 'Utvecklare och storyteller i Östersund.', birth_year: 1988, gender: 'M' },
      { name: 'Rebecka Stålhammar', bio: 'Illustratör och lärare i Seoul.', birth_year: 1991, gender: 'F' },
      
      // Spouses
      { name: 'Mathias Jansson', bio: '', birth_year: null, gender: 'M' },
      { name: 'Adam', bio: '', birth_year: null, gender: 'M' },
      { name: 'Mingyu Lee', bio: '', birth_year: null, gender: 'M' },
      { name: 'Haeji Moon', bio: '', birth_year: null, gender: 'F' },
      { name: 'Emma Olsson', bio: '', birth_year: null, gender: 'F' },
      { name: 'Nicole', bio: '', birth_year: null, gender: 'F' },
      
      // Children
      { name: 'Juni', bio: '', birth_year: 2009, gender: 'F' },
      { name: 'Clara', bio: '', birth_year: 2014, gender: 'F' },
      { name: 'Rasmus Oliver Stålhammar', bio: '', birth_year: 2005, gender: 'M' },
      { name: 'Tima Elara Stålhammar', bio: 'Daffodil.', birth_year: 2006, death_year: 2009, gender: 'F' },
    ];
    
    for (const person of persons) {
      await pool.query(
        `INSERT INTO persons (name, bio, birth_year, gender)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [person.name, person.bio, person.birth_year, person.gender]
      );
    }
    
    console.log('✅ Persons created:', persons.length);
    
    // Get person IDs for reference in relationships
    const personResult = await pool.query('SELECT id, name FROM persons ORDER BY id');
    const personMap = {};
    personResult.rows.forEach(p => {
      personMap[p.name] = p.id;
    });
    
    // Create test relationships - from old Brimfrost project
    const relationships = [
      // Grandparent generation
      { person_a: 'Bengt Eneborg', person_b: 'Åsa Eneborg', type: 'spouse' },
      { person_a: 'Jan Stålhammar', person_b: 'Anita Stålhammar', type: 'spouse' },
      
      // Parent generation - Ingrid's family
      { person_a: 'Bengt Eneborg', person_b: 'Ingrid Eneborg', type: 'father' },
      { person_a: 'Åsa Eneborg', person_b: 'Ingrid Eneborg', type: 'mother' },
      { person_a: 'Bengt Eneborg', person_b: 'Karin Berg Klawing', type: 'father' },
      { person_a: 'Åsa Eneborg', person_b: 'Karin Berg Klawing', type: 'mother' },
      { person_a: 'Bengt Eneborg', person_b: 'Åke Eneborg', type: 'father' },
      { person_a: 'Åsa Eneborg', person_b: 'Åke Eneborg', type: 'mother' },
      
      // Parent generation - Hendrik's family
      { person_a: 'Jan Stålhammar', person_b: 'Hendrik Stålhammar', type: 'father' },
      { person_a: 'Anita Stålhammar', person_b: 'Hendrik Stålhammar', type: 'mother' },
      { person_a: 'Jan Stålhammar', person_b: 'Per Stålhammar', type: 'father' },
      { person_a: 'Anita Stålhammar', person_b: 'Per Stålhammar', type: 'mother' },
      
      // Hendrik and Ingrid marriage
      { person_a: 'Hendrik Stålhammar', person_b: 'Ingrid Eneborg', type: 'spouse' },
      
      // Main generation - Children of Hendrik & Ingrid
      { person_a: 'Hendrik Stålhammar', person_b: 'Sofia Stålhammar', type: 'father' },
      { person_a: 'Ingrid Eneborg', person_b: 'Sofia Stålhammar', type: 'mother' },
      { person_a: 'Hendrik Stålhammar', person_b: 'Eric Stålhammar', type: 'father' },
      { person_a: 'Ingrid Eneborg', person_b: 'Eric Stålhammar', type: 'mother' },
      { person_a: 'Hendrik Stålhammar', person_b: 'Rebecka Stålhammar', type: 'father' },
      { person_a: 'Ingrid Eneborg', person_b: 'Rebecka Stålhammar', type: 'mother' },
      
      // Sofia's marriages
      { person_a: 'Sofia Stålhammar', person_b: 'Mathias Jansson', type: 'spouse' },
      { person_a: 'Sofia Stålhammar', person_b: 'Adam', type: 'spouse' },
      
      // Eric's marriages
      { person_a: 'Eric Stålhammar', person_b: 'Haeji Moon', type: 'spouse' },
      { person_a: 'Eric Stålhammar', person_b: 'Emma Olsson', type: 'spouse' },
      { person_a: 'Eric Stålhammar', person_b: 'Nicole', type: 'spouse' },
      
      // Rebecka's marriage
      { person_a: 'Rebecka Stålhammar', person_b: 'Mingyu Lee', type: 'spouse' },
      
      // Sofia's children
      { person_a: 'Sofia Stålhammar', person_b: 'Juni', type: 'mother' },
      { person_a: 'Adam', person_b: 'Juni', type: 'father' },
      { person_a: 'Sofia Stålhammar', person_b: 'Clara', type: 'mother' },
      { person_a: 'Mathias Jansson', person_b: 'Clara', type: 'father' },
      
      // Eric's children
      { person_a: 'Eric Stålhammar', person_b: 'Rasmus Oliver Stålhammar', type: 'father' },
      { person_a: 'Emma Olsson', person_b: 'Rasmus Oliver Stålhammar', type: 'mother' },
      { person_a: 'Eric Stålhammar', person_b: 'Tima Elara Stålhammar', type: 'father' },
      { person_a: 'Nicole', person_b: 'Tima Elara Stålhammar', type: 'mother' },
    ];
    
    for (const rel of relationships) {
      const id_a = personMap[rel.person_a];
      const id_b = personMap[rel.person_b];
      if (id_a && id_b) {
        await pool.query(
          `INSERT INTO relationships (person_a_id, person_b_id, relation_type)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [id_a, id_b, rel.type]
        );
      }
    }
    
    console.log('✅ Relationships created:', relationships.length);
    console.log('✅ Database seeded successfully!');
    console.log('');
    console.log('Default Login:');
    console.log('  Email: test@example.com');
    console.log('  Password: test123');
    console.log('');
    
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seed();
