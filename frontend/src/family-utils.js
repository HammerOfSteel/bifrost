/**
 * Family Tree Data Utilities
 * Transforms API data into family-chart compatible format
 */

/**
 * Transform API persons into family-chart compatible format
 * Handles the actual API response structure with name as single field
 */
export function transformToFamilyChartFormat(persons) {
  // First pass: create a map of all persons and build relationship indices
  const personMap = new Map();
  const relationshipMap = {}; // personId -> { father, mother, spouses, children }

  // Initialize all persons
  persons.forEach(person => {
    personMap.set(String(person.id), person);
    relationshipMap[String(person.id)] = {
      father: null,
      mother: null,
      spouses: [],
      children: []
    };
  });

  // Second pass: process relationships
  // DB convention: for 'father'/'mother' types, person_a IS the parent, person_b IS the child
  // Relationships come duplicated (once from each person's perspective) so we deduplicate
  const processedRels = new Set();
  persons.forEach(person => {
    if (!person.relationships || !Array.isArray(person.relationships)) return;

    person.relationships.forEach(rel => {
      // Build a unique key from the original DB pair + type to avoid processing twice
      const pA = String(rel.person_a_id);
      const pB = String(rel.person_b_id);
      const relType = rel.relation_type.toLowerCase();
      const relKey = pA + '-' + pB + '-' + relType;
      if (processedRels.has(relKey)) return;
      processedRels.add(relKey);

      if (relType === 'father' || relType === 'mother') {
        // person_a is the parent, person_b is the child
        const parentId = pA;
        const childId = pB;
        if (relationshipMap[childId] && relType === 'father') {
          if (!relationshipMap[childId].father) relationshipMap[childId].father = parentId;
        }
        if (relationshipMap[childId] && relType === 'mother') {
          if (!relationshipMap[childId].mother) relationshipMap[childId].mother = parentId;
        }
        if (relationshipMap[parentId] && !relationshipMap[parentId].children.includes(childId)) {
          relationshipMap[parentId].children.push(childId);
        }
      } else if (relType === 'spouse' || relType === 'marriage') {
        if (relationshipMap[pA] && !relationshipMap[pA].spouses.includes(pB)) relationshipMap[pA].spouses.push(pB);
        if (relationshipMap[pB] && !relationshipMap[pB].spouses.includes(pA)) relationshipMap[pB].spouses.push(pA);
      }
    });
  });

  // Transform to family-chart format
  return persons.map(person => {
    const nameParts = (person.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    // Build media object from API media array
    const mediaItems = person.media || [];
    const media = {
      photos: mediaItems.filter(m => m.type === 'photo').map(m => m.url),
      videos: mediaItems.filter(m => m.type === 'video').map(m => m.url),
      files: mediaItems.filter(m => m.type === 'file').map(m => ({ url: m.url, name: m.title || '' })),
    };

    return {
      id: String(person.id),
      rels: relationshipMap[String(person.id)],
      data: {
        'first name': firstName,
        'last name': lastName,
        gender: person.gender || '',
        birthday: person.birth_year || '',
        avatar: person.photo_url || '',
        bio: person.bio || '',
        tags: person.tags ? person.tags.map(t => t.name || t) : [],
        locations: person.locations ? person.locations.map(l => l.name || l) : [],
        media,
        social: person.social_links || {}
      }
    };
  });
}
