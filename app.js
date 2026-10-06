/* =========================================================
   MY CAISSE PRESTAPAY — Application Logic v2.3
   Added: FRAIS support
   ========================================================= */

const SESSION = (() => {
    const raw = localStorage.getItem(CONFIG.SESSION_KEY);
    if (!raw) { window.location.href = 'index.html'; return null; }
    try { return JSON.parse(raw); }
    catch (e) { localStorage.removeItem(CONFIG.SESSION_KEY);
                window.location.href = 'index.html'; return null; }
})();

function hasPerm(p) {
    if (!SESSION) return false;
    if (SESSION.role === 'admin') return true;
    if (SESSION.permissions?.includes('all')) return true;
    return SESSION.permissions?.includes(p) || false;
}

/* ---------- Utilities ---------- */
const fmtMoney = (v) => {
    const n = Number(v || 0);
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2,
                                        maximumFractionDigits: 2 }) + ' ' + CONFIG.CURRENCY;
};
const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return String(d.getDate()).padStart(2,'0') + '/' +
           String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
};
const todayISO  = () => new Date().toISOString().slice(0,10);
const toISODate = (fr) => { const [d,m,y] = fr.split('/'); return `${y}-${m}-${d}`; };
const toFRDate  = (iso) => { const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };

function toast(msg, type='') {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast';
              document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.className = 'toast ' + type, 3200);
}

/* =========================================================
   API CLIENT
   ========================================================= */
async function apiCall(action, payload = {}) {
    if (CONFIG.LOCAL_MODE) return localApi(action, payload);
    const token = sessionStorage.getItem('mycaisse_token') || '';
    const params = new URLSearchParams();
    params.append('action', action);
    params.append('token', token);
    Object.keys(payload).forEach(key => {
        const value = payload[key];
        if (value === null || value === undefined) return;
        if (typeof value === 'object') return;
        params.append(key, String(value));
    });
    const res = await fetch(CONFIG.API_URL + '?' + params.toString(), {
        method: 'GET', redirect: 'follow'
    });
    return res.json();
}

/* =========================================================
   LOCAL DB (offline fallback)
   ========================================================= */
const LocalDB = {
    _key: 'mycaisse_data_v3',
    _data: null,
    _load() {
        if (this._data) return this._data;
        const raw = localStorage.getItem(this._key);
        this._data = raw ? JSON.parse(raw) : this._seed();
        return this._data;
    },
    _save() { localStorage.setItem(this._key, JSON.stringify(this._data)); },
    _seed() {
        const data = {
            categories: (CONFIG.DEFAULT_CATEGORIES || []).map((c,i) => ({
                id: i + 1, name: c.name, kind: c.kind, position: i
            })),
            types: [], movements: [], settings: { opening_balance: 0 }
        };
        localStorage.setItem(this._key, JSON.stringify(data));
        return data;
    },
    getCategories(kind) {
        const d = this._load();
        return kind ? d.categories.filter(c => c.kind === kind) : d.categories;
    },
    getTypes(catId) {
        return this._load().types.filter(t => String(t.category_id) === String(catId));
    },
    addCategory(name, kind) {
        const d = this._load();
        if (d.categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.kind === kind)) return null;
        const c = { id: Date.now(), name: name.toUpperCase(), kind, position: d.categories.length };
        d.categories.push(c); this._save(); return c;
    },
    deleteCategory(id, name) {
        const d = this._load();
        d.categories = d.categories.filter(c => c.id !== id);
        d.types = d.types.filter(t => String(t.category_id) !== String(id));
        d.movements.forEach(m => {
            if (String(m.category).toUpperCase() === String(name).toUpperCase()) {
                m.category = ''; m.type = '';
            }
        });
        this._save();
    },
    addType(catId, name) {
        const d = this._load();
        const t = { id: Date.now(), category_id: catId, name: name.toUpperCase() };
        d.types.push(t); this._save(); return t;
    },
    deleteType(id) {
        const d = this._load();
        d.types = d.types.filter(t => t.id !== id); this._save();
    },
    getMovements(from, to) {
        const d = this._load();
        return d.movements
            .filter(m => (!from || m.date >= from) && (!to || m.date <= to))
            .sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
    },
    addMovement(m) { const d = this._load(); m.id = Date.now(); d.movements.push(m); this._save(); return m; },
    updateMovement(id, m) {
        const d = this._load();
        const i = d.movements.findIndex(x => x.id === id);
        if (i >= 0) { d.movements[i] = { ...d.movements[i], ...m }; this._save(); }
    },
    deleteMovement(id) { const d = this._load(); d.movements = d.movements.filter(m => m.id !== id); this._save(); },
    getOpeningBalance() { return Number(this._load().settings.opening_balance || 0); },
    setOpeningBalance(v) { this._load().settings.opening_balance = Number(v); this._save(); }
};

function localApi(action, payload) {
    switch(action) {
        case 'login': {
            const u = CONFIG.LOCAL_USERS[payload.username?.toUpperCase()];
            if (u && u.password === payload.password)
                return { success: true, user: { username: payload.username.toUpperCase(),
                        role: u.role, permissions: u.permissions }, token: 'local_' + Date.now() };
            return { success: false, error: 'Identifiants incorrects' };
        }
        case 'getCategories': return { success: true, categories: LocalDB.getCategories() };
        case 'addCategory': {
            const c = LocalDB.addCategory(payload.name, payload.kind);
            return c ? { success: true, id: c.id } : { success: false, error: 'Existe déjà' };
        }
        case 'deleteCategory': LocalDB.deleteCategory(payload.id, payload.name); return { success: true };
        case 'getTypes': return { success: true, types: LocalDB.getTypes(payload.category_id) };
        case 'addType': {
            const t = LocalDB.addType(payload.category_id, payload.name);
            return { success: true, id: t.id };
        }
        case 'deleteType': LocalDB.deleteType(payload.id); return { success: true };
        case 'getMovements': return { success: true, movements: LocalDB.getMovements(payload.from, payload.to) };
        case 'addMovement': return { success: true, id: LocalDB.addMovement(payload).id };
        case 'updateMovement': LocalDB.updateMovement(payload.id, payload); return { success: true };
        case 'deleteMovement': LocalDB.deleteMovement(payload.id); return { success: true };
        case 'getSetting': return { success: true, value: LocalDB.getOpeningBalance() };
        case 'setSetting': LocalDB.setOpeningBalance(payload.value); return { success: true };
        case 'getUsers': return { success: true, users: [] };
        default: return { success: false, error: 'Action inconnue' };
    }
}

/* =========================================================
   HEADER
   ========================================================= */
function renderHeader() {
    document.getElementById('userName').textContent = SESSION.username;
    document.getElementById('userRole').textContent =
        SESSION.role === 'admin' ? 'Administrateur' : 'Utilisateur';
    document.getElementById('userAvatar').textContent = SESSION.username.charAt(0).toUpperCase();
    if (!hasPerm('manage_users') && SESSION.role !== 'admin')
        document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display = 'none');
    if (!hasPerm('add') && SESSION.role !== 'admin')
        document.querySelectorAll('[data-add-only]').forEach(el => el.style.display = 'none');
    if (!hasPerm('export') && SESSION.role !== 'admin')
        document.querySelectorAll('[data-export]').forEach(el => el.style.display = 'none');
}

/* =========================================================
   BANNIÈRE
   ========================================================= */
async function refreshBanner() {
    const [setRes, mvtRes] = await Promise.all([
        apiCall('getSetting', { key: 'opening_balance' }),
        apiCall('getMovements')
    ]);
    const opening = Number(setRes.value || 0);
    const mvts = mvtRes.movements || [];
    const recettes = mvts.reduce((s,m) => s + Number(m.recette||0), 0);
    const depenses = mvts.reduce((s,m) => s + Number(m.depense||0), 0);
    const frais    = mvts.reduce((s,m) => s + Number(m.frais||0), 0);
    document.getElementById('statOpening').textContent = fmtMoney(opening);
    document.getElementById('statRecettes').textContent = fmtMoney(recettes);
    document.getElementById('statDepenses').textContent = fmtMoney(depenses);
    const fraisEl = document.getElementById('statFrais');
    if (fraisEl) fraisEl.textContent = fmtMoney(frais);
    document.getElementById('statFinal').textContent =
        fmtMoney(opening + recettes - depenses - frais);
}

/* =========================================================
   SÉLECTEURS CATÉGORIE & TYPE
   ========================================================= */
async function refreshCategorySelect() {
    const kind = document.querySelector('input[name="opType"]:checked').value + 's';
    const res = await apiCall('getCategories');
    const cats = (res.categories || []).filter(c => c.kind === kind);
    const sel = document.getElementById('selCategory');
    sel.innerHTML = '';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name; opt.dataset.name = c.name;
        sel.appendChild(opt);
    });
    await refreshTypeSelect();
}

async function refreshTypeSelect() {
    const sel = document.getElementById('selCategory');
    if (!sel.value) return;
    const catId = sel.value;
    const res = await apiCall('getTypes', { category_id: catId });
    const types = res.types || [];
    const typeSel = document.getElementById('selType');
    typeSel.innerHTML = '';
    if (!types.length) { typeSel.innerHTML = '<option value="">(aucun type)</option>'; return; }
    types.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id; opt.textContent = t.name; opt.dataset.name = t.name;
        typeSel.appendChild(opt);
    });
}

/* =========================================================
   MOUVEMENTS — AVEC FRAIS
   ========================================================= */
let CURRENT_EDIT_ID = null;

async function refreshMovements() {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    const q    = document.getElementById('searchInput').value.trim().toLowerCase();
    const isoFrom = from ? toISODate(from) : null;
    const isoTo   = to ? toISODate(to) : null;

    const res = await apiCall('getMovements', { from: isoFrom, to: isoTo });
    let list = res.movements || [];
    if (q) list = list.filter(m => JSON.stringify(m).toLowerCase().includes(q));

    const tbody = document.getElementById('movTbody');
    tbody.innerHTML = '';

    let running = 0;
    const openRes = await apiCall('getSetting', { key: 'opening_balance' });
    running = Number(openRes.value || 0);
    if (isoFrom) {
        const allRes = await apiCall('getMovements');
        (allRes.movements || []).filter(m => m.date < isoFrom)
            .forEach(m => running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0));
    }

    list.forEach(m => {
        // ✅ Solde = + Recettes - Dépenses - Frais
        running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
        const tr = document.createElement('tr');
        tr.className = m.recette > 0 ? 'recette' : 'depense';
        tr.innerHTML = `
            <td>${fmtDate(m.date)}</td>
            <td>${m.transaction_no || ''}</td>
            <td>${m.category || ''}</td>
            <td>${m.type || ''}</td>
            <td>${m.description || ''}</td>
            <td class="amt-recette">${m.recette ? fmtMoney(m.recette) : ''}</td>
            <td class="amt-depense">${m.depense ? fmtMoney(m.depense) : ''}</td>
            <td class="amt-frais">${m.frais ? fmtMoney(m.frais) : ''}</td>
            <td class="amt-solde">${fmtMoney(running)}</td>
            <td>
                ${hasPerm('edit') ? `<button class="btn btn-gray" data-edit="${m.id}">✏️</button>` : ''}
                ${hasPerm('delete') ? `<button class="btn btn-danger" data-del="${m.id}">🗑</button>` : ''}
            </td>`;
        tbody.appendChild(tr);
    });
    document.getElementById('movCount').textContent = list.length + ' ligne(s)';
    refreshBanner();
}

function clearForm() {
    CURRENT_EDIT_ID = null;
    document.getElementById('inpTransaction').value = '';
    document.getElementById('inpDescription').value = '';
    document.getElementById('inpAmount').value = '';
    document.getElementById('inpFrais').value = '0';
    document.getElementById('inpDate').value = toFRDate(todayISO());
    document.getElementById('formTitle').textContent = 'Nouveau Mouvement';
    document.getElementById('btnSave').textContent = '➕ Ajouter';
}

async function saveMovement() {
    const dateFR = document.getElementById('inpDate').value;
    const trNo   = document.getElementById('inpTransaction').value.trim();
    const desc   = document.getElementById('inpDescription').value.trim();
    const amount = parseFloat(document.getElementById('inpAmount').value.replace(',', '.')) || 0;
    const frais  = parseFloat((document.getElementById('inpFrais')?.value || '0').replace(',', '.')) || 0;
    const catSel = document.getElementById('selCategory');
    const typeSel = document.getElementById('selType');
    const catName  = catSel.options[catSel.selectedIndex]?.dataset?.name || '';
    const typeName = typeSel.options[typeSel.selectedIndex]?.dataset?.name || '';
    const type   = document.querySelector('input[name="opType"]:checked').value;

    if (!dateFR || amount <= 0) { toast('⚠️ Date et montant obligatoires.', 'warn'); return; }

    const iso = toISODate(dateFR);
    const mvt = {
        date: iso, transaction_no: trNo, category: catName, type: typeName,
        description: desc,
        recette: type === 'Recette' ? amount : 0,
        depense: type === 'Dépense' ? amount : 0,
        frais:   frais
    };
    if (CURRENT_EDIT_ID) {
        mvt.id = CURRENT_EDIT_ID;
        await apiCall('updateMovement', mvt);
        toast('✅ Mouvement modifié.', 'success');
    } else {
        await apiCall('addMovement', mvt);
        toast('✅ Mouvement ajouté.', 'success');
    }
    clearForm(); refreshMovements();
}

async function editMovement(id) {
    const res = await apiCall('getMovements');
    const m = (res.movements || []).find(x => String(x.id) === String(id));
    if (!m) return;
    CURRENT_EDIT_ID = id;
    document.getElementById('inpDate').value = toFRDate(m.date);
    document.getElementById('inpTransaction').value = m.transaction_no || '';
    document.getElementById('inpDescription').value = m.description || '';
    document.getElementById('inpAmount').value = m.recette || m.depense;
    document.getElementById('inpFrais').value = m.frais || 0;

    const type = m.recette > 0 ? 'Recette' : 'Dépense';
    document.querySelector(`input[name="opType"][value="${type}"]`).checked = true;
    await refreshCategorySelect();
    const catSel = document.getElementById('selCategory');
    for (let i = 0; i < catSel.options.length; i++)
        if (catSel.options[i].dataset.name === m.category) catSel.selectedIndex = i;
    await refreshTypeSelect();
    const typeSel = document.getElementById('selType');
    for (let i = 0; i < typeSel.options.length; i++)
        if (typeSel.options[i].dataset.name === m.type) typeSel.selectedIndex = i;
    document.getElementById('formTitle').textContent = 'Modifier le Mouvement';
    document.getElementById('btnSave').textContent = '💾 Enregistrer';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =========================================================
   CATÉGORIES & TYPES
   ========================================================= */
async function refreshManageTables() {
    const catRes = await apiCall('getCategories');
    const cats = catRes.categories || [];
    const catTbody = document.getElementById('catTbody');
    catTbody.innerHTML = '';
    cats.forEach(c => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${c.name}</strong></td>
            <td>${c.kind}</td>
            <td><button class="btn btn-danger" data-del-cat="${c.id}" data-cat-name="${c.name}">🗑</button></td>`;
        catTbody.appendChild(tr);
    });
    const parentSel = document.getElementById('typeParentCat');
    parentSel.innerHTML = '';
    cats.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name + ' (' + c.kind + ')';
        parentSel.appendChild(opt);
    });
    await refreshTypesTable();

    const repSel = document.getElementById('reportCategories');
    repSel.innerHTML = '';
    cats.filter(c => c.kind === 'Dépenses').forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name; opt.textContent = c.name;
        repSel.appendChild(opt);
    });
}

async function refreshTypesTable() {
    const res = await apiCall('getTypes', {});
    const types = res.types || [];
    const catRes = await apiCall('getCategories');
    const cats = catRes.categories || [];
    const tbody = document.getElementById('typeTbody');
    tbody.innerHTML = '';
    types.forEach(t => {
        const parent = cats.find(c => String(c.id) === String(t.category_id));
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${t.name}</td>
            <td>${parent ? parent.name : '—'}</td>
            <td><button class="btn btn-danger" data-del-type="${t.id}">🗑</button></td>`;
        tbody.appendChild(tr);
    });
}

async function addCategory() {
    const name = document.getElementById('newCatName').value.trim();
    const kind = document.getElementById('newCatKind').value;
    if (!name) { toast('⚠️ Entrez le nom de la catégorie', 'warn'); return; }
    const res = await apiCall('addCategory', { name, kind });
    if (res.success) {
        toast('✅ Catégorie ajoutée', 'success');
        document.getElementById('newCatName').value = '';
        refreshManageTables();
        refreshCategorySelect();
    } else toast('❌ ' + (res.error || 'Échec'), 'error');
}

async function deleteCategory(id, name) {
    if (!confirm(`Supprimer la catégorie "${name}" ?`)) return;
    const res = await apiCall('deleteCategory', { id, name });
    if (res.success) {
        toast('✅ Catégorie supprimée', 'success');
        refreshManageTables();
        refreshCategorySelect();
    }
}

async function addType() {
    const catId = document.getElementById('typeParentCat').value;
    const name  = document.getElementById('newTypeName').value.trim();
    if (!name) { toast('⚠️ Entrez le nom du type', 'warn'); return; }
    const res = await apiCall('addType', { category_id: catId, name });
    if (res.success) {
        toast('✅ Type ajouté', 'success');
        document.getElementById('newTypeName').value = '';
        refreshTypesTable();
    } else toast('❌ ' + (res.error || 'Échec'), 'error');
}

async function deleteType(id) {
    if (!confirm('Supprimer ce type ?')) return;
    const res = await apiCall('deleteType', { id });
    if (res.success) { toast('✅ Type supprimé', 'success'); refreshTypesTable(); }
}

/* =========================================================
   RAPPORT MENSUEL
   ========================================================= */
let CURRENT_REPORT = null;

async function generateReport() {
    const month = document.getElementById('reportMonth').value;
    if (!month) { toast('⚠️ Sélectionnez un mois', 'warn'); return; }
    const selectedCats = Array.from(document.getElementById('reportCategories')
        .selectedOptions).map(o => o.value);

    const res = await apiCall('getMovements');
    const all = res.movements || [];
    const filtered = all.filter(m => m.date && m.date.startsWith(month));
    let finalList = filtered;
    if (selectedCats.length > 0)
        finalList = filtered.filter(m => selectedCats.includes(String(m.category).toUpperCase()));

    const before = all.filter(m => m.date < month + '-01');
    const openingRes = await apiCall('getSetting', { key: 'opening_balance' });
    let opening = Number(openingRes.value || 0);
    before.forEach(m => opening += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0));

    const grouped = {};
    let totalDep = 0, totalRec = 0, totalFrais = 0;
    finalList.forEach(m => {
        const cat = m.category || 'SANS CATÉGORIE';
        const typ = m.type || 'SANS TYPE';
        if (!grouped[cat]) grouped[cat] = { total: 0, types: {} };
        if (!grouped[cat].types[typ]) grouped[cat].types[typ] = 0;
        grouped[cat].types[typ] += Number(m.depense || 0);
        grouped[cat].total += Number(m.depense || 0);
        totalDep += Number(m.depense || 0);
        totalRec += Number(m.recette || 0);
        totalFrais += Number(m.frais || 0);
    });

    CURRENT_REPORT = {
        month, opening, totalDep, totalRec, totalFrais,
        closing: opening + totalRec - totalDep - totalFrais,
        grouped, movements: finalList, selectedCats
    };
    renderReport(CURRENT_REPORT);
}

function renderReport(r) {
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const [y, m] = r.month.split('-');
    const monthLabel = monthNames[parseInt(m)-1] + ' ' + y;

    let html = `
    <div class="card" style="border:2px solid var(--violet)">
        <div class="card-header" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;font-size:16px">
            DÉPENSE EXPLOITATION PRESTAPAY — ${monthLabel.toUpperCase()}
        </div>
        <div class="card-body">
            <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:18px">
                <div style="background:var(--violet-light);padding:12px;border-radius:10px;text-align:center">
                    <div style="font-size:11px;font-weight:700;color:var(--blue-dark)">SOLDE DÉBUT</div>
                    <div style="font-size:16px;font-weight:800;color:var(--violet-dark)">${fmtMoney(r.opening)}</div>
                </div>
                <div style="background:#DCFCE7;padding:12px;border-radius:10px;text-align:center">
                    <div style="font-size:11px;font-weight:700;color:#166534">RECETTES</div>
                    <div style="font-size:16px;font-weight:800;color:#059669">${fmtMoney(r.totalRec)}</div>
                </div>
                <div style="background:#FEE2E2;padding:12px;border-radius:10px;text-align:center">
                    <div style="font-size:11px;font-weight:700;color:#991B1B">DÉPENSES</div>
                    <div style="font-size:16px;font-weight:800;color:#DC2626">${fmtMoney(r.totalDep)}</div>
                </div>
                <div style="background:#FFEDD5;padding:12px;border-radius:10px;text-align:center">
                    <div style="font-size:11px;font-weight:700;color:#9A3412">FRAIS</div>
                    <div style="font-size:16px;font-weight:800;color:#D97706">${fmtMoney(r.totalFrais)}</div>
                </div>
                <div style="background:linear-gradient(135deg,#7C3AED,#6D28D9);padding:12px;border-radius:10px;text-align:center;color:#fff">
                    <div style="font-size:11px;font-weight:700">SOLDE FIN</div>
                    <div style="font-size:16px;font-weight:800">${fmtMoney(r.closing)}</div>
                </div>
            </div>
            <table class="data" style="font-size:13px">
                <thead><tr>
                    <th>CATÉGORIE</th><th>TYPE</th>
                    <th style="text-align:right">MONTANT</th>
                </tr></thead><tbody>`;

    Object.keys(r.grouped).sort().forEach(cat => {
        const g = r.grouped[cat];
        html += `<tr style="background:#EDE9FE;font-weight:700;color:#6D28D9">
                    <td colspan="2">${cat}</td>
                    <td style="text-align:right">${fmtMoney(g.total)}</td>
                 </tr>`;
        Object.keys(g.types).sort().forEach(typ => {
            html += `<tr>
                        <td style="padding-left:30px">— ${typ}</td>
                        <td></td>
                        <td style="text-align:right">${fmtMoney(g.types[typ])}</td>
                     </tr>`;
        });
    });

    html += `</tbody>
            <tfoot>
                <tr style="background:linear-gradient(135deg,#1E3A8A,#0F172A);color:#fff;font-weight:800;font-size:14px">
                    <td colspan="2">TOTAL DÉPENSES</td>
                    <td style="text-align:right">${fmtMoney(r.totalDep)}</td>
                </tr>
            </tfoot></table>
        </div>
    </div>`;
    document.getElementById('reportOutput').innerHTML = html;
}

function exportReportExcel() {
    if (!CURRENT_REPORT) { toast('⚠️ Générez d\'abord le rapport', 'warn'); return; }
    const r = CURRENT_REPORT;
    const [y, m] = r.month.split('-');
    const monthLabel = m + '-' + y;
    const data = [
        ['MY CAISSE PRESTAPAY'],
        ['DÉPENSE EXPLOITATION PRESTAPAY — ' + monthLabel],
        [],
        ['Solde début', r.opening],
        ['Total Recettes', r.totalRec],
        ['Total Dépenses', r.totalDep],
        ['Total Frais', r.totalFrais],
        ['Solde fin', r.closing],
        [],
        ['CATÉGORIE', 'TYPE', 'MONTANT (MRU)']
    ];
    Object.keys(r.grouped).sort().forEach(cat => {
        const g = r.grouped[cat];
        data.push([cat, '', g.total]);
        Object.keys(g.types).sort().forEach(typ => data.push(['  ' + cat, typ, g.types[typ]]));
    });
    data.push(['', 'TOTAL DÉPENSES', r.totalDep]);
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rapport');
    XLSX.writeFile(wb, `Rapport_${monthLabel}.xlsx`);
    toast('✅ Excel exporté', 'success');
}

function exportReportPDF() {
    if (!CURRENT_REPORT) { toast('⚠️ Générez d\'abord le rapport', 'warn'); return; }
    const r = CURRENT_REPORT;
    const [y, m] = r.month.split('-');
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin',
                        'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const monthLabel = monthNames[parseInt(m)-1] + ' ' + y;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('MY CAISSE PRESTAPAY', 105, 13, { align:'center' });
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text('DÉPENSE EXPLOITATION PRESTAPAY — ' + monthLabel.toUpperCase(), 105, 22, { align:'center' });

    doc.setTextColor(30,58,138); doc.setFontSize(10);
    let y0 = 42;
    doc.text('Solde début : ' + fmtMoney(r.opening), 15, y0);
    doc.text('Total Recettes : ' + fmtMoney(r.totalRec), 15, y0 + 6);
    doc.text('Total Dépenses : ' + fmtMoney(r.totalDep), 15, y0 + 12);
    doc.text('Total Frais : ' + fmtMoney(r.totalFrais), 15, y0 + 18);
    doc.text('Solde fin : ' + fmtMoney(r.closing), 15, y0 + 24);

    const rows = [];
    Object.keys(r.grouped).sort().forEach(cat => {
        const g = r.grouped[cat];
        rows.push([{ content: cat, colSpan: 2, styles: { fontStyle:'bold',
                    fillColor:[237,233,254], textColor:[109,40,217] } },
                   { content: fmtMoney(g.total), styles: { halign:'right', fontStyle:'bold',
                    fillColor:[237,233,254], textColor:[109,40,217] } }]);
        Object.keys(g.types).sort().forEach(typ => {
            rows.push(['  — ' + typ, '', { content: fmtMoney(g.types[typ]),
                        styles: { halign:'right' } }]);
        });
    });
    rows.push([{ content: 'TOTAL DÉPENSES', colSpan: 2,
                 styles: { fontStyle:'bold', fillColor:[30,58,138], textColor:[255,255,255] } },
               { content: fmtMoney(r.totalDep),
                 styles: { halign:'right', fontStyle:'bold',
                           fillColor:[30,58,138], textColor:[255,255,255] } }]);
    doc.autoTable({
        startY: y0 + 32,
        head: [['CATÉGORIE', 'TYPE', 'MONTANT (MRU)']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [124,58,237], textColor: 255, fontStyle:'bold' },
        theme: 'grid'
    });
    doc.save(`Rapport_${m}_${y}.pdf`);
    toast('✅ PDF exporté', 'success');
}

async function saveClosingAsOpening() {
    if (!CURRENT_REPORT) { toast('⚠️ Générez d\'abord le rapport', 'warn'); return; }
    if (!confirm(`Enregistrer le solde fin ${fmtMoney(CURRENT_REPORT.closing)} comme nouveau solde début ?`)) return;
    const res = await apiCall('setSetting', {
        key: 'opening_balance', value: CURRENT_REPORT.closing
    });
    if (res.success) { toast('✅ Solde début mis à jour', 'success'); refreshBanner(); }
}

/* =========================================================
   EXPORTS (Main)
   ========================================================= */
async function exportData(format) {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    const isoFrom = from ? toISODate(from) : null;
    const isoTo   = to ? toISODate(to) : null;
    const res = await apiCall('getMovements', { from: isoFrom, to: isoTo });
    const movements = res.movements || [];

    let opening = 0;
    const openRes = await apiCall('getSetting', { key: 'opening_balance' });
    opening = Number(openRes.value || 0);
    if (isoFrom) {
        const allRes = await apiCall('getMovements');
        (allRes.movements || []).filter(m => m.date < isoFrom)
            .forEach(m => opening += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0));
    }
    const tRec = movements.reduce((s,m) => s + Number(m.recette||0), 0);
    const tDep = movements.reduce((s,m) => s + Number(m.depense||0), 0);
    const tFrais = movements.reduce((s,m) => s + Number(m.frais||0), 0);
    const finalBal = opening + tRec - tDep - tFrais;
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

    if (format === 'excel') {
        const data = [
            ['MY CAISSE PRESTAPAY'],
            ['Période', `${from || 'N/A'} → ${to || 'N/A'}`],
            ['Solde début', opening, 'Recettes', tRec, 'Dépenses', tDep, 'Frais', tFrais, 'Solde fin', finalBal],
            [],
            ['Date','N° Transaction','Catégorie','Type','Description','Recettes','Dépenses','Frais','Solde']
        ];
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
            data.push([fmtDate(m.date), m.transaction_no||'', m.category||'',
                       m.type||'', m.description||'', m.recette||0, m.depense||0, m.frais||0, running]);
        });
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');
        XLSX.writeFile(wb, `MyCaisse_${stamp}.xlsx`);
        toast('✅ Excel exporté', 'success');
    } else if (format === 'csv') {
        let csv = 'Date,N° Transaction,Catégorie,Type,Description,Recettes,Dépenses,Frais,Solde\n';
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
            csv += [fmtDate(m.date), m.transaction_no||'', m.category||'',
                    m.type||'', m.description||'', m.recette||0, m.depense||0, m.frais||0, running]
                    .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',') + '\n';
        });
        downloadBlob(csv, `MyCaisse_${stamp}.csv`, 'text/csv;charset=utf-8');
        toast('✅ CSV exporté', 'success');
    } else if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 297, 22, 'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(16); doc.setFont(undefined,'bold');
        doc.text('MY CAISSE PRESTAPAY', 148, 12, { align:'center' });
        doc.setFontSize(9); doc.setFont(undefined,'normal');
        doc.text(`Du ${from||'N/A'} au ${to||'N/A'}`, 148, 18, { align:'center' });
        doc.setTextColor(30,58,138); doc.setFontSize(10);
        doc.text(`Solde début: ${fmtMoney(opening)}`, 15, 30);
        doc.text(`Recettes: ${fmtMoney(tRec)}`, 75, 30);
        doc.text(`Dépenses: ${fmtMoney(tDep)}`, 135, 30);
        doc.text(`Frais: ${fmtMoney(tFrais)}`, 190, 30);
        doc.text(`Solde fin: ${fmtMoney(finalBal)}`, 245, 30);
        let running = opening;
        doc.autoTable({
            startY: 36,
            head: [['Date','N°','Catégorie','Type','Description','Recettes','Dépenses','Frais','Solde']],
            body: movements.map(m => {
                running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
                return [fmtDate(m.date), m.transaction_no||'', m.category||'',
                        m.type||'', m.description||'', m.recette?fmtMoney(m.recette):'',
                        m.depense?fmtMoney(m.depense):'', m.frais?fmtMoney(m.frais):'', fmtMoney(running)];
            }),
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [124,58,237], textColor: 255 },
            columnStyles: {
                5: { halign:'right', textColor:[5,150,105] },
                6: { halign:'right', textColor:[220,38,38] },
                7: { halign:'right', textColor:[217,119,6] },
                8: { halign:'right', fontStyle:'bold' }
            }
        });
        doc.save(`MyCaisse_${stamp}.pdf`);
        toast('✅ PDF exporté', 'success');
    } else if (format === 'word') {
        let rows = '';
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
            rows += `<tr>
                <td>${fmtDate(m.date)}</td><td>${m.transaction_no||''}</td>
                <td>${m.category||''}</td><td>${m.type||''}</td>
                <td>${m.description||''}</td>
                <td style="text-align:right;color:#059669">${m.recette?fmtMoney(m.recette):''}</td>
                <td style="text-align:right;color:#DC2626">${m.depense?fmtMoney(m.depense):''}</td>
                <td style="text-align:right;color:#D97706">${m.frais?fmtMoney(m.frais):''}</td>
                <td style="text-align:right;font-weight:bold">${fmtMoney(running)}</td>
            </tr>`;
        });
        const html = `<html><head><meta charset="utf-8"><style>
            body { font-family: Arial; }
            h1 { color:#7C3AED; text-align:center; }
            table { width:100%; border-collapse:collapse; font-size:10px; }
            th { background:#7C3AED; color:#fff; padding:6px; }
            td { border:1px solid #ccc; padding:4px; }
        </style></head><body>
        <h1>MY CAISSE PRESTAPAY</h1>
        <p style="text-align:center">Du ${from||''} au ${to||''}</p>
        <p><b>Solde début:</b> ${fmtMoney(opening)} |
           <b>Recettes:</b> ${fmtMoney(tRec)} |
           <b>Dépenses:</b> ${fmtMoney(tDep)} |
           <b>Frais:</b> ${fmtMoney(tFrais)} |
           <b>Solde fin:</b> ${fmtMoney(finalBal)}</p>
        <table><thead><tr>
            <th>Date</th><th>N°</th><th>Catégorie</th><th>Type</th>
            <th>Description</th><th>Recettes</th><th>Dépenses</th><th>Frais</th><th>Solde</th>
        </tr></thead><tbody>${rows}</tbody></table>
        </body></html>`;
        downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }),
                     `MyCaisse_${stamp}.doc`);
        toast('✅ Word exporté', 'success');
    }
}

function downloadBlob(data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* =========================================================
   IMPORT (CSV / JSON / Excel / PDF)
   ========================================================= */
function handleUpload(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try { await importCSV(e.target.result); }
            catch (err) { toast('❌ ' + err.message, 'error'); }
        };
        reader.readAsText(file);
    } else if (name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try { await importJSON(e.target.result); }
            catch (err) { toast('❌ ' + err.message, 'error'); }
        };
        reader.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try { await importExcel(e.target.result); }
            catch (err) { console.error(err); toast('❌ Excel: ' + err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
    } else if (name.endsWith('.pdf')) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try { await importPDF(e.target.result); }
            catch (err) { console.error(err); toast('❌ PDF: ' + err.message, 'error'); }
        };
        reader.readAsArrayBuffer(file);
    } else {
        toast('⚠️ Formats acceptés : CSV, JSON, Excel, PDF', 'warn');
    }
}

async function importCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('⚠️ CSV vide', 'warn'); return; }
    const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const splitLine = (line) => {
        const result = []; let current = '', inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
                if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
                else inQuotes = !inQuotes;
            } else if (ch === delim && !inQuotes) { result.push(current); current = ''; }
            else current += ch;
        }
        result.push(current);
        return result.map(c => c.trim().replace(/^"|"$/g, ''));
    };
    const headers = splitLine(lines[0]).map(h => h.toLowerCase());
    const idxDate = headers.findIndex(h => h.includes('date'));
    const idxTrNo = headers.findIndex(h => h.includes('transaction') || h.includes('n°'));
    const idxCat  = headers.findIndex(h => h.includes('catégor') || h.includes('categor'));
    const idxType = headers.findIndex(h => h === 'type' || h.includes('type'));
    const idxDesc = headers.findIndex(h => h.includes('description') || h.includes('libell'));
    const idxRec  = headers.findIndex(h => h.includes('recette') || h.includes('income'));
    const idxDep  = headers.findIndex(h => h.includes('dépense') || h.includes('depense') || h.includes('expense'));
    const idxFrais = headers.findIndex(h => h.includes('frais'));

    let imported = 0, skipped = 0;
    for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (!cols.length) continue;
        const dateStr = parseDate(cols[idxDate]);
        if (!dateStr) { skipped++; continue; }
        const amountRec = idxRec >= 0 ? parseAmount(cols[idxRec]) : 0;
        const amountDep = idxDep >= 0 ? parseAmount(cols[idxDep]) : 0;
        const amountFrais = idxFrais >= 0 ? parseAmount(cols[idxFrais]) : 0;
        if (amountRec === 0 && amountDep === 0) { skipped++; continue; }
        const split = splitCategoryType(
            idxCat  >= 0 ? cols[idxCat]  : '',
            idxType >= 0 ? cols[idxType] : '',
            idxDesc >= 0 ? cols[idxDesc] : ''
        );
        await apiCall('addMovement', {
            date: dateStr, transaction_no: idxTrNo >= 0 ? cols[idxTrNo] : '',
            category: split.category, type: split.type, description: split.description,
            recette: amountRec, depense: amountDep, frais: amountFrais
        });
        imported++;
    }
    toast(`✅ Importés : ${imported} | Ignorés : ${skipped}`, 'success');
    refreshMovements(); refreshBanner();
}

async function importExcel(arrayBuffer) {
    const data = new Uint8Array(arrayBuffer);
    const workbook = XLSX.read(data, { type: 'array' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    if (rows.length < 2) { toast('⚠️ Excel vide', 'warn'); return; }

    let headerRow = 0;
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
        const first = String(rows[i][0] || '').toLowerCase();
        const joined = rows[i].map(c => String(c).toLowerCase()).join('|');
        if (first.includes('date') || (joined.includes('date') && joined.includes('transaction'))) {
            headerRow = i; break;
        }
    }
    const headers = rows[headerRow].map(h => String(h).toLowerCase().trim());
    const idxDate = headers.findIndex(h => h.includes('date'));
    const idxTrNo = headers.findIndex(h => h.includes('transaction') || h.includes('n°'));
    const idxCat  = headers.findIndex(h => h.includes('catégor') || h.includes('categor'));
    const idxType = headers.findIndex(h => h === 'type' || h.includes('type'));
    const idxDesc = headers.findIndex(h => h.includes('description') || h.includes('libell'));
    const idxRec  = headers.findIndex(h => h.includes('recette') || h.includes('income'));
    const idxDep  = headers.findIndex(h => h.includes('dépense') || h.includes('depense') || h.includes('expense'));
    const idxFrais = headers.findIndex(h => h.includes('frais'));

    let imported = 0, skipped = 0;
    for (let i = headerRow + 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row || row.length === 0) continue;
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell.includes('total') || firstCell.includes('solde début') ||
            firstCell.includes('solde fin')) continue;
        const dateStr = parseDate(row[idxDate]);
        if (!dateStr) { skipped++; continue; }
        const amountRec = idxRec >= 0 ? parseAmount(row[idxRec]) : 0;
        const amountDep = idxDep >= 0 ? parseAmount(row[idxDep]) : 0;
        const amountFrais = idxFrais >= 0 ? parseAmount(row[idxFrais]) : 0;
        if (amountRec === 0 && amountDep === 0) { skipped++; continue; }
        const split = splitCategoryType(
            idxCat  >= 0 ? row[idxCat]  : '',
            idxType >= 0 ? row[idxType] : '',
            idxDesc >= 0 ? row[idxDesc] : ''
        );
        await apiCall('addMovement', {
            date: dateStr,
            transaction_no: idxTrNo >= 0 ? String(row[idxTrNo] || '') : '',
            category: split.category, type: split.type, description: split.description,
            recette: amountRec, depense: amountDep, frais: amountFrais
        });
        imported++;
    }
    toast(`✅ Importés : ${imported} | Ignorés : ${skipped}`, 'success');
    refreshMovements(); refreshBanner();
}

async function importPDF(arrayBuffer) {
    if (!window.pdfjsLib) { toast('❌ Bibliothèque PDF non chargée', 'error'); return; }
    pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    toast(`📄 Lecture PDF (${pdf.numPages} pages)...`, 'warn');
    let fullText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const content = await page.getTextContent();
        fullText += content.items.map(i => i.str).join(' ') + '\n';
    }
    const movements = parsePDFMovements(fullText);
    if (!movements.length) { toast('⚠️ Aucun mouvement détecté', 'warn'); return; }
    let imported = 0;
    for (const m of movements) {
        const res = await apiCall('addMovement', m);
        if (res.success) imported++;
    }
    toast(`✅ ${imported} mouvement(s) importé(s) du PDF`, 'success');
    refreshMovements(); refreshBanner();
}

function parsePDFMovements(text) {
    const movements = [];
    const lines = text.split(/(?=\d{2}\/\d{2}\/\d{4})/g);
    for (const chunk of lines) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        const dateMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!dateMatch) continue;
        const isoDate = `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`;
        const trMatch = trimmed.match(/(TR\d+)/);
        const trNo = trMatch ? trMatch[1] : '';
        let rest = trimmed.replace(/^\d{2}\/\d{2}\/\d{4}\s*/, '').replace(/TR\d+\s*/, '');
        const numbers = rest.match(/[\d\s]+[.,]\d{2}/g) || [];
        if (!numbers.length) continue;
        const amountStr = numbers.length >= 2 ? numbers[numbers.length - 2] : numbers[0];
        const amount = parseAmount(amountStr);
        if (amount <= 0) continue;
        let desc = rest.replace(/[\d\s]+[.,]\d{2}/g, ' ').replace(/\s+/g, ' ').trim();
        const split = splitCategoryType('', '', desc);
        const isIncome = /AVANCE|RECETTES|VENTES|DON|REVENU/i.test(split.category);
        movements.push({
            date: isoDate, transaction_no: trNo,
            category: split.category, type: split.type, description: split.description,
            recette: isIncome ? amount : 0, depense: isIncome ? 0 : amount, frais: 0
        });
    }
    return movements;
}

async function importJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
        for (const m of data) {
            const split = splitCategoryType(m.category, m.type, m.description);
            await apiCall('addMovement', {
                date: m.date, transaction_no: m.transaction_no || '',
                category: split.category, type: split.type, description: split.description,
                recette: Number(m.recette) || 0, depense: Number(m.depense) || 0,
                frais: Number(m.frais) || 0
            });
        }
        toast(`✅ ${data.length} importé(s)`, 'success');
        refreshMovements();
    }
}

/* =========================================================
   HELPERS IMPORT
   ========================================================= */
function splitCategoryType(rawCategory, rawType, rawDescription) {
    let category = String(rawCategory || '').trim().toUpperCase();
    let type     = String(rawType || '').trim().toUpperCase();
    let desc     = String(rawDescription || '').trim();
    const DASH = /\s*[—–]\s*|\s+-\s+/;
    if (category && !type && DASH.test(category)) {
        const parts = category.split(DASH);
        category = parts[0].trim();
        type = parts.slice(1).join(' — ').trim();
    } else if (desc && category && desc.toUpperCase().startsWith(category)) {
        const pattern = new RegExp(
            '^' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
            + '\\s*[—–-]?\\s*'
            + (type ? type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '')
            + '\\s*', 'i'
        );
        desc = desc.replace(pattern, '').trim();
    }
    if (desc && DASH.test(desc) && !type) {
        const descParts = desc.split(DASH);
        if (descParts.length >= 2 && descParts[1].length < 60) {
            const possibleCat = descParts[0].trim().toUpperCase();
            const possibleTyp = descParts[1].trim().toUpperCase();
            if (possibleCat.length > 3 && possibleTyp.length > 2) {
                if (!category) category = possibleCat;
                if (!type)     type     = possibleTyp;
                desc = descParts.slice(2).join(' — ').trim();
            }
        }
    }
    desc = desc.replace(/\s+/g, ' ').replace(/^[—–\-,\s]+/, '').replace(/[—–\-,\s]+$/, '').trim();
    return { category, type, description: desc };
}

function parseDate(v) {
    if (!v && v !== 0) return '';
    if (typeof v === 'number' && v > 20000 && v < 60000) {
        const ms = (v - 25569) * 86400 * 1000;
        return new Date(ms).toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const match = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (match) {
        let [_, d, m, y] = match;
        if (y.length === 2) y = '20' + y;
        return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed)) return parsed.toISOString().slice(0, 10);
    return '';
}

function parseAmount(v) {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    let s = String(v).replace(/\s/g, '').replace(/[MRU€$£]/gi, '').trim();
    if (s.includes(',') && s.includes('.')) s = s.replace(/,/g, '');
    else if (s.includes(',') && !s.includes('.')) s = s.replace(',', '.');
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
}

/* =========================================================
   UTILISATEURS
   ========================================================= */
async function refreshUsersTable() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    const res = await apiCall('getUsers');
    if (!res.success) { tbody.innerHTML = '<tr><td colspan="6">Admin uniquement</td></tr>'; return; }
    tbody.innerHTML = '';
    (res.users || []).forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td><strong>${u.username}</strong></td>
            <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role}</span></td>
            <td>${(u.permissions||[]).join(', ')}</td>
            <td><span class="badge ${u.active?'badge-active':'badge-inactive'}">${u.active?'Actif':'Inactif'}</span></td>
            <td>
                <button class="btn btn-gray" data-edit-user="${u.id}">✏️</button>
                <button class="btn btn-danger" data-del-user="${u.id}">🗑</button>
            </td>`;
        tbody.appendChild(tr);
    });
}

function openUserModal(user) {
    const isNew = !user;
    user = user || { username:'', password:'', role:'user', permissions:['view'], active:true };
    document.getElementById('userModalTitle').textContent = isNew ? 'Nouvel Utilisateur' : 'Modifier Utilisateur';
    document.getElementById('inpUserName').value = user.username;
    document.getElementById('inpUserPass').value = user.password || '';
    document.getElementById('selUserRole').value = user.role;
    document.getElementById('chkActive').checked = user.active;
    document.querySelectorAll('.perm-check').forEach(cb => {
        cb.checked = (user.permissions||[]).includes(cb.value);
    });
    document.getElementById('userModal').dataset.userId = isNew ? '' : user.id;
    document.getElementById('userModal').classList.add('open');
}

async function saveUser() {
    const modal = document.getElementById('userModal');
    const id = modal.dataset.userId;
    const perms = [...document.querySelectorAll('.perm-check:checked')].map(c => c.value);
    const payload = {
        username: document.getElementById('inpUserName').value.trim().toUpperCase(),
        password: document.getElementById('inpUserPass').value,
        role: document.getElementById('selUserRole').value,
        permissions: perms,
        active: document.getElementById('chkActive').checked
    };
    if (!payload.username || !payload.password) {
        toast('⚠️ Nom d\'utilisateur et mot de passe requis', 'warn'); return;
    }
    let res;
    if (id) { payload.id = id; res = await apiCall('updateUser', payload); }
    else res = await apiCall('addUser', payload);
    if (res.success) {
        toast('✅ Utilisateur enregistré', 'success');
        modal.classList.remove('open');
        refreshUsersTable();
    } else toast('❌ ' + (res.error || 'Échec'), 'error');
}

/* =========================================================
   INITIALISATION
   ========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    if (!SESSION) return;
    renderHeader();
    clearForm();
    document.getElementById('inpDate').value = toFRDate(todayISO());
    document.getElementById('filterFrom').value = toFRDate(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
    document.getElementById('filterTo').value = toFRDate(todayISO());
    document.getElementById('reportMonth').value = new Date().toISOString().slice(0,7);

    await refreshCategorySelect();
    await refreshMovements();
    await refreshUsersTable();
    await refreshManageTables();

    document.getElementById('opTypeGroup').addEventListener('change', refreshCategorySelect);
    document.getElementById('selCategory').addEventListener('change', refreshTypeSelect);
    document.getElementById('btnSave').addEventListener('click', saveMovement);
    document.getElementById('btnClear').addEventListener('click', clearForm);
    document.getElementById('btnFilter').addEventListener('click', refreshMovements);
    document.getElementById('searchInput').addEventListener('input', refreshMovements);

    document.querySelectorAll('[data-export]').forEach(b =>
        b.addEventListener('click', () => exportData(b.dataset.export)));

    document.getElementById('fileInput').addEventListener('change', e => {
        if (e.target.files[0]) handleUpload(e.target.files[0]);
    });

    document.getElementById('movTbody').addEventListener('click', async (e) => {
        const editId = e.target.dataset.edit;
        const delId  = e.target.dataset.del;
        if (editId) await editMovement(Number(editId));
        if (delId && confirm('Supprimer ce mouvement ?')) {
            await apiCall('deleteMovement', { id: Number(delId) });
            toast('✅ Supprimé', 'success');
            refreshMovements();
        }
    });

    document.getElementById('usersTbody')?.addEventListener('click', async (e) => {
        const editId = e.target.dataset.editUser;
        const delId  = e.target.dataset.delUser;
        if (editId) {
            const res = await apiCall('getUsers');
            openUserModal((res.users||[]).find(u => String(u.id) === String(editId)));
        }
        if (delId && confirm('Supprimer cet utilisateur ?')) {
            await apiCall('deleteUser', { id: Number(delId) });
            toast('✅ Supprimé', 'success');
            refreshUsersTable();
        }
    });
    document.getElementById('btnAddUser')?.addEventListener('click', () => openUserModal(null));
    document.getElementById('btnSaveUser')?.addEventListener('click', saveUser);
    document.getElementById('userModalClose')?.addEventListener('click', () =>
        document.getElementById('userModal').classList.remove('open'));

    document.getElementById('btnAddCategory')?.addEventListener('click', addCategory);
    document.getElementById('btnAddType')?.addEventListener('click', addType);
    document.getElementById('typeParentCat')?.addEventListener('change', refreshTypesTable);

    document.getElementById('catTbody')?.addEventListener('click', (e) => {
        const id = e.target.dataset.delCat;
        const name = e.target.dataset.catName;
        if (id) deleteCategory(Number(id), name);
    });
    document.getElementById('typeTbody')?.addEventListener('click', (e) => {
        const id = e.target.dataset.delType;
        if (id) deleteType(Number(id));
    });

    document.getElementById('btnGenerateReport')?.addEventListener('click', generateReport);
    document.getElementById('btnReportExcel')?.addEventListener('click', exportReportExcel);
    document.getElementById('btnReportPDF')?.addEventListener('click', exportReportPDF);
    document.getElementById('btnSaveClosing')?.addEventListener('click', saveClosingAsOpening);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    document.getElementById('btnLogout').addEventListener('click', () => {
        if (confirm('Se déconnecter ?')) {
            localStorage.removeItem(CONFIG.SESSION_KEY);
            sessionStorage.removeItem('mycaisse_token');
            window.location.href = 'index.html';
        }
    });
});
