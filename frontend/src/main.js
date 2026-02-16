import api from './api.js';
import { transformToFamilyChartFormat } from './family-utils.js';
import {
  nameOf, idMap, buildAdj, bfsPath, edgeType, relSentence,
  findByExactName, findByLooseText, filterDataByQuery,
  escapeHtml, splitCSV, uniqueIdFromName,
  getYouTubeId, isVideoFile, isImageFile, isPdfFile, isPreviewable,
  directImageUrl, getFileExt, getBaseName, fileColorForExt, fileIconSVG
} from './utils.js';

// ============================================================================
// STATE
// ============================================================================
let DATA = [];
let IDMAP = {};
let ADJ = {};
let f3Chart = null;
let currentProfileId = null;
let viewerItems = [];
let viewerIndex = 0;

// ============================================================================
// INITIALIZATION
// ============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const token = api.getToken();
  if (!token) {
    showLoginPage();
  } else {
    showMainApp();
    loadFamilyData();
  }
  setupEventListeners();
});

// ============================================================================
// AUTH UI
// ============================================================================
function showLoginPage() {
  document.getElementById('login-page').classList.add('active');
  document.getElementById('main-app').classList.remove('active');
}

function showMainApp() {
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('main-app').classList.add('active');
  // Show admin button only for admins
  const user = api.getCurrentUser();
  const adminBtn = document.getElementById('adminBtn');
  if (adminBtn) adminBtn.style.display = (user && user.role === 'admin') ? '' : 'none';
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Login
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Center
  document.getElementById('center-btn').addEventListener('click', () => {
    if (f3Chart) f3Chart.updateTree({ initial: true });
  });

  // Search
  const qEl = document.getElementById('q');
  const sugg = document.getElementById('sugg');
  const clearBtn = document.getElementById('clearBtn');
  qEl.addEventListener('input', renderSuggestions);
  qEl.addEventListener('focus', renderSuggestions);
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search')) sugg.style.display = 'none';
  });
  clearBtn.addEventListener('click', () => { qEl.value = ''; renderSuggestions(); });

  // Suggestion clicks
  sugg.addEventListener('click', (e) => {
    const item = e.target.closest('.sugg-item');
    if (!item) return;
    const id = item.getAttribute('data-id');
    // Focus the graph on this person, then open profile
    if (f3Chart && id) {
      f3Chart.updateMainId(id);
      f3Chart.updateTree({ tree_position: 'fit' });
    }
    openProfile(id);
    sugg.style.display = 'none';
  });

  // Profile modal
  document.getElementById('m-close').addEventListener('click', () => {
    document.getElementById('profileModal').classList.remove('open');
  });
  document.getElementById('profileModal').addEventListener('click', (e) => {
    if (e.target.id === 'profileModal') document.getElementById('profileModal').classList.remove('open');
  });
  document.getElementById('m-edit').addEventListener('click', () => {
    if (!currentProfileId) return;
    document.getElementById('profileModal').classList.remove('open');
    openEditor(currentProfileId);
  });
  document.getElementById('m-delete').addEventListener('click', () => {
    if (!currentProfileId) return;
    document.getElementById('profileModal').classList.remove('open');
    deletePerson(currentProfileId);
  });

  // Editor modal
  document.getElementById('edClose').addEventListener('click', () => {
    document.getElementById('editorModal').classList.remove('open');
  });
  document.getElementById('edSave').addEventListener('click', saveEditor);
  document.getElementById('m-add-sibling').addEventListener('click', () => {
    if (!currentProfileId) return;
    addSiblingFlow(currentProfileId);
  });

  // Admin panel
  document.getElementById('adminBtn').addEventListener('click', openAdminPanel);
  document.getElementById('adminPanelClose').addEventListener('click', () => {
    document.getElementById('adminPanel').classList.remove('open');
  });
  document.getElementById('adminPanel').addEventListener('click', (e) => {
    if (e.target.id === 'adminPanel') document.getElementById('adminPanel').classList.remove('open');
  });

  // Admin tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.admin-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // Admin people
  document.getElementById('admin-add-person').addEventListener('click', () => {
    document.getElementById('adminPanel').classList.remove('open');
    newPersonFlow();
  });
  document.getElementById('admin-people-search').addEventListener('input', renderAdminPeople);

  // Admin users
  document.getElementById('admin-add-user').addEventListener('click', () => showUserForm());
  document.getElementById('au-cancel').addEventListener('click', () => {
    document.getElementById('admin-user-form').style.display = 'none';
  });
  document.getElementById('au-save').addEventListener('click', saveUser);

  // Admin import/export
  document.getElementById('admin-export').addEventListener('click', exportJSON);
  document.getElementById('admin-fileImport').addEventListener('change', (e) => {
    if (e.target.files[0]) importJSONFromFile(e.target.files[0]);
  });

  // Compare panel close
  document.getElementById('c-close').addEventListener('click', () => {
    document.getElementById('comparePanel').style.display = 'none';
  });

  // Media viewer
  document.getElementById('viewerClose').addEventListener('click', closeViewer);
  document.getElementById('viewerPrev').addEventListener('click', () => showViewerItem(viewerIndex - 1));
  document.getElementById('viewerNext').addEventListener('click', () => showViewerItem(viewerIndex + 1));
  document.getElementById('viewerModal').addEventListener('click', (e) => {
    if (e.target.id === 'viewerModal') closeViewer();
  });
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('viewerModal').classList.contains('open')) return;
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowLeft') showViewerItem(viewerIndex - 1);
    if (e.key === 'ArrowRight') showViewerItem(viewerIndex + 1);
  });

  // Shift-key suppressor on chart (prevent f3 from handling shift-clicks)
  const chartEl = document.getElementById('FamilyChart');
  ['pointerdown', 'mousedown', 'touchstart', 'click'].forEach(type => {
    chartEl.addEventListener(type, (e) => {
      if (e.shiftKey) {
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  });

  // Global click handler for chart cards (including shift-click compare)
  setupGlobalChartClickHandler();
}

// ============================================================================
// LOGIN / LOGOUT
// ============================================================================
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorEl = document.getElementById('login-error');
  try {
    errorEl.style.display = 'none';
    await api.login(email, password);
    showMainApp();
    loadFamilyData();
  } catch (error) {
    errorEl.textContent = error.message || 'Login failed';
    errorEl.style.display = 'block';
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    api.logout();
    showLoginPage();
    document.getElementById('login-form').reset();
    document.getElementById('q').value = '';
  }
}

// ============================================================================
// LOAD FAMILY DATA
// ============================================================================
async function loadFamilyData() {
  const container = document.getElementById('FamilyChart');
  container.innerHTML = '<div class="loading">Loading family tree...</div>';
  try {
    const persons = await api.getPersons();
    if (!persons || !persons.length) {
      container.innerHTML = '<div class="loading">No family members found.</div>';
      return;
    }
    DATA = transformToFamilyChartFormat(persons);
    IDMAP = idMap(DATA);
    ADJ = buildAdj(DATA);

    // Make globally available
    window.DATA = DATA;
    window.IDMAP = IDMAP;

    container.innerHTML = '';
    createChart();
  } catch (error) {
    console.error('Failed to load family data:', error);
    container.innerHTML = `<div class="loading" style="color:#ff9999;">Failed to load: ${error.message}</div>`;
  }
}

// ============================================================================
// CHART
// ============================================================================
function rebuildChart() {
  IDMAP = idMap(DATA);
  ADJ = buildAdj(DATA);
  window.IDMAP = IDMAP;
  document.getElementById('FamilyChart').innerHTML = '';
  createChart();
}

function createChart() {
  if (typeof window.f3 === 'undefined') {
    document.getElementById('FamilyChart').innerHTML = '<div class="loading">f3 library not loaded.</div>';
    return;
  }

  f3Chart = f3.createChart('#FamilyChart', DATA)
    .setTransitionTime(800)
    .setCardXSpacing(250)
    .setCardYSpacing(150);

  f3Chart.setCard(f3.CardHtml)
    .setCardDisplay([['first name'], ['last name']])
    .setCardInnerHtmlCreator((d) => {
      const data = d.data.data;
      const firstName = data['first name'] || '';
      const lastName = data['last name'] || '';
      const name = `<div>${firstName}</div><div>${lastName}</div>`;

      if (data.avatar) {
        // Image card: photo on top, name below
        return `
          <div class="card-inner bv2-card-img" style="width:160px;min-height:120px;border-radius:6px;overflow:hidden;display:flex;flex-direction:column;align-items:center;">
            <img src="${data.avatar}" style="width:100%;height:100px;object-fit:cover;" alt="${firstName}">
            <div class="card-label" style="padding:6px 4px;text-align:center;font-size:13px;line-height:1.2;">${name}</div>
          </div>`;
      }
      // No image: icon + name (default blue/pink style)
      return `
        <div class="card-inner card-image-rect" style="width:160px;min-height:70px;display:flex;align-items:center;border-radius:5px;">
          <div class="person-icon" style="height:60px;width:60px;flex:0 0 auto;padding:5px;margin-right:8px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" style="width:100%;height:100%;padding:5px;border-radius:7px;">
              <path fill="currentColor" d="M16 4a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 14c5.52 0 10 2.24 10 5v3H6v-3c0-2.76 4.48-5 10-5z"/>
            </svg>
          </div>
          <div class="card-label" style="overflow:hidden;display:flex;flex-direction:column;justify-content:center;font-size:13px;line-height:1.2;">${name}</div>
        </div>`;
    });

  f3Chart.updateTree({ initial: true });

  window.f3Chart = f3Chart;

  // Bind card click handlers with MutationObserver
  const container = document.getElementById('FamilyChart');

  function bindCardClicks() {
    const cards = container.querySelectorAll('.f3__card, .f3-card, .f3__card__container, .f3-card-html, [data-id]');
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i];
      if (c.getAttribute('data-fv-bound') === '1') continue;
      c.setAttribute('data-fv-bound', '1');
      c.style.cursor = 'pointer';
    }
  }

  const mo = new MutationObserver(() => bindCardClicks());
  mo.observe(container, { childList: true, subtree: true });
  bindCardClicks();
}

// ============================================================================
// GLOBAL CHART CLICK HANDLER (captures all clicks on the chart area)
// ============================================================================
function setupGlobalChartClickHandler() {
  const lastTwo = [];
  const container = document.getElementById('FamilyChart');

  function withinChart(x, y) {
    if (!container) return false;
    const r = container.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  }

  function climbForId(el) {
    let hops = 0;
    while (el && hops < 20) {
      if (el.getAttribute) {
        const id = el.getAttribute('data-id') || el.getAttribute('data-person') || el.getAttribute('data-node');
        if (id) return id;
      }
      el = el.parentNode;
      hops++;
    }
    return null;
  }

  document.addEventListener('click', (e) => {
    // Ignore clicks on UI elements (search, modals, compare panel)
    if (e.target.closest && (e.target.closest('.topbar') || e.target.closest('.modal') || e.target.closest('.compare'))) return;
    if (!withinChart(e.clientX, e.clientY)) return;

    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;

    // Try to resolve id by attributes up the tree
    const pid = climbForId(el);
    let person = null;

    if (pid && IDMAP[pid]) {
      person = IDMAP[pid];
    } else {
      // Fallback: try to find a nearby card container then use its text
      const cardEl = el.closest ? el.closest('.f3__card, .f3-card, .f3__card__container, .f3-card-html, [data-id]') : null;
      const picked = firstTwoLinesText(cardEl || el);
      if (picked) person = findByExactName(DATA, picked) || findByLooseText(DATA, picked);
    }

    if (!person) return;

    if (e.shiftKey) {
      lastTwo.push(person.id);
      if (lastTwo.length > 2) lastTwo.shift();
      if (lastTwo.length === 2) openCompare(lastTwo[0], lastTwo[1]);
    } else {
      openProfile(person.id);
    }
  }, true);
}

// ============================================================================
// SEARCH SUGGESTIONS (uses filterDataByQuery from utils.js)
// ============================================================================
function renderSuggestions() {
  const qEl = document.getElementById('q');
  const sugg = document.getElementById('sugg');
  const q = (qEl.value || '').trim();
  const items = filterDataByQuery(DATA, q);

  if (!items.length) { sugg.style.display = 'none'; sugg.innerHTML = ''; return; }

  let html = '';
  for (let j = 0; j < Math.min(items.length, 12); j++) {
    const p = items[j];
    const ava = (p.data && p.data.avatar) ? p.data.avatar : '';
    html += `<div class="sugg-item" data-id="${p.id}">
      ${ava ? `<img class="sugg-ava" src="${ava}" alt=""/>` : '<div class="sugg-ava"></div>'}
      <div><div style="font-weight:700">${nameOf(p)}</div>
      <div class="muted" style="font-size:12px">${(p.data && p.data.birthday) ? p.data.birthday : ''}</div></div>
    </div>`;
  }
  sugg.innerHTML = html;
  sugg.style.display = 'block';
}

// ============================================================================
// PROFILE MODAL
// ============================================================================
function openProfile(id) {
  currentProfileId = id;
  const p = IDMAP[id];
  if (!p) return;

  const modal = document.getElementById('profileModal');

  // Name, birthday, bio
  document.getElementById('m-name').textContent = nameOf(p);
  document.getElementById('m-bday').textContent = (p.data && p.data.birthday) ? p.data.birthday : '';
  document.getElementById('m-bio').textContent = (p.data && p.data.bio) ? p.data.bio : '';

  // Portrait
  const ava = (p.data && p.data.avatar) ? p.data.avatar : '';
  document.getElementById('m-portrait').setAttribute('src', ava || '');

  // Structured info (gender, locations)
  let s = '';
  if (p.data && p.data.gender) s += 'Gender: ' + p.data.gender + '. ';
  if (p.data && p.data.locations && p.data.locations.length) s += 'Locations: ' + p.data.locations.join(', ');
  document.getElementById('m-struct').textContent = s;

  // Tags
  const tags = (p.data && p.data.tags) ? p.data.tags : [];
  let tHtml = '';
  for (let i = 0; i < tags.length; i++) {
    tHtml += '<span class="pill">' + escapeHtml(tags[i]) + '</span> ';
  }
  document.getElementById('m-tags').innerHTML = tHtml || '<span class="muted">—</span>';

  // Media
  const media = (p.data && p.data.media) ? p.data.media : { photos: [], videos: [], files: [] };

  // Photos
  let ph = '';
  for (let a = 0; a < (media.photos || []).length; a++) {
    const phit = media.photos[a];
    const url = (typeof phit === 'string') ? phit : (phit && phit.url) ? phit.url : '';
    const cap = (typeof phit === 'object' && phit && phit.caption) ? phit.caption : '';
    const direct = directImageUrl(url);
    if (direct) {
      ph += '<figure><img class="media-thumb" src="' + escapeHtml(direct) + '" alt="" referrerpolicy="no-referrer" />'
        + (cap ? '<figcaption class="muted" style="font-size:12px">' + escapeHtml(cap) + '</figcaption>' : '')
        + '</figure>';
    } else if (url) {
      ph += '<div><a class="pill" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open image</a></div>';
    }
  }
  document.getElementById('m-photos').innerHTML = ph || '<span class="muted">—</span>';

  // Videos
  let vv = '';
  for (let b = 0; b < (media.videos || []).length; b++) {
    const v = media.videos[b];
    const url = (typeof v === 'string') ? v : (v && v.url) ? v.url : '';
    if (!url) continue;
    const yid = getYouTubeId(url);
    if (yid) {
      const embed = 'https://www.youtube-nocookie.com/embed/' + yid + '?rel=0';
      vv += '<div class="media-embed"><iframe src="' + embed + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe></div>';
    } else if (isVideoFile(url)) {
      vv += '<video class="media-thumb" src="' + escapeHtml(url) + '" controls playsinline></video>';
    } else {
      vv += '<a class="pill" href="' + escapeHtml(url) + '" target="_blank" rel="noopener">Open video</a>';
    }
  }
  document.getElementById('m-videos').innerHTML = vv || '<span class="muted">—</span>';

  // Files (mosaic)
  let ff = '';
  const filesArr = media.files || [];
  if (filesArr.length) {
    ff += '<div class="file-grid">';
    for (let c = 0; c < filesArr.length; c++) {
      const fhit = filesArr[c];
      if (!fhit || !fhit.url) continue;
      const url = fhit.url;
      const cap = fhit.name || '';
      const ext = getFileExt(url);
      const direct = directImageUrl(url);
      const isImg = !!direct;
      const color = fileColorForExt(ext);
      ff += '<a class="file-item' + (isImg ? ' has-thumb' : '') + '" href="' + escapeHtml(url) + '" target="_blank" rel="noopener" style="--fc:' + color + '">';
      if (isImg) {
        ff += '<img class="file-thumb" src="' + escapeHtml(direct) + '" alt="" referrerpolicy="no-referrer">';
      } else {
        ff += '<div class="file-ico">' + fileIconSVG() + '</div>';
      }
      ff += '<div class="file-ext">' + escapeHtml(ext ? ext.toUpperCase() : 'FILE') + '</div>';
      if (cap) ff += '<div class="file-cap" title="' + escapeHtml(cap) + '">' + escapeHtml(cap) + '</div>';
      ff += '</a>';
    }
    ff += '</div>';
  }
  document.getElementById('m-files').innerHTML = ff || '<span class="muted">—</span>';

  // Social
  const social = (p.data && p.data.social) ? p.data.social : {};
  let sh = '';
  if (social.instagram) sh += '<a class="pill" href="' + escapeHtml(social.instagram) + '" target="_blank" rel="noopener">Instagram</a> ';
  if (social.tiktok) sh += '<a class="pill" href="' + escapeHtml(social.tiktok) + '" target="_blank" rel="noopener">TikTok</a> ';
  if (social.facebook) sh += '<a class="pill" href="' + escapeHtml(social.facebook) + '" target="_blank" rel="noopener">Facebook</a> ';
  document.getElementById('m-social').innerHTML = sh || '<span class="muted">—</span>';

  setupMediaViewerForPerson(p);

  modal.classList.add('open');
}

// ============================================================================
// EDITOR
// ============================================================================
function openEditor(id) {
  const p = IDMAP[id];
  if (!p) return;
  const edModal = document.getElementById('editorModal');
  edModal.classList.add('open');

  document.getElementById('ed-id').value = p.id;
  document.getElementById('ed-first').value = p.data?.['first name'] || '';
  document.getElementById('ed-last').value = p.data?.['last name'] || '';
  document.getElementById('ed-gender').value = p.data?.gender || '';
  document.getElementById('ed-bday').value = p.data?.birthday || '';
  document.getElementById('ed-avatar').value = p.data?.avatar || '';
  document.getElementById('ed-bio').value = p.data?.bio || '';
  document.getElementById('ed-tags').value = (p.data?.tags || []).join(', ');
  document.getElementById('ed-locs').value = (p.data?.locations || []).join(', ');

  document.getElementById('ed-father').value = p.rels?.father || '';
  document.getElementById('ed-mother').value = p.rels?.mother || '';
  document.getElementById('ed-spouses').value = (p.rels?.spouses || []).join(', ');
  document.getElementById('ed-children').value = (p.rels?.children || []).join(', ');

  const photos = (p.data?.media?.photos || []).map(ph => typeof ph === 'string' ? ph : ph?.url || '').filter(Boolean);
  document.getElementById('ed-photos').value = photos.join('\n');

  const videos = (p.data?.media?.videos || []).map(v => typeof v === 'string' ? v : v?.url || '').filter(Boolean);
  document.getElementById('ed-videos').value = videos.join('\n');

  const files = (p.data?.media?.files || []).map(f => (f?.url || '') + (f?.name ? (' ' + f.name) : '')).filter(Boolean);
  document.getElementById('ed-files').value = files.join('\n');
}

async function saveEditor() {
  const id = document.getElementById('ed-id').value;
  const p = IDMAP[id];
  if (!p) return;

  // Keep previous state for reciprocal cleanup
  const prev = JSON.parse(JSON.stringify(p));

  // Update data
  p.data = p.data || {};
  p.data['first name'] = document.getElementById('ed-first').value.trim();
  p.data['last name'] = document.getElementById('ed-last').value.trim();
  p.data.gender = document.getElementById('ed-gender').value.trim();
  p.data.birthday = document.getElementById('ed-bday').value.trim();
  p.data.avatar = document.getElementById('ed-avatar').value.trim();
  p.data.bio = document.getElementById('ed-bio').value.trim();
  p.data.tags = splitCSV(document.getElementById('ed-tags').value);
  p.data.locations = splitCSV(document.getElementById('ed-locs').value);

  // Update rels
  p.rels = p.rels || {};
  p.rels.father = document.getElementById('ed-father').value.trim() || null;
  p.rels.mother = document.getElementById('ed-mother').value.trim() || null;
  p.rels.spouses = splitCSV(document.getElementById('ed-spouses').value);
  p.rels.children = splitCSV(document.getElementById('ed-children').value);

  // Media
  p.data.media = p.data.media || {};
  p.data.media.photos = document.getElementById('ed-photos').value.split('\n').map(s => s.trim()).filter(Boolean);
  p.data.media.videos = document.getElementById('ed-videos').value.split('\n').map(s => s.trim()).filter(Boolean);
  p.data.media.files = document.getElementById('ed-files').value.split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const parts = line.split(/\s+/);
    return { url: parts[0], name: parts.slice(1).join(' ') || '' };
  });

  // Ensure reciprocal relationships
  ensureReciprocalParentChild(p, prev);

  // Sync spouses
  (p.rels.spouses || []).forEach(sid => {
    const sp = IDMAP[sid];
    if (sp) {
      sp.rels = sp.rels || {};
      const set = new Set(sp.rels.spouses || []);
      set.add(p.id);
      sp.rels.spouses = Array.from(set);
    }
  });

  // Remove old spouse links that were dropped
  (prev.rels?.spouses || []).forEach(sid => {
    if (!(p.rels.spouses || []).includes(sid)) {
      const sp = IDMAP[sid];
      if (sp?.rels?.spouses) {
        sp.rels.spouses = sp.rels.spouses.filter(x => x !== p.id);
      }
    }
  });

  document.getElementById('editorModal').classList.remove('open');
  rebuildChart();
}

// ============================================================================
// DELETE PERSON
// ============================================================================
async function deletePerson(id) {
  if (!confirm('Delete ' + nameOf(IDMAP[id]) + '? This cannot be undone.')) return;

  // Remove from all reciprocal relationships
  DATA.forEach(p => {
    if (!p.rels) return;
    if (p.rels.father === id) p.rels.father = null;
    if (p.rels.mother === id) p.rels.mother = null;
    if (p.rels.spouses) p.rels.spouses = p.rels.spouses.filter(x => x !== id);
    if (p.rels.children) p.rels.children = p.rels.children.filter(x => x !== id);
  });

  // Remove the person
  DATA = DATA.filter(p => p.id !== id);
  window.DATA = DATA;
  rebuildChart();
}

// ============================================================================
// NEW PERSON
// ============================================================================
function newPersonFlow() {
  const first = prompt('First name?') || '';
  const last = prompt('Last name?') || '';
  if (!first && !last) return;
  const newId = uniqueIdFromName(first, last);
  DATA.push({
    id: newId,
    rels: { spouses: [], children: [], father: null, mother: null },
    data: {
      gender: '', 'first name': first, 'last name': last,
      birthday: '', avatar: '', bio: '',
      tags: [], locations: [], media: { photos: [], videos: [], files: [] }
    }
  });
  window.DATA = DATA;
  rebuildChart();
  openEditor(newId);
}

// ============================================================================
// ADD SIBLING
// ============================================================================
async function addSiblingFlow(baseId) {
  const base = IDMAP[baseId];
  if (!base) { alert('Could not find person.'); return; }

  const first = prompt('Sibling first name?') || '';
  const last = prompt('Last name? (empty = same as ' + (base.data?.['last name'] || '') + ')') || (base.data?.['last name'] || '');
  const newId = uniqueIdFromName(first, last);

  const { fatherId, motherId } = ensureParentsExist(base);

  const sib = {
    id: newId,
    rels: { spouses: [], children: [], father: fatherId, mother: motherId },
    data: {
      gender: '', 'first name': first, 'last name': last,
      birthday: '', avatar: '', bio: '',
      tags: [], locations: [], media: { photos: [], videos: [], files: [] }
    }
  };
  DATA.push(sib);
  window.DATA = DATA;

  addChildToParent(fatherId, newId);
  addChildToParent(motherId, newId);
  addChildToParent(fatherId, base.id);
  addChildToParent(motherId, base.id);

  rebuildChart();
  openEditor(newId);
}

// ============================================================================
// ADMIN PANEL
// ============================================================================
async function openAdminPanel() {
  document.getElementById('adminPanel').classList.add('open');
  loadAdminStats();
  renderAdminPeople();
  loadAdminUsers();
}

async function loadAdminStats() {
  try {
    const stats = await api.getStats();
    const el = document.getElementById('admin-stats');
    el.innerHTML = [
      { num: stats.persons, label: 'People' },
      { num: stats.relationships, label: 'Relationships' },
      { num: stats.users, label: 'Users' },
      { num: stats.tags, label: 'Tags' },
      { num: stats.locations, label: 'Locations' },
      { num: stats.media, label: 'Media' },
    ].map(s => `<div class="stat-card"><div class="stat-num">${s.num}</div><div class="stat-label">${s.label}</div></div>`).join('');
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
}

function renderAdminPeople() {
  const filter = (document.getElementById('admin-people-search').value || '').toLowerCase();
  const tbody = document.getElementById('admin-people-tbody');
  const filtered = DATA.filter(p => {
    if (!filter) return true;
    const name = ((p.data?.['first name'] || '') + ' ' + (p.data?.['last name'] || '')).toLowerCase();
    return name.includes(filter);
  });
  tbody.innerHTML = filtered.map(p => {
    const name = ((p.data?.['first name'] || '') + ' ' + (p.data?.['last name'] || '')).trim() || '(unnamed)';
    const gender = p.data?.gender || '—';
    const bday = p.data?.birthday || '—';
    const dbId = p._dbId || '—';
    return `<tr>
      <td>${escapeHtml(String(dbId))}</td>
      <td><span class="person-row-name">${escapeHtml(name)}</span></td>
      <td>${escapeHtml(gender)}</td>
      <td>${escapeHtml(bday)}</td>
      <td>—</td>
      <td>
        <button class="btn btn-sm" onclick="document.getElementById('adminPanel').classList.remove('open');window.openEditorGlobal&&window.openEditorGlobal('${escapeHtml(p.id)}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="window.deletePersonGlobal&&window.deletePersonGlobal('${escapeHtml(p.id)}')">Delete</button>
      </td>
    </tr>`;
  }).join('');
}

// Expose for inline onclick handlers
window.openEditorGlobal = (id) => openEditor(id);
window.deletePersonGlobal = (id) => {
  deletePerson(id);
  setTimeout(renderAdminPeople, 300);
};

let editingUserId = null;

async function loadAdminUsers() {
  try {
    const users = await api.getUsers();
    const currentUser = api.getCurrentUser();
    const tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = users.map(u => {
      const isSelf = currentUser && currentUser.id === u.id;
      const created = u.created_at ? new Date(u.created_at).toLocaleDateString() : '—';
      return `<tr>
        <td>${u.id}</td>
        <td>${escapeHtml(u.name)}</td>
        <td>${escapeHtml(u.email)}</td>
        <td><span class="badge ${u.is_admin ? 'badge-admin' : 'badge-user'}">${u.is_admin ? 'Admin' : 'User'}</span></td>
        <td>${created}</td>
        <td>
          <button class="btn btn-sm" data-edit-user="${u.id}">Edit</button>
          ${isSelf ? '' : `<button class="btn btn-sm btn-danger" data-del-user="${u.id}">Delete</button>`}
        </td>
      </tr>`;
    }).join('');

    // Bind edit/delete
    tbody.querySelectorAll('[data-edit-user]').forEach(btn => {
      btn.addEventListener('click', () => {
        const uid = parseInt(btn.dataset.editUser);
        const u = users.find(x => x.id === uid);
        if (u) showUserForm(u);
      });
    });
    tbody.querySelectorAll('[data-del-user]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = parseInt(btn.dataset.delUser);
        const u = users.find(x => x.id === uid);
        if (!u) return;
        if (!confirm(`Delete user "${u.name}" (${u.email})?`)) return;
        try {
          await api.deleteUser(uid);
          loadAdminUsers();
          loadAdminStats();
        } catch (e) { alert('Failed: ' + e.message); }
      });
    });
  } catch (e) {
    console.error('Failed to load users:', e);
  }
}

function showUserForm(user = null) {
  editingUserId = user ? user.id : null;
  document.getElementById('admin-user-form-title').textContent = user ? 'Edit User' : 'New User';
  document.getElementById('au-name').value = user ? user.name : '';
  document.getElementById('au-email').value = user ? user.email : '';
  document.getElementById('au-password').value = '';
  document.getElementById('au-role').value = user ? String(user.is_admin) : 'false';
  document.getElementById('au-password').placeholder = user ? 'Leave blank to keep current' : 'Min 8 characters';
  document.getElementById('admin-user-form').style.display = 'block';
}

async function saveUser() {
  const name = document.getElementById('au-name').value.trim();
  const email = document.getElementById('au-email').value.trim();
  const password = document.getElementById('au-password').value;
  const is_admin = document.getElementById('au-role').value === 'true';

  if (!name || !email) { alert('Name and email are required'); return; }
  if (!editingUserId && (!password || password.length < 8)) { alert('Password must be at least 8 characters'); return; }

  try {
    if (editingUserId) {
      const data = { name, email, is_admin };
      if (password) data.password = password;
      await api.updateUser(editingUserId, data);
    } else {
      await api.createUser({ name, email, password, is_admin });
    }
    document.getElementById('admin-user-form').style.display = 'none';
    loadAdminUsers();
    loadAdminStats();
  } catch (e) {
    alert('Failed: ' + e.message);
  }
}

// ============================================================================
// EXPORT / IMPORT
// ============================================================================
function exportJSON() {
  try {
    const blob = new Blob([JSON.stringify(DATA, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    a.href = url;
    a.download = `brimfrost-people-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

function importJSONFromFile(file) {
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const parsed = JSON.parse(evt.target.result);
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array of persons');
      parsed.forEach(p => { if (!p.id) throw new Error('Each entry needs an "id"'); });
      DATA = parsed;
      window.DATA = DATA;
      rebuildChart();
      alert(`Imported ${DATA.length} persons.`);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ============================================================================
// COMPARE PANEL
// ============================================================================
function openCompare(aId, bId) {
  const a = IDMAP[aId], b = IDMAP[bId];
  if (!a || !b) return;

  document.getElementById('c-who').textContent = nameOf(a) + '  •  ' + nameOf(b);

  // Portraits
  document.getElementById('c-ava-a').setAttribute('src', (a.data && a.data.avatar) ? a.data.avatar : '');
  document.getElementById('c-ava-b').setAttribute('src', (b.data && b.data.avatar) ? b.data.avatar : '');

  // Relation path
  const path = bfsPath(ADJ, aId, bId);
  let relHtml = '';
  if (path && path.length) {
    for (let i = 0; i < path.length - 1; i++) {
      const x = path[i], y = path[i + 1];
      const et = edgeType(x, y, IDMAP);
      relHtml += nameOf(IDMAP[x]) + ' — ' + et + ' → ' + nameOf(IDMAP[y]);
      if (i < path.length - 2) relHtml += '<br/>';
    }
    relHtml += '<div class="muted" style="margin-top:4px">Degrees of separation: ' + (path.length - 1) + '</div>';
  } else {
    relHtml = '<span class="muted">No path found.</span>';
  }
  document.getElementById('c-rel').innerHTML = relHtml;

  // Shared tags
  const tagSetA = {};
  ((a.data && a.data.tags) || []).forEach(t => tagSetA[t] = true);
  const sharedTags = [];
  ((b.data && b.data.tags) || []).forEach(t => { if (tagSetA[t]) sharedTags.push(t); });
  let tHtml = '';
  if (sharedTags.length) {
    sharedTags.forEach(t => tHtml += '<span class="pill">' + escapeHtml(t) + '</span> ');
  } else {
    tHtml = '<span class="muted">—</span>';
  }
  document.getElementById('c-tags').innerHTML = tHtml;

  // Shared locations
  const locSetA = {};
  ((a.data && a.data.locations) || []).forEach(l => locSetA[l] = true);
  const sharedLocs = [];
  ((b.data && b.data.locations) || []).forEach(l => { if (locSetA[l]) sharedLocs.push(l); });
  let lHtml = '';
  if (sharedLocs.length) {
    sharedLocs.forEach(l => lHtml += '<span class="pill">' + escapeHtml(l) + '</span> ');
  } else {
    lHtml = '<span class="muted">—</span>';
  }
  document.getElementById('c-locs').innerHTML = lHtml;

  document.getElementById('comparePanel').style.display = 'block';
}

// ============================================================================
// MEDIA VIEWER (lightbox)
// ============================================================================
function showViewerItem(i) {
  if (!viewerItems.length) return;
  viewerIndex = (i + viewerItems.length) % viewerItems.length;
  const it = viewerItems[viewerIndex];

  const vImg = document.getElementById('viewerImg');
  const vVid = document.getElementById('viewerVideo');
  const vFrm = document.getElementById('viewerFrame');
  const vOpen = document.getElementById('viewerOpen');
  const vText = document.getElementById('viewerText');
  const vPrev = document.getElementById('viewerPrev');
  const vNext = document.getElementById('viewerNext');

  vImg.style.display = 'none';
  vVid.style.display = 'none';
  vFrm.style.display = 'none';
  vVid.pause();

  if (it.type === 'image') { vImg.src = it.url; vImg.style.display = 'block'; }
  else if (it.type === 'video') { vVid.src = it.url; vVid.style.display = 'block'; }
  else if (it.type === 'pdf') { vFrm.src = it.url; vFrm.style.display = 'block'; }

  vOpen.href = it.url;
  vText.textContent = it.caption ? `— ${it.caption}` : `— ${getBaseName(it.url)}`;
  document.getElementById('viewerModal').classList.add('open');

  const multi = viewerItems.length > 1;
  vPrev.style.display = multi ? '' : 'none';
  vNext.style.display = multi ? '' : 'none';
}

function openViewerByUrl(url) {
  if (!url) return;
  const idx = viewerItems.findIndex(x => x.url === url);
  if (idx >= 0) showViewerItem(idx);
  else window.open(url, '_blank', 'noopener');
}

function closeViewer() {
  document.getElementById('viewerModal').classList.remove('open');
  document.getElementById('viewerVideo').pause();
}

function setupMediaViewerForPerson(p) {
  viewerItems = [];

  // Avatar
  const ava = p.data?.avatar;
  const avaDirect = directImageUrl(ava);
  if (avaDirect) viewerItems.push({ type: 'image', url: avaDirect, caption: `${nameOf(p)} – portrait` });

  // Photos
  (p.data?.media?.photos || []).forEach(ph => {
    const url = (typeof ph === 'string') ? ph : ph?.url || '';
    const cap = (typeof ph === 'object' && ph?.caption) ? ph.caption : '';
    const direct = directImageUrl(url);
    if (direct) viewerItems.push({ type: 'image', url: direct, caption: cap });
  });

  // Video files (mp4/webm/ogg)
  (p.data?.media?.videos || []).forEach(v => {
    const url = (typeof v === 'string') ? v : v?.url || '';
    if (isVideoFile(url)) viewerItems.push({ type: 'video', url, caption: '' });
  });

  // Files (images/PDFs)
  (p.data?.media?.files || []).forEach(f => {
    const url = f?.url || '';
    const cap = f?.name || '';
    if (isImageFile(url)) viewerItems.push({ type: 'image', url, caption: cap });
    else if (isPdfFile(url)) viewerItems.push({ type: 'pdf', url, caption: cap });
  });

  // Bind clicks in DOM
  const portraitEl = document.getElementById('m-portrait');
  if (portraitEl && avaDirect) {
    portraitEl.style.cursor = 'zoom-in';
    portraitEl.onclick = () => openViewerByUrl(avaDirect);
  }

  const photoWrap = document.getElementById('m-photos');
  if (photoWrap) {
    photoWrap.querySelectorAll('img.media-thumb').forEach(img => {
      img.style.cursor = 'zoom-in';
      img.addEventListener('click', () => openViewerByUrl(img.getAttribute('src')));
    });
    photoWrap.querySelectorAll('a').forEach(a => {
      const url = a.getAttribute('href');
      if (isPreviewable(url)) {
        a.addEventListener('click', (e) => { e.preventDefault(); openViewerByUrl(url); });
      }
    });
  }

  const fileWrap = document.getElementById('m-files');
  if (fileWrap) {
    fileWrap.querySelectorAll('a').forEach(a => {
      const url = a.getAttribute('href');
      if (isPreviewable(url)) {
        a.addEventListener('click', (e) => { e.preventDefault(); openViewerByUrl(url); });
      }
    });
  }
}

// ============================================================================
// RELATIONSHIP HELPERS
// ============================================================================
function addChildToParent(parentId, childId) {
  if (!parentId) return;
  const par = IDMAP[parentId];
  if (!par) return;
  par.rels = par.rels || {};
  const kids = new Set(par.rels.children || []);
  kids.add(childId);
  par.rels.children = Array.from(kids);
}

function setParentOnChild(childId, parentId) {
  const child = IDMAP[childId];
  const par = IDMAP[parentId];
  if (!child || !par) return;
  child.rels = child.rels || {};
  const g = (par.data && par.data.gender) || '';
  if (g === 'M') child.rels.father = parentId;
  else if (g === 'F') child.rels.mother = parentId;
}

function ensureReciprocalParentChild(p, prev) {
  if (p.rels?.father) addChildToParent(p.rels.father, p.id);
  if (p.rels?.mother) addChildToParent(p.rels.mother, p.id);
  (p.rels?.children || []).forEach(cid => setParentOnChild(cid, p.id));

  const oldF = prev?.rels?.father, newF = p.rels?.father;
  if (oldF && oldF !== newF && IDMAP[oldF]?.rels?.children) {
    IDMAP[oldF].rels.children = IDMAP[oldF].rels.children.filter(x => x !== p.id);
  }
  const oldM = prev?.rels?.mother, newM = p.rels?.mother;
  if (oldM && oldM !== newM && IDMAP[oldM]?.rels?.children) {
    IDMAP[oldM].rels.children = IDMAP[oldM].rels.children.filter(x => x !== p.id);
  }
}

function ensureParentsExist(p) {
  p.rels = p.rels || {};
  let fatherId = p.rels.father;
  let motherId = p.rels.mother;
  const last = (p.data?.['last name'] || '').trim();

  if (!fatherId) {
    fatherId = 'unknown-father-' + Math.random().toString(36).slice(2, 8);
    DATA.push({
      id: fatherId,
      rels: { spouses: [], children: [p.id] },
      data: { gender: 'M', 'first name': 'Unknown', 'last name': last, birthday: '', avatar: '', bio: '', tags: [], locations: [], media: { photos: [], videos: [], files: [] } }
    });
    p.rels.father = fatherId;
  }
  if (!motherId) {
    motherId = 'unknown-mother-' + Math.random().toString(36).slice(2, 8);
    DATA.push({
      id: motherId,
      rels: { spouses: [], children: [p.id] },
      data: { gender: 'F', 'first name': 'Unknown', 'last name': last, birthday: '', avatar: '', bio: '', tags: [], locations: [], media: { photos: [], videos: [], files: [] } }
    });
    p.rels.mother = motherId;
  }

  // Link parents as spouses
  const f = IDMAP[fatherId] || DATA.find(x => x.id === fatherId);
  const m = IDMAP[motherId] || DATA.find(x => x.id === motherId);
  if (f && m) {
    f.rels = f.rels || {};
    m.rels = m.rels || {};
    const fs = new Set(f.rels.spouses || []);
    fs.add(motherId);
    f.rels.spouses = Array.from(fs);
    const ms = new Set(m.rels.spouses || []);
    ms.add(fatherId);
    m.rels.spouses = Array.from(ms);
  }
  return { fatherId, motherId };
}

// ============================================================================
// TEXT / NAME HELPERS
// ============================================================================
function firstTwoLinesText(el) {
  if (!el) return null;
  const parts = (el.textContent || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) return (parts[0] + ' ' + parts[1]).trim();
  return parts[0] || null;
}
