import { describe, it, expect } from 'vitest';
import {
  nameOf, idMap, buildAdj, bfsPath, edgeType, relSentence,
  findByExactName, findByLooseText,
  escapeHtml, splitCSV, uniqueIdFromName,
  filterDataByQuery,
  getYouTubeId, isVideoFile, isImageFile, isPdfFile, isPreviewable,
  directImageUrl, getFileExt, getBaseName, fileColorForExt, fileIconSVG
} from '../src/utils.js';
import { transformToFamilyChartFormat } from '../src/family-utils.js';

// ============================================================================
// TEST FIXTURES — mirrors real DB data shape
// ============================================================================
const API_PERSONS = [
  { id: 1, name: 'Erik Stålhammar', bio: 'Developer', photo_url: 'https://example.com/erik.jpg', birth_year: 1990, death_year: null, gender: 'M',
    relationships: [
      { person_a_id: 1, person_b_id: 2, related_person_id: 2, relation_type: 'spouse', started_year: 2015, ended_year: null },
      { person_a_id: 1, person_b_id: 3, related_person_id: 3, relation_type: 'father', started_year: null, ended_year: null },
    ],
    tags: [{ name: 'tech' }, { name: 'family' }],
    locations: [{ name: 'Stockholm' }]
  },
  { id: 2, name: 'Anna Stålhammar', bio: 'Designer', photo_url: null, birth_year: 1992, death_year: null, gender: 'F',
    relationships: [
      { person_a_id: 1, person_b_id: 2, related_person_id: 1, relation_type: 'spouse', started_year: 2015, ended_year: null },
      { person_a_id: 2, person_b_id: 3, related_person_id: 3, relation_type: 'mother', started_year: null, ended_year: null },
    ],
    tags: [{ name: 'design' }, { name: 'family' }],
    locations: [{ name: 'Stockholm' }, { name: 'Malmö' }]
  },
  { id: 3, name: 'Liam Stålhammar', bio: '', photo_url: null, birth_year: 2020, death_year: null, gender: 'M',
    relationships: [
      { person_a_id: 1, person_b_id: 3, related_person_id: 1, relation_type: 'father', started_year: null, ended_year: null },
      { person_a_id: 2, person_b_id: 3, related_person_id: 2, relation_type: 'mother', started_year: null, ended_year: null },
    ],
    tags: [],
    locations: [{ name: 'Stockholm' }]
  },
  { id: 4, name: 'Bengt Eneborg', bio: 'Grandfather', photo_url: null, birth_year: 1940, death_year: 2010, gender: 'M',
    relationships: [
      { person_a_id: 4, person_b_id: 5, related_person_id: 5, relation_type: 'spouse', started_year: 1965, ended_year: null },
      { person_a_id: 4, person_b_id: 1, related_person_id: 1, relation_type: 'father', started_year: null, ended_year: null },
    ],
    tags: [{ name: 'family' }],
    locations: []
  },
  { id: 5, name: 'Ingrid Eneborg', bio: 'Grandmother', photo_url: null, birth_year: 1942, death_year: null, gender: 'F',
    relationships: [
      { person_a_id: 4, person_b_id: 5, related_person_id: 4, relation_type: 'spouse', started_year: 1965, ended_year: null },
      { person_a_id: 5, person_b_id: 1, related_person_id: 1, relation_type: 'mother', started_year: null, ended_year: null },
    ],
    tags: [],
    locations: [{ name: 'Malmö' }]
  },
];

// Pre-built family-chart format data for pure util tests
function makePerson(id, first, last, gender, opts = {}) {
  return {
    id,
    rels: { father: opts.father || null, mother: opts.mother || null, spouses: opts.spouses || [], children: opts.children || [] },
    data: {
      'first name': first, 'last name': last, gender,
      birthday: opts.birthday || '', avatar: opts.avatar || '', bio: opts.bio || '',
      tags: opts.tags || [], locations: opts.locations || [],
      media: { photos: [], videos: [], files: [] }, social: {}
    }
  };
}

// Family tree:  Bengt(M) + Ingrid(F) → Erik(M) + Anna(F) → Liam(M)
const BENGT  = makePerson('4', 'Bengt', 'Eneborg', 'M', { spouses: ['5'], children: ['1'] });
const INGRID = makePerson('5', 'Ingrid', 'Eneborg', 'F', { spouses: ['4'], children: ['1'] });
const ERIK   = makePerson('1', 'Erik', 'Stålhammar', 'M', { father: '4', mother: '5', spouses: ['2'], children: ['3'], tags: ['tech', 'family'], locations: ['Stockholm'], bio: 'Developer' });
const ANNA   = makePerson('2', 'Anna', 'Stålhammar', 'F', { spouses: ['1'], children: ['3'], tags: ['design', 'family'], locations: ['Stockholm', 'Malmö'] });
const LIAM   = makePerson('3', 'Liam', 'Stålhammar', 'M', { father: '1', mother: '2' });

const TEST_DATA = [BENGT, INGRID, ERIK, ANNA, LIAM];
const TEST_IDMAP = idMap(TEST_DATA);
const TEST_ADJ = buildAdj(TEST_DATA);

// ============================================================================
// transformToFamilyChartFormat
// ============================================================================
describe('transformToFamilyChartFormat', () => {
  const result = transformToFamilyChartFormat(API_PERSONS);
  const rMap = idMap(result);

  it('converts all persons', () => {
    expect(result).toHaveLength(5);
  });

  it('splits name into first and last', () => {
    const erik = rMap['1'];
    expect(erik.data['first name']).toBe('Erik');
    expect(erik.data['last name']).toBe('Stålhammar');
  });

  it('maps gender', () => {
    expect(rMap['1'].data.gender).toBe('M');
    expect(rMap['2'].data.gender).toBe('F');
  });

  it('maps birthday from birth_year', () => {
    expect(rMap['1'].data.birthday).toBe(1990);
  });

  it('maps avatar from photo_url', () => {
    expect(rMap['1'].data.avatar).toBe('https://example.com/erik.jpg');
    expect(rMap['2'].data.avatar).toBe('');
  });

  it('maps bio', () => {
    expect(rMap['1'].data.bio).toBe('Developer');
  });

  it('creates spouse relationships bidirectionally', () => {
    expect(rMap['1'].rels.spouses).toContain('2');
    expect(rMap['2'].rels.spouses).toContain('1');
  });

  it('creates parent -> child relationships', () => {
    // Erik (id=1, male) is father to Liam (id=3)
    expect(rMap['1'].rels.children).toContain('3');
  });

  it('creates child -> parent relationships', () => {
    // Liam should have father=1 (Erik, male) and mother=2 (Anna, female)
    expect(rMap['3'].rels.father).toBe('1');
    expect(rMap['3'].rels.mother).toBe('2');
  });

  it('grandparent chain: Bengt(4) -> Erik(1) -> Liam(3)', () => {
    expect(rMap['4'].rels.children).toContain('1');
    expect(rMap['1'].rels.father).toBe('4');
    expect(rMap['1'].rels.mother).toBe('5');
  });

  it('all ids are strings', () => {
    result.forEach(p => {
      expect(typeof p.id).toBe('string');
    });
  });

  it('tags mapped correctly when present', () => {
    expect(rMap['1'].data.tags).toEqual(['tech', 'family']);
  });

  it('locations mapped correctly', () => {
    expect(rMap['1'].data.locations).toEqual(['Stockholm']);
  });

  it('handles empty tags/locations gracefully', () => {
    expect(rMap['3'].data.tags).toEqual([]);
    expect(rMap['4'].data.locations).toEqual([]);
  });
});

// ============================================================================
// nameOf
// ============================================================================
describe('nameOf', () => {
  it('returns "First Last" for a normal person', () => {
    expect(nameOf(ERIK)).toBe('Erik Stålhammar');
  });

  it('returns first name only if no last name', () => {
    const p = makePerson('x', 'Solo', '', 'M');
    expect(nameOf(p)).toBe('Solo');
  });

  it('falls back to id if no name data', () => {
    expect(nameOf({ id: 'fallback-id', data: {} })).toBe('fallback-id');
  });

  it('falls back to id if data is missing', () => {
    expect(nameOf({ id: 'no-data' })).toBe('no-data');
  });
});

// ============================================================================
// idMap
// ============================================================================
describe('idMap', () => {
  it('creates a lookup by id', () => {
    const m = idMap(TEST_DATA);
    expect(m['1']).toBe(ERIK);
    expect(m['4']).toBe(BENGT);
    expect(m['nonexistent']).toBeUndefined();
  });

  it('handles empty array', () => {
    expect(idMap([])).toEqual({});
  });
});

// ============================================================================
// buildAdj
// ============================================================================
describe('buildAdj', () => {
  it('creates adjacency list from relationships', () => {
    const adj = buildAdj(TEST_DATA);
    // Erik (1) should be adjacent to: father(4), mother(5), spouse(2), child(3)
    expect(adj['1']).toEqual(expect.arrayContaining(['4', '5', '2', '3']));
  });

  it('adjacency is bidirectional', () => {
    const adj = buildAdj(TEST_DATA);
    // If 1 is adjacent to 4, then 4 is adjacent to 1
    expect(adj['4']).toContain('1');
    expect(adj['1']).toContain('4');
  });

  it('handles person with no relationships', () => {
    const isolated = [makePerson('lonely', 'Alone', 'Person', 'M')];
    const adj = buildAdj(isolated);
    // Should either not have the key or have empty array
    expect(adj['lonely'] || []).toEqual([]);
  });
});

// ============================================================================
// bfsPath
// ============================================================================
describe('bfsPath', () => {
  it('finds direct parent-child path', () => {
    const path = bfsPath(TEST_ADJ, '1', '3');
    expect(path).toEqual(['1', '3']);
  });

  it('finds grandparent path: Bengt(4) → Erik(1) → Liam(3)', () => {
    const path = bfsPath(TEST_ADJ, '4', '3');
    expect(path).toHaveLength(3);
    expect(path[0]).toBe('4');
    expect(path[2]).toBe('3');
  });

  it('returns [start] for same start and goal', () => {
    expect(bfsPath(TEST_ADJ, '1', '1')).toEqual(['1']);
  });

  it('returns null for disconnected nodes', () => {
    const disconnected = { 'a': ['b'], 'b': ['a'], 'c': [] };
    expect(bfsPath(disconnected, 'a', 'c')).toBeNull();
  });

  it('returns null for null/empty inputs', () => {
    expect(bfsPath(TEST_ADJ, null, '1')).toBeNull();
    expect(bfsPath(TEST_ADJ, '1', null)).toBeNull();
  });

  it('finds shortest path (spouse shortcut)', () => {
    // Anna(2) to Liam(3): could go 2→1→3 or 2→3 (Anna is direct parent)
    const path = bfsPath(TEST_ADJ, '2', '3');
    expect(path).toHaveLength(2); // direct: 2→3
  });

  it('finds path across in-law chain: Bengt(4) to Anna(2)', () => {
    const path = bfsPath(TEST_ADJ, '4', '2');
    expect(path).not.toBeNull();
    expect(path.length).toBeLessThanOrEqual(3); // 4→1→2
  });
});

// ============================================================================
// edgeType
// ============================================================================
describe('edgeType', () => {
  it('detects spouse', () => {
    expect(edgeType('1', '2', TEST_IDMAP)).toBe('spouse');
  });

  it('detects parent-of (via children array)', () => {
    expect(edgeType('1', '3', TEST_IDMAP)).toBe('parent-of');
  });

  it('detects child-of (via father/mother)', () => {
    expect(edgeType('3', '1', TEST_IDMAP)).toBe('child-of');
  });

  it('returns empty string for missing persons', () => {
    expect(edgeType('1', 'nonexistent', TEST_IDMAP)).toBe('');
  });
});

// ============================================================================
// relSentence
// ============================================================================
describe('relSentence', () => {
  it('spouse sentence', () => {
    expect(relSentence('1', '2', TEST_IDMAP)).toBe('Erik Stålhammar is married to Anna Stålhammar');
  });

  it('parent-of sentence', () => {
    expect(relSentence('1', '3', TEST_IDMAP)).toBe('Erik Stålhammar is parent of Liam Stålhammar');
  });

  it('child-of sentence', () => {
    expect(relSentence('3', '1', TEST_IDMAP)).toBe('Liam Stålhammar is child of Erik Stålhammar');
  });
});

// ============================================================================
// findByExactName / findByLooseText
// ============================================================================
describe('findByExactName', () => {
  it('finds person by exact full name', () => {
    expect(findByExactName(TEST_DATA, 'Erik Stålhammar')).toBe(ERIK);
  });

  it('returns null for partial match', () => {
    expect(findByExactName(TEST_DATA, 'Erik')).toBeNull();
  });

  it('returns null for no match', () => {
    expect(findByExactName(TEST_DATA, 'Nobody Here')).toBeNull();
  });
});

describe('findByLooseText', () => {
  it('finds person case-insensitively', () => {
    expect(findByLooseText(TEST_DATA, 'erik stålhammar')).toBe(ERIK);
  });

  it('trims extra whitespace', () => {
    expect(findByLooseText(TEST_DATA, '  Erik   Stålhammar  ')).toBe(ERIK);
  });

  it('returns null for null input', () => {
    expect(findByLooseText(TEST_DATA, null)).toBeNull();
  });
});

// ============================================================================
// filterDataByQuery (search functionality)
// ============================================================================
describe('filterDataByQuery', () => {
  it('returns first 6 items when query is empty', () => {
    const result = filterDataByQuery(TEST_DATA, '');
    expect(result.length).toBeLessThanOrEqual(6);
    expect(result.length).toBeGreaterThan(0);
  });

  it('finds by name substring', () => {
    const result = filterDataByQuery(TEST_DATA, 'Erik');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ERIK);
  });

  it('finds by bio content', () => {
    const result = filterDataByQuery(TEST_DATA, 'Developer');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ERIK);
  });

  it('finds by tag', () => {
    const result = filterDataByQuery(TEST_DATA, 'tech');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ERIK);
  });

  it('finds by location', () => {
    const result = filterDataByQuery(TEST_DATA, 'Malmö');
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(ANNA);
  });

  it('is case-insensitive', () => {
    const result = filterDataByQuery(TEST_DATA, 'ERIK');
    expect(result).toHaveLength(1);
  });

  it('finds multiple matches for shared tag', () => {
    const result = filterDataByQuery(TEST_DATA, 'family');
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for no match', () => {
    const result = filterDataByQuery(TEST_DATA, 'zzzznoMatch');
    expect(result).toHaveLength(0);
  });
});

// ============================================================================
// escapeHtml
// ============================================================================
describe('escapeHtml', () => {
  it('escapes HTML entities', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('escapes ampersand', () => {
    expect(escapeHtml('A & B')).toBe('A &amp; B');
  });

  it('handles null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  it('passes through safe text', () => {
    expect(escapeHtml('Hello World')).toBe('Hello World');
  });
});

// ============================================================================
// splitCSV
// ============================================================================
describe('splitCSV', () => {
  it('splits comma-separated values', () => {
    expect(splitCSV('a, b, c')).toEqual(['a', 'b', 'c']);
  });

  it('trims whitespace', () => {
    expect(splitCSV('  foo ,  bar  ')).toEqual(['foo', 'bar']);
  });

  it('filters empty strings', () => {
    expect(splitCSV('a,,b,')).toEqual(['a', 'b']);
  });

  it('handles empty/null input', () => {
    expect(splitCSV('')).toEqual([]);
    expect(splitCSV(null)).toEqual([]);
  });
});

// ============================================================================
// uniqueIdFromName
// ============================================================================
describe('uniqueIdFromName', () => {
  it('creates a slug-based id', () => {
    const id = uniqueIdFromName('Erik', 'Stålhammar');
    expect(id).toMatch(/^erik-st-lhammar-[a-z0-9]{4}$/);
  });

  it('generates unique ids on repeated calls', () => {
    const a = uniqueIdFromName('Test', 'Person');
    const b = uniqueIdFromName('Test', 'Person');
    expect(a).not.toBe(b);
  });
});

// ============================================================================
// getYouTubeId
// ============================================================================
describe('getYouTubeId', () => {
  it('extracts from standard URL', () => {
    expect(getYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from short URL', () => {
    expect(getYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(getYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from shorts URL', () => {
    expect(getYouTubeId('https://www.youtube.com/shorts/abc123')).toBe('abc123');
  });

  it('returns null for non-YouTube URL', () => {
    expect(getYouTubeId('https://vimeo.com/123456')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(getYouTubeId('not-a-url')).toBeNull();
  });
});

// ============================================================================
// File type detection
// ============================================================================
describe('file type detection', () => {
  it('isVideoFile detects mp4', () => {
    expect(isVideoFile('https://example.com/video.mp4')).toBe(true);
    expect(isVideoFile('https://example.com/video.webm')).toBe(true);
  });

  it('isVideoFile rejects non-video', () => {
    expect(isVideoFile('https://example.com/image.png')).toBe(false);
  });

  it('isImageFile detects common formats', () => {
    expect(isImageFile('photo.jpg')).toBe(true);
    expect(isImageFile('photo.jpeg')).toBe(true);
    expect(isImageFile('photo.png')).toBe(true);
    expect(isImageFile('photo.webp')).toBe(true);
    expect(isImageFile('photo.gif')).toBe(true);
  });

  it('isPdfFile detects pdf', () => {
    expect(isPdfFile('doc.pdf')).toBe(true);
    expect(isPdfFile('doc.pdf?token=abc')).toBe(true);
    expect(isPdfFile('doc.txt')).toBe(false);
  });

  it('isPreviewable combines all types', () => {
    expect(isPreviewable('photo.jpg')).toBe(true);
    expect(isPreviewable('video.mp4')).toBe(true);
    expect(isPreviewable('doc.pdf')).toBe(true);
    expect(isPreviewable('file.zip')).toBe(false);
  });
});

// ============================================================================
// directImageUrl
// ============================================================================
describe('directImageUrl', () => {
  it('returns direct ibb.co URLs', () => {
    expect(directImageUrl('https://i.ibb.co/abc/image.jpg')).toBe('https://i.ibb.co/abc/image.jpg');
  });

  it('returns null for ibb.co page URLs', () => {
    expect(directImageUrl('https://ibb.co/abc')).toBeNull();
  });

  it('returns image URLs directly', () => {
    expect(directImageUrl('https://example.com/pic.png')).toBe('https://example.com/pic.png');
  });

  it('returns null for non-image URLs', () => {
    expect(directImageUrl('https://example.com/doc.pdf')).toBeNull();
  });
});

// ============================================================================
// getFileExt / getBaseName
// ============================================================================
describe('getFileExt', () => {
  it('extracts extension from URL', () => {
    expect(getFileExt('https://example.com/file.pdf')).toBe('pdf');
    expect(getFileExt('https://example.com/photo.JPG')).toBe('jpg');
  });

  it('handles query strings', () => {
    expect(getFileExt('https://example.com/file.pdf?token=abc')).toBe('pdf');
  });

  it('returns empty for no extension', () => {
    expect(getFileExt('https://example.com/file')).toBe('');
  });
});

describe('getBaseName', () => {
  it('extracts filename from URL', () => {
    expect(getBaseName('https://example.com/docs/report.pdf')).toBe('report.pdf');
  });
});

// ============================================================================
// fileColorForExt
// ============================================================================
describe('fileColorForExt', () => {
  it('returns red for pdf', () => {
    expect(fileColorForExt('pdf')).toBe('#e25555');
  });

  it('returns green for excel', () => {
    expect(fileColorForExt('xlsx')).toBe('#5bbf7a');
  });

  it('returns default blue for unknown', () => {
    expect(fileColorForExt('xyz')).toBe('#7aa2f7');
  });
});

// ============================================================================
// fileIconSVG
// ============================================================================
describe('fileIconSVG', () => {
  it('returns SVG string', () => {
    const svg = fileIconSVG();
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
});

// ============================================================================
// Integration: full pipeline (API → transform → graph utils)
// ============================================================================
describe('Integration: API → transform → graph utilities', () => {
  const data = transformToFamilyChartFormat(API_PERSONS);
  const map = idMap(data);
  const adj = buildAdj(data);

  it('graph data from API can find path from grandparent to grandchild', () => {
    // Bengt(4) → Erik(1) → Liam(3)
    const path = bfsPath(adj, '4', '3');
    expect(path).not.toBeNull();
    expect(path[0]).toBe('4');
    expect(path[path.length - 1]).toBe('3');
  });

  it('search finds transformed persons by name', () => {
    const results = filterDataByQuery(data, 'Stålhammar');
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('search finds transformed persons by bio', () => {
    const results = filterDataByQuery(data, 'Developer');
    expect(results).toHaveLength(1);
    expect(nameOf(results[0])).toBe('Erik Stålhammar');
  });

  it('edge types work with transformed data', () => {
    expect(edgeType('1', '2', map)).toBe('spouse');
    expect(edgeType('1', '3', map)).toBe('parent-of');
    expect(edgeType('3', '1', map)).toBe('child-of');
  });

  it('relSentence works end-to-end', () => {
    expect(relSentence('1', '2', map)).toContain('married');
    expect(relSentence('4', '1', map)).toContain('parent');
  });
});
