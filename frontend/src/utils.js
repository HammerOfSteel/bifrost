/**
 * Pure utility functions for Brimfrost
 * All functions here are side-effect-free and testable.
 */

// ============================================================================
// GRAPH UTILITIES
// ============================================================================

export function nameOf(p) {
  const fn = (p && p.data && p.data['first name']) ? p.data['first name'] : '';
  const ln = (p && p.data && p.data['last name']) ? p.data['last name'] : '';
  const nm = (fn + ' ' + ln).trim();
  return nm || (p && p.id) || '';
}

export function idMap(arr) {
  const m = {};
  for (let i = 0; i < arr.length; i++) m[arr[i].id] = arr[i];
  return m;
}

export function buildAdj(arr) {
  const adj = {};
  function add(x, y) {
    if (!adj[x]) adj[x] = [];
    if (!adj[y]) adj[y] = [];
    if (adj[x].indexOf(y) < 0) adj[x].push(y);
    if (adj[y].indexOf(x) < 0) adj[y].push(x);
  }
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i], r = p.rels || {};
    if (r.father) add(p.id, r.father);
    if (r.mother) add(p.id, r.mother);
    (r.children || []).forEach(c => add(p.id, c));
    (r.spouses || []).forEach(s => add(p.id, s));
  }
  return adj;
}

export function bfsPath(adj, start, goal) {
  if (!start || !goal) return null;
  if (start === goal) return [start];
  const q = [start], prev = {}, seen = {};
  seen[start] = true;
  while (q.length) {
    const u = q.shift();
    const nbrs = adj[u] || [];
    for (let i = 0; i < nbrs.length; i++) {
      const v = nbrs[i];
      if (seen[v]) continue;
      seen[v] = true;
      prev[v] = u;
      q.push(v);
      if (v === goal) {
        const path = [v];
        let x = v;
        while (x !== start) { x = prev[x]; path.push(x); }
        path.reverse();
        return path;
      }
    }
  }
  return null;
}

export function edgeType(idA, idB, map) {
  const a = map[idA], b = map[idB];
  if (!a || !b) return '';
  const rA = a.rels || {}, rB = b.rels || {};
  if (rA.spouses && rA.spouses.indexOf(idB) >= 0) return 'spouse';
  if (rA.children && rA.children.indexOf(idB) >= 0) return 'parent-of';
  if (rB.children && rB.children.indexOf(idA) >= 0) return 'child-of';
  if (rA.father === idB || rA.mother === idB) return 'child-of';
  if (rB.father === idA || rB.mother === idA) return 'parent-of';
  return 'related';
}

export function relSentence(aId, bId, map) {
  const t = edgeType(aId, bId, map);
  const a = map[aId], b = map[bId];
  const A = nameOf(a), B = nameOf(b);
  if (t === 'spouse') return A + ' is married to ' + B;
  if (t === 'parent-of') return A + ' is parent of ' + B;
  if (t === 'child-of') return A + ' is child of ' + B;
  return A + ' is related to ' + B;
}

// ============================================================================
// TEXT / NAME HELPERS
// ============================================================================

export function findByExactName(data, txt) {
  for (let i = 0; i < data.length; i++) {
    if (nameOf(data[i]) === txt) return data[i];
  }
  return null;
}

export function findByLooseText(data, txt) {
  if (!txt) return null;
  const cleaned = txt.toLowerCase().replace(/\s+/g, ' ').trim();
  for (let i = 0; i < data.length; i++) {
    const nm = nameOf(data[i]).toLowerCase().replace(/\s+/g, ' ').trim();
    if (nm === cleaned) return data[i];
  }
  return null;
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export function splitCSV(str) {
  return (str || '').split(',').map(s => s.trim()).filter(Boolean);
}

export function uniqueIdFromName(first, last) {
  const slug = (first + '-' + last).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug + '-' + Math.random().toString(36).slice(2, 6);
}

// ============================================================================
// SEARCH FILTER (pure function version)
// ============================================================================

export function filterDataByQuery(data, q) {
  if (!q || !q.length) return data.slice(0, 6);
  const lower = q.toLowerCase();
  return data.filter(p => {
    const nm = nameOf(p).toLowerCase();
    const bio = (p.data && p.data.bio) ? p.data.bio.toLowerCase() : '';
    const tags = (p.data && p.data.tags) ? p.data.tags.join(' ').toLowerCase() : '';
    const locs = (p.data && p.data.locations) ? p.data.locations.join(' ').toLowerCase() : '';
    return nm.includes(lower) || bio.includes(lower) || tags.includes(lower) || locs.includes(lower);
  });
}

// ============================================================================
// MEDIA HELPERS
// ============================================================================

export function getYouTubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (host.endsWith('youtube.com')) {
      if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2];
      else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2];
      else id = u.searchParams.get('v');
    }
    return id ? id.replace(/[^A-Za-z0-9_-]/g, '') : null;
  } catch { return null; }
}

export function isVideoFile(url) { return /\.(mp4|webm|ogg|ogv)(\?|#|$)/i.test(url || ''); }
export function isImageFile(url) { return /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/i.test(url || ''); }
export function isPdfFile(url) { return /\.pdf(\?|#|$)/i.test(url || ''); }
export function isPreviewable(url) { return isImageFile(url) || isVideoFile(url) || isPdfFile(url); }

export function directImageUrl(url) {
  if (/^https?:\/\/i\.ibb\.co\//i.test(url)) return url;
  if (/^https?:\/\/ibb\.co\//i.test(url)) return null;
  if (isImageFile(url)) return url;
  return null;
}

export function getFileExt(url) {
  try {
    const u = new URL(url);
    const base = u.pathname.split('/').pop() || '';
    const m = base.match(/\.([a-z0-9]+)$/i);
    return m ? m[1].toLowerCase() : '';
  } catch {
    const m = (url || '').match(/\.([a-z0-9]+)(?:\?|#|$)/i);
    return m ? m[1].toLowerCase() : '';
  }
}

export function getBaseName(url) {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() || url); }
  catch { return url; }
}

export function fileColorForExt(ext) {
  if (['pdf'].includes(ext)) return '#e25555';
  if (['doc', 'docx', 'pages'].includes(ext)) return '#6aa9ff';
  if (['xls', 'xlsx', 'numbers', 'csv'].includes(ext)) return '#5bbf7a';
  if (['ppt', 'pptx', 'key'].includes(ext)) return '#ff8b3d';
  if (['zip', 'rar', '7z', 'gz'].includes(ext)) return '#b0b7c3';
  if (['mp4', 'webm', 'ogg', 'ogv', 'mov'].includes(ext)) return '#9b7cf6';
  if (['mp3', 'wav', 'm4a', 'flac'].includes(ext)) return '#64d2c8';
  if (['txt', 'md', 'rtf', 'json'].includes(ext)) return '#c7d1dd';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'avif', 'svg'].includes(ext)) return '#7aa2f7';
  return '#7aa2f7';
}

export function fileIconSVG() {
  return `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" stroke-width="1.5"/>
    <path d="M14 3v5h5" stroke-width="1.5"/>
    <rect x="8" y="13" width="8" height="1.4" rx=".7"/>
    <rect x="8" y="16" width="8" height="1.4" rx=".7"/>
  </svg>`;
}
