/* =========================================================
   MY CAISSE PRESTAPAY — Application Logic v2.4 (FINAL)
   ========================================================= */

const SESSION = (() => {
    const raw = localStorage.getItem(CONFIG.SESSION_KEY);
    if (!raw) { window.location.href = 'index.html'; return null; }
    try { return JSON.parse(raw); }
    catch (e) { localStorage.removeItem(CONFIG.SESSION_KEY); window.location.href = 'index.html'; return null; }
})();

function hasPerm(p) {
    if (!SESSION) return false;
    if (SESSION.role === 'admin') return true;
    if (SESSION.permissions?.includes('all')) return true;
    return SESSION.permissions?.includes(p) || false;
}

const fmtMoney = (v) => {
    const n = Number(v || 0);
    return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + CONFIG.CURRENCY;
};
const fmtDate = (s) => {
    if (!s) return '';
    const d = new Date(s);
    if (isNaN(d)) return s;
    return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear();
};
const todayISO = () => new Date().toISOString().slice(0,10);
const isoToFR = (iso) => { if (!iso) return ''; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; };

function toast(msg, type='') {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className='toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.className = 'toast ' + type, 3200);
}

/* =========================================================
   OPENING BALANCE — localStorage
   ========================================================= */
function getOpeningBalance() {
    return Number(localStorage.getItem('mycaisse_opening_balance') || 0);
}
function setOpeningBalance(val) {
    localStorage.setItem('mycaisse_opening_balance', String(Number(val) || 0));
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
    params.append('_t', Date.now() + '_' + Math.random().toString(36).slice(2));
    Object.keys(payload).forEach(k => {
        const v = payload[k];
        if (v === null || v === undefined || typeof v === 'object') return;
        params.append(k, String(v));
    });
    const res = await fetch(CONFIG.API_URL + '?' + params.toString(), {
        method: 'GET', redirect: 'follow', cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
    });
    return res.json();
}

/* =========================================================
   LOCAL DB
   ========================================================= */
const LocalDB = {
    _key: 'mycaisse_data_v3', _data: null,
    _load() {
        if (this._data) return this._data;
        const raw = localStorage.getItem(this._key);
        this._data = raw ? JSON.parse(raw) : this._seed();
        return this._data;
    },
    _save() { localStorage.setItem(this._key, JSON.stringify(this._data)); },
    _seed() {
        const data = {
            categories: (CONFIG.DEFAULT_CATEGORIES || []).map((c,i) => ({ id: i+1, name: c.name, kind: c.kind, position: i })),
            types: [], movements: [], settings: { opening_balance: 0 }
        };
        localStorage.setItem(this._key, JSON.stringify(data));
        return data;
    },
    getCategories(kind) {
        const d = this._load();
        return kind ? d.categories.filter(c => c.kind === kind) : d.categories;
    },
    getTypes(catId) { return this._load().types.filter(t => String(t.category_id) === String(catId)); },
    addCategory(name, kind) {
        const d = this._load();
        if (d.categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.kind === kind)) return null;
        const c = { id: Date.now(), name: name.toUpperCase(), kind, position: d.categories.length };
        d.categories.push(c); this._save(); return c;
    },
    deleteCategory(id) { const d = this._load(); d.categories = d.categories.filter(c => c.id !== id); d.types = d.types.filter(t => String(t.category_id) !== String(id)); this._save(); },
    addType(catId, name) { const d = this._load(); const t = { id: Date.now(), category_id: catId, name: name.toUpperCase() }; d.types.push(t); this._save(); return t; },
    deleteType(id) { const d = this._load(); d.types = d.types.filter(t => t.id !== id); this._save(); },
    getMovements(from, to) {
        const d = this._load();
        return d.movements.filter(m => (!from || m.date >= from) && (!to || m.date <= to))
            .sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
    },
    addMovement(m) { const d = this._load(); m.id = Date.now(); d.movements.push(m); this._save(); return m; },
    updateMovement(id, m) { const d = this._load(); const i = d.movements.findIndex(x => x.id === id); if (i >= 0) { d.movements[i] = { ...d.movements[i], ...m }; this._save(); } },
    deleteMovement(id) { const d = this._load(); d.movements = d.movements.filter(m => m.id !== id); this._save(); },
    deleteAllMovements() { const d = this._load(); d.movements = []; this._save(); }
};

function localApi(action, payload) {
    switch(action) {
        case 'login': {
            const u = CONFIG.LOCAL_USERS[payload.username?.toUpperCase()];
            if (u && u.password === payload.password)
                return { success: true, user: { username: payload.username.toUpperCase(), role: u.role, permissions: u.permissions }, token: 'local_' + Date.now() };
            return { success: false, error: 'Mot de passe incorrect' };
        }
        case 'getCategories': return { success: true, categories: LocalDB.getCategories() };
        case 'addCategory': { const c = LocalDB.addCategory(payload.name, payload.kind); return c ? { success: true, id: c.id } : { success: false, error: 'Existe déjà' }; }
        case 'deleteCategory': LocalDB.deleteCategory(payload.id); return { success: true };
        case 'getTypes': return { success: true, types: LocalDB.getTypes(payload.category_id) };
        case 'addType': { const t = LocalDB.addType(payload.category_id, payload.name); return { success: true, id: t.id }; }
        case 'deleteType': LocalDB.deleteType(payload.id); return { success: true };
        case 'getMovements': return { success: true, movements: LocalDB.getMovements(payload.from, payload.to) };
        case 'addMovement': return { success: true, id: LocalDB.addMovement(payload).id };
        case 'updateMovement': LocalDB.updateMovement(payload.id, payload); return { success: true };
        case 'deleteMovement': LocalDB.deleteMovement(payload.id); return { success: true };
        case 'deleteAllMovements': LocalDB.deleteAllMovements(); return { success: true, deleted: 0 };
        case 'getSetting': return { success: true, value: getOpeningBalance() };
        case 'setSetting': setOpeningBalance(payload.value); return { success: true };
        case 'getUsers': return { success: true, users: [] };
        case 'addUser': return { success: true, info: 'Mode local : éditez config.js' };
        case 'updateUser': return { success: true, info: 'Mode local : éditez config.js' };
        case 'deleteUser': return { success: true, info: 'Mode local : éditez config.js' };
        default: return { success: false, error: 'Unknown action: ' + action };
    }
}

/* =========================================================
   HEADER
   ========================================================= */
function renderHeader() {
    document.getElementById('userName').textContent = SESSION.username;
    document.getElementById('userRole').textContent = SESSION.role === 'admin' ? 'Administrateur' : 'Utilisateur';
    document.getElementById('userAvatar').textContent = SESSION.username.charAt(0).toUpperCase();
    if (!hasPerm('manage_users') && SESSION.role !== 'admin')
        document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display='none');
    if (!hasPerm('add') && SESSION.role !== 'admin')
        document.querySelectorAll('[data-add-only]').forEach(el => el.style.display='none');
    if (!hasPerm('export') && SESSION.role !== 'admin')
        document.querySelectorAll('[data-export]').forEach(el => el.style.display='none');
}

/* =========================================================
   BANNER
   ========================================================= */
async function refreshBanner() {
    const opening = getOpeningBalance();
    const mvtRes = await apiCall('getMovements');
    const mvts = mvtRes.movements || [];

    const recettes = mvts.reduce((s,m) => s + Number(m.recette || 0), 0);
    const depenses = mvts.reduce((s,m) => s + Number(m.depense || 0), 0);
    const frais    = mvts.reduce((s,m) => s + Number(m.frais   || 0), 0);
    const closing  = opening + recettes - depenses - frais;

    document.getElementById('statOpening').textContent  = fmtMoney(opening);
    document.getElementById('statRecettes').textContent = fmtMoney(recettes);
    document.getElementById('statDepenses').textContent = fmtMoney(depenses);
    document.getElementById('statFrais').textContent    = fmtMoney(frais);
    document.getElementById('statFinal').textContent    = fmtMoney(closing);
}

/* =========================================================
   SELECTS
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
   MOVEMENTS
   ========================================================= */
let CURRENT_EDIT_ID = null;

async function refreshMovements() {
    const isoFrom = document.getElementById('filterFrom').value || null;
    const isoTo   = document.getElementById('filterTo').value || null;
    const q = document.getElementById('searchInput').value.trim().toLowerCase();

    const res = await apiCall('getMovements', { from: isoFrom, to: isoTo });
    let list = res.movements || [];
    if (q) list = list.filter(m => JSON.stringify(m).toLowerCase().includes(q));

    const tbody = document.getElementById('movTbody');
    tbody.innerHTML = '';

    let running = getOpeningBalance();
    if (isoFrom) {
        const allRes = await apiCall('getMovements');
        (allRes.movements || []).filter(m => m.date < isoFrom)
            .forEach(m => running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0));
    }

    list.forEach(m => {
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
    document.getElementById('inpDate').value = todayISO();
    const title = document.getElementById('formTitle');
    title.textContent = 'Nouveau Mouvement';
    title.style.background = '';
    title.style.color = '';
    const btn = document.getElementById('btnSave');
    btn.textContent = '➕ Ajouter';
    btn.style.background = '';
}

async function saveMovement() {
    const isoDate = document.getElementById('inpDate').value;
    const trNo = document.getElementById('inpTransaction').value.trim();
    const desc = document.getElementById('inpDescription').value.trim();
    const amount = parseFloat(document.getElementById('inpAmount').value.replace(',', '.')) || 0;
    const frais = parseFloat((document.getElementById('inpFrais')?.value || '0').replace(',', '.')) || 0;
    const catSel = document.getElementById('selCategory');
    const typeSel = document.getElementById('selType');
    const catName = catSel.options[catSel.selectedIndex]?.dataset?.name || '';
    const typeName = typeSel.options[typeSel.selectedIndex]?.dataset?.name || '';
    const type = document.querySelector('input[name="opType"]:checked').value;

    if (!isoDate) { toast('⚠️ Sélectionnez une date', 'warn'); return; }
    if (amount <= 0) { toast('⚠️ Montant > 0', 'warn'); return; }

    const mvt = {
        date: isoDate, transaction_no: trNo, category: catName, type: typeName, description: desc,
        recette: type === 'Recette' ? amount : 0,
        depense: type === 'Dépense' ? amount : 0,
        frais
    };

    if (CURRENT_EDIT_ID) {
        mvt.id = CURRENT_EDIT_ID;
        await apiCall('updateMovement', mvt);
        toast('✅ Mouvement MODIFIÉ avec succès', 'success');
    } else {
        await apiCall('addMovement', mvt);
        toast('✅ Mouvement AJOUTÉ avec succès', 'success');
    }
    clearForm(); refreshMovements();
}

/* ✅ Edit Movement — Toggle: click again on same ✏️ to cancel */
async function editMovement(id) {
    // If already editing this movement → cancel edit mode
    if (CURRENT_EDIT_ID === id) {
        clearForm();
        toast('❌ Modification annulée', 'warn');
        return;
    }

    const res = await apiCall('getMovements');
    const m = (res.movements || []).find(x => String(x.id) === String(id));
    if (!m) return;

    // Reset form BEFORE filling with new values (prevents mixing)
    clearForm();

    CURRENT_EDIT_ID = id;
    document.getElementById('inpDate').value = m.date;
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

    // Switch to orange edit mode
    document.getElementById('formTitle').textContent = '✏️ Modifier le Mouvement';
    document.getElementById('formTitle').style.background = 'linear-gradient(135deg,#F59E0B,#D97706)';
    document.getElementById('formTitle').style.color = '#fff';
    document.getElementById('btnSave').textContent = '💾 Enregistrer les Modifications';
    document.getElementById('btnSave').style.background = 'linear-gradient(135deg,#F59E0B,#D97706)';
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast('✏️ Mode Modification activé — Cliquez à nouveau sur ✏️ pour annuler', 'warn');
}

/* =========================================================
   CATEGORIES & TYPES
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

    // ✅ Fill export category filter (single-select with "All" option)
    const expSel = document.getElementById('exportCategoryFilter');
    if (expSel) {
        const currentVal = expSel.value;
        expSel.innerHTML = '<option value="">📂 Toutes catégories</option>';
        cats.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.name;
            opt.textContent = c.name + ' (' + c.kind + ')';
            expSel.appendChild(opt);
        });
        expSel.value = currentVal;
    }
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
    if (!name) { toast('⚠️ Entrez le nom', 'warn'); return; }
    const res = await apiCall('addCategory', { name, kind });
    if (res.success) {
        toast('✅ Catégorie ajoutée', 'success');
        document.getElementById('newCatName').value = '';
        refreshManageTables(); refreshCategorySelect();
    } else toast('❌ ' + (res.error || 'Échec'), 'error');
}

async function deleteCategory(id, name) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    const res = await apiCall('deleteCategory', { id });
    if (res.success) { toast('✅ Supprimée', 'success'); refreshManageTables(); refreshCategorySelect(); }
}

async function addType() {
    const catId = document.getElementById('typeParentCat').value;
    const name = document.getElementById('newTypeName').value.trim();
    if (!name) { toast('⚠️ Entrez le nom', 'warn'); return; }
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
    if (res.success) { toast('✅ Supprimé', 'success'); refreshTypesTable(); }
}

/* =========================================================
   MONTHLY REPORT
   ========================================================= */
let CURRENT_REPORT = null;

async function generateReport() {
    const month = document.getElementById('reportMonth').value;
    if (!month) { toast('⚠️ Sélectionnez un mois', 'warn'); return; }
    const selectedCats = Array.from(document.getElementById('reportCategories').selectedOptions).map(o => o.value);

    const res = await apiCall('getMovements');
    const all = res.movements || [];
    const filtered = all.filter(m => m.date && m.date.startsWith(month));
    let finalList = selectedCats.length > 0
        ? filtered.filter(m => selectedCats.includes(String(m.category).toUpperCase()))
        : filtered;

    const before = all.filter(m => m.date < month + '-01');
    let opening = getOpeningBalance();
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
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
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
                <thead><tr><th>CATÉGORIE</th><th>TYPE</th><th style="text-align:right">MONTANT</th></tr></thead><tbody>`;

    Object.keys(r.grouped).sort().forEach(cat => {
        const g = r.grouped[cat];
        html += `<tr style="background:#EDE9FE;font-weight:700;color:#6D28D9">
                    <td colspan="2">${cat}</td>
                    <td style="text-align:right">${fmtMoney(g.total)}</td>
                 </tr>`;
        Object.keys(g.types).sort().forEach(typ => {
            html += `<tr><td style="padding-left:30px">— ${typ}</td><td></td>
                        <td style="text-align:right">${fmtMoney(g.types[typ])}</td></tr>`;
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

async function exportReportExcel() {
    if (!CURRENT_REPORT) { toast('⚠️ Générez d\'abord', 'warn'); return; }
    const r = CURRENT_REPORT;
    const [y, m] = r.month.split('-');
    const data = [
        ['MY CAISSE PRESTAPAY'], ['DÉPENSE EXPLOITATION — ' + m + '-' + y], [],
        ['Solde début', r.opening], ['Total Recettes', r.totalRec],
        ['Total Dépenses', r.totalDep], ['Total Frais', r.totalFrais],
        ['Solde fin', r.closing], [],
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
    XLSX.writeFile(wb, `Rapport_${m}-${y}.xlsx`);
    toast('✅ Excel exporté', 'success');
}

async function exportReportPDF() {
    if (!CURRENT_REPORT) { toast('⚠️ Générez d\'abord', 'warn'); return; }
    const r = CURRENT_REPORT;
    const [y, m] = r.month.split('-');
    const monthNames = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const monthLabel = monthNames[parseInt(m)-1] + ' ' + y;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(18); doc.setFont(undefined, 'bold');
    doc.text('MY CAISSE PRESTAPAY', 105, 13, { align:'center' });
    doc.setFontSize(11); doc.setFont(undefined, 'normal');
    doc.text('DÉPENSE EXPLOITATION — ' + monthLabel.toUpperCase(), 105, 22, { align:'center' });

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
        rows.push([{ content: cat, colSpan: 2, styles: { fontStyle:'bold', fillColor:[237,233,254], textColor:[109,40,217] } },
                   { content: fmtMoney(g.total), styles: { halign:'right', fontStyle:'bold', fillColor:[237,233,254], textColor:[109,40,217] } }]);
        Object.keys(g.types).sort().forEach(typ => {
            rows.push(['  — ' + typ, '', { content: fmtMoney(g.types[typ]), styles: { halign:'right' } }]);
        });
    });
    rows.push([{ content: 'TOTAL DÉPENSES', colSpan: 2, styles: { fontStyle:'bold', fillColor:[30,58,138], textColor:[255,255,255] } },
               { content: fmtMoney(r.totalDep), styles: { halign:'right', fontStyle:'bold', fillColor:[30,58,138], textColor:[255,255,255] } }]);
    doc.autoTable({
        startY: y0 + 32,
        head: [['CATÉGORIE', 'TYPE', 'MONTANT (MRU)']],
        body: rows,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [124,58,237], textColor: 255, fontStyle:'bold' },
        theme: 'grid'
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(10); doc.setTextColor(30,58,138);
    doc.setFont(undefined,'bold');
    doc.text('Préparé par : YAHYA TALEB ABDELLAHI', 15, finalY);

    doc.save(`Rapport_${m}_${y}.pdf`);
    toast('✅ PDF exporté', 'success');
}

async function saveClosingAsOpening() {
    if (!CURRENT_REPORT) { toast('⚠️ Générez d\'abord', 'warn'); return; }
    if (!confirm(`Enregistrer ${fmtMoney(CURRENT_REPORT.closing)} comme nouveau solde début ?`)) return;
    setOpeningBalance(CURRENT_REPORT.closing);
    toast('✅ Solde début mis à jour', 'success');
    await refreshBanner();
    await refreshSettings();
    await refreshMovements();
}

/* =========================================================
   EXPORTS
   ========================================================= */
async function exportData(format) {
    const isoFrom = document.getElementById('filterFrom').value || null;
    const isoTo   = document.getElementById('filterTo').value || null;
    const res = await apiCall('getMovements', { from: isoFrom, to: isoTo });
    let movements = res.movements || [];

    // ✅ Filter by single selected category (empty = all)
    const expCatSel = document.getElementById('exportCategoryFilter');
    const selectedCat = expCatSel ? expCatSel.value : '';
    if (selectedCat) {
        movements = movements.filter(m => String(m.category).toUpperCase() === selectedCat.toUpperCase());
    }

    // Filter by movement type
    const typeFilter = document.getElementById('exportTypeFilter')?.value || 'all';
    if (typeFilter === 'Recette') movements = movements.filter(m => Number(m.recette) > 0);
    if (typeFilter === 'Dépense') movements = movements.filter(m => Number(m.depense) > 0);

    if (!movements.length) {
        toast('⚠️ Aucun mouvement à exporter avec ces filtres', 'warn');
        return;
    }

    let opening = getOpeningBalance();
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
    const fromFR = isoFrom ? isoToFR(isoFrom) : 'N/A';
    const toFR = isoTo ? isoToFR(isoTo) : 'N/A';
    const now = new Date();
    const nowFR = String(now.getDate()).padStart(2,'0') + '/' +
                  String(now.getMonth()+1).padStart(2,'0') + '/' +
                  now.getFullYear() + ' à ' +
                  String(now.getHours()).padStart(2,'0') + ':' +
                  String(now.getMinutes()).padStart(2,'0');

    // ============ PDF ============
    if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        doc.setFillColor(124, 58, 237);
        doc.rect(0, 0, 297, 32, 'F');
        doc.setTextColor(255,255,255);
        doc.setFontSize(20); doc.setFont(undefined,'bold');
        doc.text('MY CAISSE PRESTAPAY', 148, 13, { align:'center' });
        doc.setFontSize(13);
        doc.text('FICHE DES DÉPENSES PRESTAPAY', 148, 22, { align:'center' });
        doc.setFontSize(9); doc.setFont(undefined,'normal');
        doc.text(`Période : ${fromFR} → ${toFR}`, 148, 28, { align:'center' });

        doc.setTextColor(30,58,138); doc.setFontSize(10);
        doc.setFont(undefined,'bold');
        doc.text(`Solde début: ${fmtMoney(opening)}`, 15, 42);
        doc.text(`Recettes: ${fmtMoney(tRec)}`, 80, 42);
        doc.text(`Dépenses: ${fmtMoney(tDep)}`, 145, 42);
        doc.text(`Frais: ${fmtMoney(tFrais)}`, 200, 42);
        doc.text(`Solde fin: ${fmtMoney(finalBal)}`, 250, 42);

        let running = opening;
        doc.autoTable({
            startY: 48,
            head: [['Date','N°','Type','Catégorie','Type mvt','Description','Recettes','Dépenses','Frais','Solde']],
            body: movements.map(m => {
                running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
                const typeMvt = m.recette > 0 ? 'RECETTE' : 'DÉPENSE';
                return [
                    fmtDate(m.date), m.transaction_no||'', m.type || '—',
                    m.category || '', typeMvt, m.description||'',
                    m.recette?fmtMoney(m.recette):'', m.depense?fmtMoney(m.depense):'',
                    m.frais?fmtMoney(m.frais):'', fmtMoney(running)
                ];
            }),
            styles: { fontSize: 7, cellPadding: 2 },
            headStyles: { fillColor: [124,58,237], textColor: 255, fontStyle:'bold' },
            bodyStyles: { textColor: [31,27,46] },
            alternateRowStyles: { fillColor: [245,243,255] },
            columnStyles: {
                6: { halign:'right', textColor:[5,150,105] },
                7: { halign:'right', textColor:[220,38,38] },
                8: { halign:'right', textColor:[217,119,6] },
                9: { halign:'right', fontStyle:'bold', textColor:[30,58,138] }
            }
        });

        const finalY = doc.lastAutoTable.finalY + 15;
        doc.setFontSize(10); doc.setTextColor(30,58,138);
        doc.setFont(undefined,'bold');
        doc.text('Préparé par : YAHYA TALEB ABDELLAHI', 15, finalY);
        doc.setFont(undefined,'normal'); doc.setFontSize(9);
        doc.setTextColor(107,114,128);
        doc.text(`Généré le : ${nowFR}`, 15, finalY + 6);
        doc.text('My Caisse Prestapay — Version 2.4.0', 297 - 15, finalY + 6, { align:'right' });

        doc.save(`Fiche_Depenses_${stamp}.pdf`);
        toast('✅ PDF exporté', 'success');

    // ============ WORD ============
    } else if (format === 'word') {
        let rows = '', running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
            const typeMvt = m.recette > 0 ? 'RECETTE' : 'DÉPENSE';
            rows += `<tr>
                <td>${fmtDate(m.date)}</td>
                <td>${m.transaction_no||''}</td>
                <td>${typeMvt}</td>
                <td>${m.category||''}</td>
                <td>${m.type||'—'}</td>
                <td>${m.description||''}</td>
                <td style="text-align:right;color:#059669">${m.recette?fmtMoney(m.recette):''}</td>
                <td style="text-align:right;color:#DC2626">${m.depense?fmtMoney(m.depense):''}</td>
                <td style="text-align:right;color:#D97706">${m.frais?fmtMoney(m.frais):''}</td>
                <td style="text-align:right;font-weight:bold">${fmtMoney(running)}</td>
            </tr>`;
        });

        const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
                            xmlns:w="urn:schemas-microsoft-com:office:word"
                            xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8">
        <style>
            body { font-family: Arial; margin: 20px; }
            .header { background:#7C3AED; color:#fff; padding:15px; text-align:center; }
            .header h1 { margin:0; font-size:22px; }
            .header h2 { margin:8px 0 0; font-size:14px; font-weight:normal; }
            .header p { margin:5px 0 0; font-size:11px; }
            .summary { background:#F5F3FF; padding:12px; margin:15px 0; border-left:4px solid #7C3AED; }
            .summary span { margin-right:20px; font-weight:bold; }
            table { width:100%; border-collapse:collapse; font-size:10px; margin-top:10px; }
            th { background:#7C3AED; color:#fff; padding:8px 4px; text-align:left; }
            td { border:1px solid #ddd; padding:5px 4px; }
            tr:nth-child(even) { background:#FAF5FF; }
            .footer { margin-top:30px; padding-top:15px; border-top:2px solid #7C3AED; font-size:11px; }
            .footer strong { color:#7C3AED; }
        </style></head><body>

        <div class="header">
            <h1>MY CAISSE PRESTAPAY</h1>
            <h2>FICHE DES DÉPENSES PRESTAPAY</h2>
            <p>Période : ${fromFR} → ${toFR}</p>
        </div>

        <div class="summary">
            <span>Solde début : ${fmtMoney(opening)}</span>
            <span>Recettes : ${fmtMoney(tRec)}</span>
            <span>Dépenses : ${fmtMoney(tDep)}</span>
            <span>Frais : ${fmtMoney(tFrais)}</span>
            <span style="color:#7C3AED">Solde fin : ${fmtMoney(finalBal)}</span>
        </div>

        <table>
            <thead><tr>
                <th>Date</th><th>N°</th><th>Type</th><th>Catégorie</th>
                <th>Type mvt</th><th>Description</th><th>Recettes</th><th>Dépenses</th><th>Frais</th><th>Solde</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>

        <div class="footer">
            <p><strong>Préparé par :</strong> YAHYA TALEB ABDELLAHI</p>
            <p style="color:#6B7280;font-size:10px">
                Généré le : ${nowFR} — My Caisse Prestapay v2.4.0
            </p>
        </div>

        </body></html>`;

        downloadBlob(new Blob(['\ufeff', html], { type: 'application/msword' }),
                     `Fiche_Depenses_${stamp}.doc`);
        toast('✅ Word exporté', 'success');

    // ============ EXCEL ============
    } else if (format === 'excel') {
        const data = [
            ['MY CAISSE PRESTAPAY'],
            ['FICHE DES DÉPENSES PRESTAPAY'],
            ['Période', `${fromFR} → ${toFR}`],
            [],
            ['Solde début', opening, 'Recettes', tRec, 'Dépenses', tDep, 'Frais', tFrais, 'Solde fin', finalBal],
            [],
            ['Date','N°','Type','Catégorie','Type mvt','Description','Recettes','Dépenses','Frais','Solde']
        ];
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
            const typeMvt = m.recette > 0 ? 'RECETTE' : 'DÉPENSE';
            data.push([fmtDate(m.date), m.transaction_no||'', m.type||'—', m.category||'',
                       typeMvt, m.description||'', m.recette||0, m.depense||0, m.frais||0, running]);
        });
        data.push([]);
        data.push(['', '', '', '', '', 'Préparé par : YAHYA TALEB ABDELLAHI']);
        data.push(['', '', '', '', '', 'Généré le : ' + nowFR]);
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Fiche Depenses');
        XLSX.writeFile(wb, `Fiche_Depenses_${stamp}.xlsx`);
        toast('✅ Excel exporté', 'success');

    // ============ CSV ============
    } else if (format === 'csv') {
        let csv = 'Date,N°,Type,Catégorie,Type mvt,Description,Recettes,Dépenses,Frais,Solde\n';
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0) - Number(m.frais||0);
            const typeMvt = m.recette > 0 ? 'RECETTE' : 'DÉPENSE';
            csv += [fmtDate(m.date), m.transaction_no||'', m.type||'—', m.category||'', typeMvt,
                    m.description||'', m.recette||0, m.depense||0, m.frais||0, running]
                    .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',') + '\n';
        });
        csv += `\n"Préparé par : YAHYA TALEB ABDELLAHI"\n"Généré le : ${nowFR}"\n`;
        downloadBlob(csv, `Fiche_Depenses_${stamp}.csv`, 'text/csv;charset=utf-8');
        toast('✅ CSV exporté', 'success');
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
   IMPORT
   ========================================================= */
function handleUpload(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv')) {
        const r = new FileReader();
        r.onload = async (e) => { try { await importCSV(e.target.result); } catch (err) { toast('❌ ' + err.message, 'error'); } };
        r.readAsText(file);
    } else if (name.endsWith('.json')) {
        const r = new FileReader();
        r.onload = async (e) => { try { await importJSON(e.target.result); } catch (err) { toast('❌ ' + err.message, 'error'); } };
        r.readAsText(file);
    } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const r = new FileReader();
        r.onload = async (e) => { try { await importExcel(e.target.result); } catch (err) { toast('❌ Excel: ' + err.message, 'error'); } };
        r.readAsArrayBuffer(file);
    } else if (name.endsWith('.pdf')) {
        const r = new FileReader();
        r.onload = async (e) => { try { await importPDF(e.target.result); } catch (err) { toast('❌ PDF: ' + err.message, 'error'); } };
        r.readAsArrayBuffer(file);
    } else toast('⚠️ CSV, JSON, Excel, PDF seulement', 'warn');
}

async function importCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('⚠️ CSV vide', 'warn'); return; }
    const delim = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
    const splitLine = (line) => {
        const result = []; let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
            else if (ch === delim && !inQ) { result.push(cur); cur = ''; }
            else cur += ch;
        }
        result.push(cur);
        return result.map(c => c.trim().replace(/^"|"$/g, ''));
    };
    const headers = splitLine(lines[0]).map(h => h.toLowerCase());
    const idxDate = headers.findIndex(h => h.includes('date'));
    const idxTrNo = headers.findIndex(h => h.includes('transaction') || h.includes('n°'));
    const idxCat = headers.findIndex(h => h.includes('catégor') || h.includes('categor'));
    const idxType = headers.findIndex(h => h === 'type' || h.includes('type'));
    const idxDesc = headers.findIndex(h => h.includes('description') || h.includes('libell'));
    const idxRec = headers.findIndex(h => h.includes('recette') || h.includes('income'));
    const idxDep = headers.findIndex(h => h.includes('dépense') || h.includes('depense') || h.includes('expense'));
    const idxFrais = headers.findIndex(h => h.includes('frais') || h.includes('fee'));

    let imp = 0, skip = 0;
    for (let i = 1; i < lines.length; i++) {
        const cols = splitLine(lines[i]);
        if (!cols.length) continue;
        const dateStr = parseDate(cols[idxDate]);
        if (!dateStr) { skip++; continue; }
        const r = idxRec >= 0 ? parseAmount(cols[idxRec]) : 0;
        const d = idxDep >= 0 ? parseAmount(cols[idxDep]) : 0;
        const f = idxFrais >= 0 ? parseAmount(cols[idxFrais]) : 0;
        if (r === 0 && d === 0) { skip++; continue; }
        const split = splitCategoryType(idxCat >= 0 ? cols[idxCat] : '', idxType >= 0 ? cols[idxType] : '', idxDesc >= 0 ? cols[idxDesc] : '');
        try {
            await apiCall('addMovement', {
                date: dateStr, transaction_no: idxTrNo >= 0 ? cols[idxTrNo] : '',
                category: split.category, type: split.type, description: split.description,
                recette: r, depense: d, frais: f
            });
            imp++;
        } catch (e) { skip++; }
    }
    toast(`✅ Importés: ${imp} | Ignorés: ${skip}`, 'success');
    refreshMovements(); refreshBanner();
}

async function importExcel(arrayBuffer) {
    try {
        if (!window.XLSX) { toast('❌ Excel library not loaded', 'error'); return; }
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '', raw: false });
        if (rows.length < 2) { toast('⚠️ Fichier vide', 'warn'); return; }

        let headerRow = 0;
        for (let i = 0; i < Math.min(rows.length, 15); i++) {
            const joined = (rows[i] || []).map(c => String(c).toLowerCase()).join('|');
            if (joined.includes('date') && (joined.includes('transaction') || joined.includes('catégor') || joined.includes('description'))) { headerRow = i; break; }
        }
        const headers = (rows[headerRow] || []).map(h => String(h).toLowerCase().trim());
        const idxDate = headers.findIndex(h => h.includes('date'));
        const idxTrNo = headers.findIndex(h => h.includes('transaction') || h.includes('n°') || h.includes('num'));
        const idxCat = headers.findIndex(h => h.includes('catégor') || h.includes('categor'));
        const idxType = headers.findIndex(h => h === 'type' || h.includes('type'));
        const idxDesc = headers.findIndex(h => h.includes('description') || h.includes('libell') || h.includes('desc'));
        const idxRec = headers.findIndex(h => h.includes('recette') || h.includes('income') || h.includes('entrée'));
        const idxDep = headers.findIndex(h => h.includes('dépense') || h.includes('depense') || h.includes('expense') || h.includes('sortie'));
        const idxFrais = headers.findIndex(h => h.includes('frais') || h.includes('fee') || h.includes('commission'));

        if (idxDate < 0) { toast('⚠️ Colonne "Date" introuvable', 'warn'); return; }
        if (idxRec < 0 && idxDep < 0) { toast('⚠️ Colonnes "Recettes"/"Dépenses" introuvables', 'warn'); return; }

        let imp = 0, skip = 0;
        for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length === 0) continue;
            const first = String(row[0] || '').toLowerCase().trim();
            if (!first || first.includes('total') || first.includes('solde début') || first.includes('solde fin') || first.includes('sous-total')) continue;
            const dateStr = parseDate(row[idxDate]);
            if (!dateStr) { skip++; continue; }
            const r = idxRec >= 0 ? parseAmount(row[idxRec]) : 0;
            const d = idxDep >= 0 ? parseAmount(row[idxDep]) : 0;
            const f = idxFrais >= 0 ? parseAmount(row[idxFrais]) : 0;
            if (r === 0 && d === 0) { skip++; continue; }
            const split = splitCategoryType(idxCat >= 0 ? row[idxCat] : '', idxType >= 0 ? row[idxType] : '', idxDesc >= 0 ? row[idxDesc] : '');
            try {
                const res = await apiCall('addMovement', {
                    date: dateStr, transaction_no: idxTrNo >= 0 ? String(row[idxTrNo] || '').trim() : '',
                    category: split.category, type: split.type, description: split.description,
                    recette: r, depense: d, frais: f
                });
                if (res && res.success) imp++; else skip++;
            } catch (err) { console.warn('Row failed:', err); skip++; }
        }
        toast(`✅ Importés: ${imp} | Ignorés: ${skip}`, imp ? 'success' : 'warn');
        refreshMovements(); refreshBanner();
    } catch (err) {
        console.error('Excel Error:', err);
        toast('❌ Excel: ' + (err.message || 'unknown'), 'error');
    }
}

async function importPDF(arrayBuffer) {
    if (!window.pdfjsLib) { toast('❌ PDF.js non chargé', 'error'); return; }
    const workerCDNs = [
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
        'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
    ];
    let success = false, lastError = null;
    for (const url of workerCDNs) {
        try {
            console.log('🔄 Trying PDF worker:', url);
            pdfjsLib.GlobalWorkerOptions.workerSrc = url;
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer, useSystemFonts: true, disableAutoFetch: true, disableStream: true }).promise;
            console.log('✅ PDF loaded, pages:', pdf.numPages);
            toast(`📄 Lecture PDF (${pdf.numPages} pages)...`, 'warn');
            let fullText = '';
            for (let p = 1; p <= pdf.numPages; p++) {
                const page = await pdf.getPage(p);
                const content = await page.getTextContent();
                fullText += content.items.map(i => i.str).join(' ').replace(/\s+/g, ' ') + '\n';
            }
            const movements = parsePDFMovements(fullText);
            if (!movements.length) { toast('⚠️ Aucun mouvement trouvé', 'warn'); return; }
            let imp = 0;
            for (const m of movements) {
                const res = await apiCall('addMovement', m);
                if (res && res.success) imp++;
            }
            toast(`✅ ${imp} importé(s) du PDF`, 'success');
            refreshMovements(); refreshBanner();
            success = true; break;
        } catch (err) { console.warn('❌ Worker failed:', err.message); lastError = err; }
    }
    if (!success) { toast('❌ Tous les CDN PDF ont échoué', 'error'); }
}

async function importJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
        for (const m of data) {
            const split = splitCategoryType(m.category, m.type, m.description);
            await apiCall('addMovement', {
                date: m.date, transaction_no: m.transaction_no || '',
                category: split.category, type: split.type, description: split.description,
                recette: Number(m.recette) || 0, depense: Number(m.depense) || 0, frais: Number(m.frais) || 0
            });
        }
        toast(`✅ ${data.length} importé(s)`, 'success');
        refreshMovements(); refreshBanner();
    }
}

/* =========================================================
   PARSERS
   ========================================================= */
function parsePDFMovements(text) {
    const movements = [];
    const lines = text.split(/(?=\d{2}\/\d{2}\/\d{4})/g);
    for (const chunk of lines) {
        const trimmed = chunk.trim();
        if (!trimmed) continue;
        const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (!m) continue;
        const isoDate = `${m[3]}-${m[2]}-${m[1]}`;
        const trM = trimmed.match(/(TR\d+)/);
        const trNo = trM ? trM[1] : '';
        let rest = trimmed.replace(/^\d{2}\/\d{2}\/\d{4}\s*/, '').replace(/TR\d+\s*/, '');
        const nums = rest.match(/[\d\s]+[.,]\d{2}/g) || [];
        if (!nums.length) continue;
        const amount = parseAmount(nums.length >= 2 ? nums[nums.length - 2] : nums[0]);
        if (amount <= 0) continue;
        let desc = rest.replace(/[\d\s]+[.,]\d{2}/g, ' ').replace(/\s+/g, ' ').trim();
        const split = splitCategoryType('', '', desc);
        const isIncome = /AVANCE|RECETTES|VENTES|DON|REVENU|INCOME/i.test(split.category);
        movements.push({
            date: isoDate, transaction_no: trNo,
            category: split.category, type: split.type, description: split.description,
            recette: isIncome ? amount : 0, depense: isIncome ? 0 : amount, frais: 0
        });
    }
    return movements;
}

function splitCategoryType(rc, rt, rd) {
    let category = String(rc || '').trim().toUpperCase();
    let type = String(rt || '').trim().toUpperCase();
    let desc = String(rd || '').trim();
    const DASH = /\s*[—–]\s*|\s+-\s+/;
    if (category && !type && DASH.test(category)) {
        const parts = category.split(DASH);
        category = parts[0].trim(); type = parts.slice(1).join(' — ').trim();
    } else if (desc && category && desc.toUpperCase().startsWith(category)) {
        const pattern = new RegExp('^' + category.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[—–-]?\\s*' + (type ? type.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '') + '\\s*', 'i');
        desc = desc.replace(pattern, '').trim();
    }
    if (desc && DASH.test(desc) && !type) {
        const parts = desc.split(DASH);
        if (parts.length >= 2 && parts[1].length < 60) {
            const pc = parts[0].trim().toUpperCase(); const pt = parts[1].trim().toUpperCase();
            if (pc.length > 3 && pt.length > 2) {
                if (!category) category = pc;
                if (!type) type = pt;
                desc = parts.slice(2).join(' — ').trim();
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
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
    if (m) {
        let [_, d, mo, y] = m;
        if (y.length === 2) y = '20' + y;
        return `${y}-${mo.padStart(2,'0')}-${d.padStart(2,'0')}`;
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
   USERS
   ========================================================= */
async function refreshUsersTable() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;

    if (CONFIG.LOCAL_MODE) {
        tbody.innerHTML = '';
        let id = 1;
        Object.keys(CONFIG.LOCAL_USERS).forEach(name => {
            const u = CONFIG.LOCAL_USERS[name];
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${id++}</td>
                <td><strong>${name}</strong></td>
                <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role}</span></td>
                <td>${(u.permissions||[]).join(', ')}</td>
                <td><span class="badge badge-active">Actif</span></td>
                <td><em style="color:var(--gray);font-size:11px">Éditer config.js</em></td>`;
            tbody.appendChild(tr);
        });
        return;
    }

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
    if (CONFIG.LOCAL_MODE) {
        toast('ℹ️ Mode local : éditez config.js pour ajouter/modifier', 'warn');
        return;
    }
    const isNew = !user;
    user = user || { username:'', password:'', role:'user', permissions:['view'], active:true };
    document.getElementById('userModalTitle').textContent = isNew ? 'Nouvel Utilisateur' : 'Modifier Utilisateur';
    document.getElementById('inpUserName').value = user.username;
    document.getElementById('inpUserPass').value = user.password || '';
    document.getElementById('selUserRole').value = user.role;
    document.getElementById('chkActive').checked = user.active;
    document.querySelectorAll('.perm-check').forEach(cb => { cb.checked = (user.permissions||[]).includes(cb.value); });
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
        permissions: perms.join(','),
        active: document.getElementById('chkActive').checked
    };
    if (!payload.username || !payload.password) { toast('⚠️ Champs requis', 'warn'); return; }
    let res;
    if (id) { payload.id = id; res = await apiCall('updateUser', payload); }
    else res = await apiCall('addUser', payload);
    if (res.success) {
        toast('✅ Enregistré', 'success');
        modal.classList.remove('open');
        refreshUsersTable();
    } else toast('❌ ' + (res.error || 'Échec'), 'error');
}

/* =========================================================
   SETTINGS
   ========================================================= */
async function refreshSettings() {
    const opening = getOpeningBalance();
    const el = document.getElementById('currentOpeningBalance');
    const input = document.getElementById('inpOpeningBalance');
    if (el) el.textContent = fmtMoney(opening);
    if (input) input.value = opening;

    const appNameEl = document.getElementById('infoAppName');
    const versionEl = document.getElementById('infoVersion');
    const modeEl = document.getElementById('infoMode');
    const userEl = document.getElementById('infoUser');
    if (appNameEl) appNameEl.textContent = CONFIG.APP_NAME;
    if (versionEl) versionEl.textContent = CONFIG.APP_VERSION;
    if (modeEl) modeEl.textContent = CONFIG.LOCAL_MODE ? 'Local' : 'Google Sheets';
    if (userEl) userEl.textContent = SESSION ? SESSION.username + ' (' + SESSION.role + ')' : '—';
}

async function saveOpeningBalance() {
    const raw = document.getElementById('inpOpeningBalance').value;
    const cleaned = String(raw).replace(/\s/g, '').replace(',', '.');
    const val = parseFloat(cleaned);
    if (isNaN(val)) { toast('⚠️ Nombre invalide', 'warn'); return; }
    if (!confirm(`Confirmer ${fmtMoney(val)} comme nouveau solde début ?`)) return;
    setOpeningBalance(val);
    console.log('💾 Opening balance saved:', val);
    document.getElementById('currentOpeningBalance').textContent = fmtMoney(val);
    toast('✅ Solde début mis à jour', 'success');
    await refreshBanner();
    await refreshMovements();
    await refreshSettings();
}

async function deleteAllMovements() {
    if (!confirm('⚠️ ATTENTION ⚠️\n\nSupprimer TOUS les mouvements ?\n\nIRRÉVERSIBLE !')) return;
    const input = prompt('Tapez "SUPPRIMER" pour confirmer :');
    if (input !== 'SUPPRIMER') { toast('❌ Annulé', 'warn'); return; }
    if (!confirm('DERNIÈRE CONFIRMATION ?')) return;
    toast('⏳ Suppression...', 'warn');
    const res = await apiCall('deleteAllMovements', { confirm: 'DELETE_ALL' });
    if (res.success) { toast(`✅ ${res.deleted || 0} supprimé(s)`, 'success'); refreshMovements(); refreshBanner(); }
    else toast('❌ Échec : ' + (res.error || ''), 'error');
}

async function recalcBalanceGlobal() {
    if (!confirm('🔄 Mettre Solde début à 0 ?')) return;
    setOpeningBalance(0);
    toast('✅ Recalculé', 'success');
    await refreshSettings();
    await refreshBanner();
    await refreshMovements();
}

async function exportBackupJSON() {
    try {
        toast('⏳ Préparation...', 'warn');
        const [mvtRes, catRes, typeRes] = await Promise.all([
            apiCall('getMovements'),
            apiCall('getCategories'),
            apiCall('getTypes', {})
        ]);
        const backup = {
            version: CONFIG.APP_VERSION,
            exportedAt: new Date().toISOString(),
            exportedBy: SESSION.username,
            movements: mvtRes.movements || [],
            categories: catRes.categories || [],
            types: typeRes.types || [],
            settings: { opening_balance: getOpeningBalance() }
        };
        const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
        downloadBlob(JSON.stringify(backup, null, 2), `MyCaisse_Backup_${stamp}.json`, 'application/json');
        toast('✅ Sauvegarde exportée', 'success');
    } catch (err) { toast('❌ ' + err.message, 'error'); }
}

/* =========================================================
   BIND ALL EVENTS
   ========================================================= */
function bindAllEvents() {
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(tab.dataset.tab);
            if (panel) panel.classList.add('active');
            if (tab.dataset.tab === 'tabSettings') refreshSettings();
        });
    });

    document.getElementById('opTypeGroup')?.addEventListener('change', refreshCategorySelect);
    document.getElementById('selCategory')?.addEventListener('change', refreshTypeSelect);
    document.getElementById('btnSave')?.addEventListener('click', saveMovement);
    document.getElementById('btnClear')?.addEventListener('click', clearForm);
    document.getElementById('btnFilter')?.addEventListener('click', refreshMovements);
    document.getElementById('searchInput')?.addEventListener('input', refreshMovements);
    document.getElementById('btnResetFilter')?.addEventListener('click', () => {
        document.getElementById('filterFrom').value = '2000-01-01';
        document.getElementById('filterTo').value = todayISO();
        refreshMovements();
    });

    document.querySelectorAll('[data-export]').forEach(b => b.addEventListener('click', () => exportData(b.dataset.export)));

    document.getElementById('fileInput')?.addEventListener('change', e => {
        if (e.target.files[0]) handleUpload(e.target.files[0]);
    });

    document.getElementById('movTbody')?.addEventListener('click', async (e) => {
        const editId = e.target.dataset.edit;
        const delId = e.target.dataset.del;
        if (editId) await editMovement(Number(editId));
        if (delId && confirm('Supprimer ce mouvement ?')) {
            await apiCall('deleteMovement', { id: Number(delId) });
            toast('✅ Supprimé', 'success');
            refreshMovements();
        }
    });

    document.getElementById('usersTbody')?.addEventListener('click', async (e) => {
        const editId = e.target.dataset.editUser;
        const delId = e.target.dataset.delUser;
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
    document.getElementById('userModalClose')?.addEventListener('click', () => document.getElementById('userModal').classList.remove('open'));

    document.getElementById('btnAddCategory')?.addEventListener('click', addCategory);
    document.getElementById('btnAddType')?.addEventListener('click', addType);
    document.getElementById('typeParentCat')?.addEventListener('change', refreshTypesTable);
    document.getElementById('catTbody')?.addEventListener('click', (e) => {
        const id = e.target.dataset.delCat; const name = e.target.dataset.catName;
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

    document.getElementById('btnSaveOpening')?.addEventListener('click', saveOpeningBalance);
    document.getElementById('btnDeleteAllMvt')?.addEventListener('click', deleteAllMovements);
    document.getElementById('btnRecalcBalance')?.addEventListener('click', recalcBalanceGlobal);
    document.getElementById('btnExportBackup')?.addEventListener('click', exportBackupJSON);

    document.getElementById('btnLogout')?.addEventListener('click', () => {
        if (confirm('Se déconnecter ?')) {
            localStorage.removeItem(CONFIG.SESSION_KEY);
            sessionStorage.removeItem('mycaisse_token');
            window.location.href = 'index.html';
        }
    });
}

/* =========================================================
   INIT
   ========================================================= */
document.addEventListener('DOMContentLoaded', async () => {
    if (!SESSION) return;
    renderHeader();
    clearForm();

    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    document.getElementById('filterFrom').value = firstDay.toISOString().slice(0,10);
    document.getElementById('filterTo').value = todayISO();
    document.getElementById('reportMonth').value = new Date().toISOString().slice(0,7);

    bindAllEvents();

    try { await refreshCategorySelect(); } catch (e) { console.error('refreshCategorySelect:', e); }
    try { await refreshMovements(); } catch (e) { console.error('refreshMovements:', e); }
    try { await refreshUsersTable(); } catch (e) { console.error('refreshUsersTable:', e); }
    try { await refreshManageTables(); } catch (e) { console.error('refreshManageTables:', e); }
    try { await refreshSettings(); } catch (e) { console.error('refreshSettings:', e); }
});
