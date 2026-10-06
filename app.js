/* =========================================================
   MY CAISSE PRESTAPAY — Application Logic
   ========================================================= */

// ---------- Session ----------
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

// ---------- Utilities ----------
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
const toISODate = (fr) => {
    const [d,m,y] = fr.split('/');
    return `${y}-${m}-${d}`;
};
const toFRDate = (iso) => {
    const [y,m,d] = iso.split('-');
    return `${d}/${m}/${y}`;
};

function toast(msg, type='') {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast';
              document.body.appendChild(t); }
    t.textContent = msg;
    t.className = 'toast show ' + type;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.className = 'toast ' + type, 3200);
}

// ---------- Data Layer (API or Local) ----------
const DB = {
    _key: 'mycaisse_data_v1',
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
            categories: [],
            movements: [],
            users: [],
            settings: { opening_balance: 0 }
        };
        localStorage.setItem(this._key, JSON.stringify(data));
        return data;
    },

    // ---------- API Calls (if API_URL is set) ----------
    async _api(action, payload = {}) {
        if (!CONFIG.API_URL) return null;
        const token = sessionStorage.getItem('mycaisse_token') || '';
        const res = await fetch(CONFIG.API_URL + '?token=' + encodeURIComponent(token), {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(Object.assign({ action }, payload))
        });
        return res.json();
    },

    // ---------- Categories ----------
    getCategories(kind) {
        const d = this._load();
        return kind ? d.categories.filter(c => c.kind === kind) : d.categories.slice();
    },
    addCategory(name, kind) {
        const d = this._load();
        if (d.categories.some(c => c.name.toUpperCase() === name.toUpperCase() && c.kind === kind))
            return null;
        const c = { id: Date.now(), name: name.trim(), kind,
                    position: d.categories.length, types: [] };
        d.categories.push(c); this._save(); return c;
    },
    deleteCategory(id) {
        const d = this._load();
        d.categories = d.categories.filter(c => c.id !== id);
        d.movements.forEach(m => { if (m.category_id === id) { m.category_id = null; m.type_id = null; }});
        this._save();
    },

    // ---------- Types ----------
    getTypes(catId) {
        const c = this._load().categories.find(x => x.id === catId);
        return c ? c.types : [];
    },
    addType(catId, name) {
        const c = this._load().categories.find(x => x.id === catId);
        if (!c) return null;
        if (c.types.some(t => t.name.toUpperCase() === name.toUpperCase())) return null;
        const t = { id: Date.now(), name: name.trim() };
        c.types.push(t); this._save(); return t;
    },

    // ---------- Movements ----------
    getMovements(from, to) {
        const d = this._load();
        return d.movements
            .filter(m => (!from || m.date >= from) && (!to || m.date <= to))
            .map(m => ({
                ...m,
                category_name: d.categories.find(c => c.id === m.category_id)?.name || '',
                type_name:     d.categories.find(c => c.id === m.category_id)
                                    ?.types.find(t => t.id === m.type_id)?.name || ''
            }))
            .sort((a,b) => a.date.localeCompare(b.date) || a.id - b.id);
    },
    addMovement(m) {
        const d = this._load();
        m.id = Date.now(); m.created_at = Date.now();
        d.movements.push(m); this._save(); return m;
    },
    updateMovement(id, m) {
        const d = this._load();
        const i = d.movements.findIndex(x => x.id === id);
        if (i >= 0) { d.movements[i] = { ...d.movements[i], ...m }; this._save(); }
    },
    deleteMovement(id) {
        const d = this._load();
        d.movements = d.movements.filter(m => m.id !== id); this._save();
    },

    // ---------- Balance ----------
    getOpeningBalance() { return Number(this._load().settings.opening_balance || 0); },
    setOpeningBalance(v) { this._load().settings.opening_balance = Number(v); this._save(); },
    balanceBefore(iso) {
        const d = this._load();
        const past = d.movements.filter(m => m.date < iso);
        const r = past.reduce((s,m) => s + Number(m.recette||0), 0);
        const e = past.reduce((s,m) => s + Number(m.depense||0), 0);
        return this.getOpeningBalance() + r - e;
    },
    totals(from, to) {
        const d = this._load();
        const list = d.movements.filter(m => (!from || m.date >= from) && (!to || m.date <= to));
        const r = list.reduce((s,m) => s + Number(m.recette||0), 0);
        const e = list.reduce((s,m) => s + Number(m.depense||0), 0);
        return { recettes: r, depenses: e };
    },

    // ---------- Users ----------
    getUsers() { return this._load().users.slice(); },
    addUser(u) {
        const d = this._load();
        if (d.users.some(x => x.username.toUpperCase() === u.username.toUpperCase())) return null;
        u.id = Date.now(); u.createdAt = Date.now();
        d.users.push(u); this._save(); return u;
    },
    updateUser(id, patch) {
        const d = this._load();
        const u = d.users.find(x => x.id === id);
        if (u) Object.assign(u, patch);
        this._save();
    },
    deleteUser(id) {
        const d = this._load();
        d.users = d.users.filter(u => u.id !== id);
        this._save();
    }
};

// =========================================================
// RENDER
// =========================================================
let CURRENT_EDIT_ID = null;
let CAT_LIST = [], TYPE_LIST = [];

function renderHeader() {
    document.getElementById('userName').textContent = SESSION.username;
    document.getElementById('userRole').textContent =
        SESSION.role === 'admin' ? 'Administrateur' : 'Utilisateur';
    document.getElementById('userAvatar').textContent =
        SESSION.username.charAt(0).toUpperCase();

    if (!hasPerm('manage_users') && SESSION.role !== 'admin') {
        document.querySelectorAll('[data-admin-only]').forEach(el => el.style.display = 'none');
    }
    if (!hasPerm('add') && SESSION.role !== 'admin') {
        document.querySelectorAll('[data-add-only]').forEach(el => el.style.display = 'none');
    }
    if (!hasPerm('export') && SESSION.role !== 'admin') {
        document.querySelectorAll('[data-export]').forEach(el => el.style.display = 'none');
    }
}

function refreshBanner() {
    const opening = DB.getOpeningBalance();
    const t = DB.totals();
    document.getElementById('statOpening').textContent = fmtMoney(opening);
    document.getElementById('statRecettes').textContent = fmtMoney(t.recettes);
    document.getElementById('statDepenses').textContent = fmtMoney(t.depenses);
    document.getElementById('statFinal').textContent =
        fmtMoney(opening + t.recettes - t.depenses);
}

function refreshCategorySelect() {
    const kind = document.querySelector('input[name="opType"]:checked').value + 's';
    CAT_LIST = DB.getCategories(kind);
    const sel = document.getElementById('selCategory');
    sel.innerHTML = '';
    CAT_LIST.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.id; opt.textContent = c.name;
        sel.appendChild(opt);
    });
    refreshTypeSelect();
}

function refreshTypeSelect() {
    const catId = Number(document.getElementById('selCategory').value);
    TYPE_LIST = DB.getTypes(catId);
    const sel = document.getElementById('selType');
    sel.innerHTML = '';
    if (!TYPE_LIST.length) {
        sel.innerHTML = '<option value="">(aucun type)</option>';
        return;
    }
    TYPE_LIST.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id; opt.textContent = t.name;
        sel.appendChild(opt);
    });
}

function refreshMovements() {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    const q    = document.getElementById('searchInput').value.trim().toLowerCase();

    const isoFrom = from ? toISODate(from) : null;
    const isoTo   = to ? toISODate(to) : null;

    let list = DB.getMovements(isoFrom, isoTo);
    if (q) list = list.filter(m =>
        JSON.stringify(m).toLowerCase().includes(q));

    const tbody = document.getElementById('movTbody');
    tbody.innerHTML = '';

    let running = isoFrom ? DB.balanceBefore(isoFrom) : DB.getOpeningBalance();

    list.forEach(m => {
        running += Number(m.recette||0) - Number(m.depense||0);
        const tr = document.createElement('tr');
        tr.className = m.recette > 0 ? 'recette' : 'depense';
        tr.innerHTML = `
            <td>${fmtDate(m.date)}</td>
            <td>${m.transaction_no || ''}</td>
            <td>${m.category_name || ''}</td>
            <td>${m.type_name || ''}</td>
            <td>${m.description || ''}</td>
            <td class="amt-recette">${m.recette ? fmtMoney(m.recette) : ''}</td>
            <td class="amt-depense">${m.depense ? fmtMoney(m.depense) : ''}</td>
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
    document.getElementById('inpDate').value = toFRDate(todayISO());
    document.getElementById('formTitle').textContent = 'Nouveau mouvement';
    document.getElementById('btnSave').textContent = '➕ Ajouter';
}

function saveMovement() {
    const dateFR = document.getElementById('inpDate').value;
    const trNo   = document.getElementById('inpTransaction').value.trim();
    const desc   = document.getElementById('inpDescription').value.trim();
    const amount = parseFloat(document.getElementById('inpAmount').value.replace(',', '.')) || 0;
    const catId  = Number(document.getElementById('selCategory').value) || null;
    const typeId = Number(document.getElementById('selType').value) || null;
    const type   = document.querySelector('input[name="opType"]:checked').value;

    if (!dateFR || amount <= 0) { toast('⚠️ Date et montant obligatoires.', 'warn'); return; }

    const iso = toISODate(dateFR);
    const mvt = {
        date: iso, transaction_no: trNo, category_id: catId, type_id: typeId,
        description: desc,
        recette: type === 'Recette' ? amount : 0,
        depense: type === 'Dépense' ? amount : 0
    };

    if (CURRENT_EDIT_ID) {
        DB.updateMovement(CURRENT_EDIT_ID, mvt);
        toast('✅ Mouvement modifié.', 'success');
    } else {
        DB.addMovement(mvt);
        toast('✅ Mouvement ajouté.', 'success');
    }
    clearForm(); refreshMovements();
}

function editMovement(id) {
    const m = DB.getMovements().find(x => x.id === id);
    if (!m) return;
    CURRENT_EDIT_ID = id;
    document.getElementById('inpDate').value = toFRDate(m.date);
    document.getElementById('inpTransaction').value = m.transaction_no || '';
    document.getElementById('inpDescription').value = m.description || '';
    document.getElementById('inpAmount').value = m.recette || m.depense;

    const type = m.recette > 0 ? 'Recette' : 'Dépense';
    document.querySelector(`input[name="opType"][value="${type}"]`).checked = true;
    refreshCategorySelect();
    document.getElementById('selCategory').value = m.category_id || '';
    refreshTypeSelect();
    document.getElementById('selType').value = m.type_id || '';

    document.getElementById('formTitle').textContent = 'Modifier le mouvement';
    document.getElementById('btnSave').textContent = '💾 Enregistrer';
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =========================================================
// EXPORTS
// =========================================================
async function exportData(format) {
    const from = document.getElementById('filterFrom').value;
    const to   = document.getElementById('filterTo').value;
    const isoFrom = from ? toISODate(from) : null;
    const isoTo   = to ? toISODate(to) : null;
    const movements = DB.getMovements(isoFrom, isoTo);
    const opening = isoFrom ? DB.balanceBefore(isoFrom) : DB.getOpeningBalance();
    const t = DB.totals(isoFrom, isoTo);
    const finalBal = opening + t.recettes - t.depenses;

    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');

    if (format === 'excel') {
        const ws_data = [
            ['MY CAISSE PRESTAPAY'],
            ['Période', `${from || 'N/A'} → ${to || 'N/A'}`],
            ['Solde début', opening, 'Total Recettes', t.recettes,
             'Total Dépenses', t.depenses, 'Solde fin', finalBal],
            [],
            ['Date','N° Transaction','Catégorie','Type','Description','Recettes','Dépenses','Solde']
        ];
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0);
            ws_data.push([fmtDate(m.date), m.transaction_no||'', m.category_name||'',
                          m.type_name||'', m.description||'', m.recette||0, m.depense||0, running]);
        });
        const ws = XLSX.utils.aoa_to_sheet(ws_data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Mouvements');
        XLSX.writeFile(wb, `MyCaisse_${stamp}.xlsx`);
        toast('✅ Excel exporté.', 'success');
    }

    else if (format === 'csv') {
        let csv = 'Date,N° Transaction,Catégorie,Type,Description,Recettes,Dépenses,Solde\n';
        let running = opening;
        movements.forEach(m => {
            running += Number(m.recette||0) - Number(m.depense||0);
            const row = [fmtDate(m.date), m.transaction_no||'', m.category_name||'',
                         m.type_name||'', m.description||'', m.recette||0, m.depense||0, running]
                        .map(v => `"${String(v).replace(/"/g,'""')}"`).join(',');
            csv += row + '\n';
        });
        downloadBlob(csv, `MyCaisse_${stamp}.csv`, 'text/csv;charset=utf-8');
        toast('✅ CSV exporté.', 'success');
    }

    else if (format === 'word') {
        const html = buildHTMLReport(movements, opening, finalBal, t, from, to);
        const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
        downloadBlob(blob, `MyCaisse_${stamp}.doc`);
        toast('✅ Word exporté.', 'success');
    }

    else if (format === 'pdf') {
        exportPDF(movements, opening, finalBal, t, from, to, stamp);
    }
}

function buildHTMLReport(movements, opening, finalBal, t, from, to) {
    let rows = '';
    let running = opening;
    movements.forEach(m => {
        running += Number(m.recette||0) - Number(m.depense||0);
        rows += `<tr>
            <td>${fmtDate(m.date)}</td>
            <td>${m.transaction_no||''}</td>
            <td>${m.category_name||''} — ${m.type_name||''}</td>
            <td>${m.description||''}</td>
            <td style="text-align:right;color:#059669">${m.recette?fmtMoney(m.recette):''}</td>
            <td style="text-align:right;color:#DC2626">${m.depense?fmtMoney(m.depense):''}</td>
            <td style="text-align:right;font-weight:700">${fmtMoney(running)}</td>
        </tr>`;
    });
    return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word">
    <head><meta charset="utf-8">
    <style>
        body { font-family: 'Segoe UI', sans-serif; color:#1F1B2E; }
        h1 { color:#1E3A8A; text-align:center; margin:0; }
        h2 { color:#6B7280; text-align:center; font-size:12px; font-weight:normal; }
        table { width:100%; border-collapse:collapse; margin-top:20px; font-size:11px; }
        th { background:#7C3AED; color:#fff; padding:8px; text-align:left; }
        td { border:1px solid #ccc; padding:6px; }
        tr:nth-child(even) td { background:#F5F3FF; }
        .summary { background:#DBEAFE; padding:12px; border-radius:8px; margin:16px 0; }
        .summary td { border:none; background:transparent; padding:4px 10px; }
        .summary .label { font-weight:700; color:#1E3A8A; }
        .summary .val { font-weight:800; color:#7C3AED; font-size:14px; }
    </style></head><body>
    <h1>MY CAISSE PRESTAPAY</h1>
    <h2>Détail mouvement caisse — Du ${from||'N/A'} au ${to||'N/A'}</h2>
    <table class="summary"><tr>
        <td class="label">Solde début</td><td class="val">${fmtMoney(opening)}</td>
        <td class="label">Total Recettes</td><td class="val" style="color:#059669">${fmtMoney(t.recettes)}</td>
        <td class="label">Total Dépenses</td><td class="val" style="color:#DC2626">${fmtMoney(t.depenses)}</td>
        <td class="label">Solde fin</td><td class="val">${fmtMoney(finalBal)}</td>
    </tr></table>
    <table>
        <thead><tr>
            <th>Date</th><th>N° Transaction</th><th>Catégorie / Type</th>
            <th>Description</th><th>Recettes</th><th>Dépenses</th><th>Solde</th>
        </tr></thead>
        <tbody>${rows}</tbody>
    </table>
    <p style="text-align:center;color:#6B7280;font-size:10px;margin-top:24px">
        Généré le ${new Date().toLocaleString('fr-FR')} par ${SESSION.username}
    </p></body></html>`;
}

function exportPDF(movements, opening, finalBal, t, from, to, stamp) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    doc.setFillColor(124, 58, 237);
    doc.rect(0, 0, 297, 22, 'F');
    doc.setTextColor(255,255,255);
    doc.setFontSize(16); doc.setFont(undefined,'bold');
    doc.text('MY CAISSE PRESTAPAY', 148, 10, { align:'center' });
    doc.setFontSize(9); doc.setFont(undefined,'normal');
    doc.text(`Détail mouvement — Du ${from||'N/A'} au ${to||'N/A'}`, 148, 17, { align:'center' });

    doc.setTextColor(30,58,138);
    doc.setFontSize(10);
    let y = 30;
    doc.text(`Solde début : ${fmtMoney(opening)}`, 15, y);
    doc.text(`Total Recettes : ${fmtMoney(t.recettes)}`, 90, y);
    doc.text(`Total Dépenses : ${fmtMoney(t.depenses)}`, 165, y);
    doc.text(`Solde fin : ${fmtMoney(finalBal)}`, 240, y);

    y += 6;
    doc.autoTable({
        startY: y,
        head: [['Date','N° Transaction','Catégorie / Type','Description','Recettes','Dépenses','Solde']],
        body: (() => {
            let running = opening;
            return movements.map(m => {
                running += Number(m.recette||0) - Number(m.depense||0);
                return [fmtDate(m.date), m.transaction_no||'',
                        `${m.category_name||''} — ${m.type_name||''}`,
                        m.description||'',
                        m.recette ? fmtMoney(m.recette) : '',
                        m.depense ? fmtMoney(m.depense) : '',
                        fmtMoney(running)];
            });
        })(),
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [124,58,237], textColor: 255 },
        alternateRowStyles: { fillColor: [237,233,254] },
        columnStyles: {
            4: { halign:'right', textColor:[5,150,105] },
            5: { halign:'right', textColor:[220,38,38] },
            6: { halign:'right', fontStyle:'bold' }
        }
    });

    doc.save(`MyCaisse_${stamp}.pdf`);
    toast('✅ PDF exporté.', 'success');
}

function downloadBlob(data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// =========================================================
// UPLOAD FILE
// =========================================================
function handleUpload(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const text = e.target.result;
            if (file.name.endsWith('.csv')) importCSV(text);
            else if (file.name.endsWith('.json')) importJSON(text);
            else toast('⚠️ Format non supporté (CSV ou JSON).', 'warn');
        } catch (err) { toast('❌ Erreur import : ' + err.message, 'error'); }
    };
    reader.readAsText(file);
}

function importCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast('⚠️ CSV vide.', 'warn'); return; }
    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g)
                     .map(c => c.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g,'"'));
        if (cols.length < 5) continue;
        const [dateStr, trNo, cat, typ, desc, rec, dep] = cols;
        let iso = dateStr;
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) iso = toISODate(dateStr);
        DB.addMovement({
            date: iso, transaction_no: trNo||'', category_id: null, type_id: null,
            description: desc||'', recette: Number(rec)||0, depense: Number(dep)||0
        });
        imported++;
    }
    toast(`✅ ${imported} mouvement(s) importé(s).`, 'success');
    refreshMovements();
}

function importJSON(text) {
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
        data.forEach(m => DB.addMovement(m));
        toast(`✅ ${data.length} mouvement(s) importé(s).`, 'success');
        refreshMovements();
    }
}

// =========================================================
// ADMIN : Users
// =========================================================
function refreshUsersTable() {
    const tbody = document.getElementById('usersTbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    DB.getUsers().forEach(u => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${u.id}</td>
            <td><strong>${u.username}</strong></td>
            <td><span class="badge ${u.role==='admin'?'badge-admin':'badge-user'}">${u.role}</span></td>
            <td>${(u.permissions||[]).join(', ') || '—'}</td>
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

    document.getElementById('userModalTitle').textContent =
        isNew ? 'Nouvel utilisateur' : 'Modifier utilisateur';
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

function saveUser() {
    const modal = document.getElementById('userModal');
    const id = modal.dataset.userId;
    const perms = [...document.querySelectorAll('.perm-check:checked')].map(c => c.value);

    const payload = {
        username:    document.getElementById('inpUserName').value.trim().toUpperCase(),
        password:    document.getElementById('inpUserPass').value,
        role:        document.getElementById('selUserRole').value,
        permissions: perms,
        active:      document.getElementById('chkActive').checked
    };

    if (!payload.username || !payload.password) {
        toast('⚠️ Nom d\'utilisateur et mot de passe requis.', 'warn'); return;
    }

    if (id) DB.updateUser(Number(id), payload);
    else if (!DB.addUser(payload)) { toast('❌ Nom déjà utilisé.', 'error'); return; }

    toast('✅ Utilisateur enregistré.', 'success');
    modal.classList.remove('open');
    refreshUsersTable();
}

// =========================================================
// INITIALIZATION
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    if (!SESSION) return;
    renderHeader();
    clearForm();
    document.getElementById('inpDate').value = toFRDate(todayISO());
    document.getElementById('filterFrom').value = toFRDate(
        new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0,10));
    document.getElementById('filterTo').value = toFRDate(todayISO());
    refreshCategorySelect();
    refreshMovements();
    refreshUsersTable();

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

    document.getElementById('movTbody').addEventListener('click', (e) => {
        const editId = e.target.dataset.edit;
        const delId  = e.target.dataset.del;
        if (editId) editMovement(Number(editId));
        if (delId && confirm('Supprimer ce mouvement ?')) {
            DB.deleteMovement(Number(delId));
            refreshMovements();
        }
    });

    document.getElementById('usersTbody')?.addEventListener('click', (e) => {
        const editId = e.target.dataset.editUser;
        const delId  = e.target.dataset.delUser;
        if (editId) openUserModal(DB.getUsers().find(u => u.id === Number(editId)));
        if (delId && confirm('Supprimer cet utilisateur ?')) {
            if (Number(delId) === SESSION.userId) { toast('❌ Impossible de se supprimer.', 'error'); return; }
            DB.deleteUser(Number(delId));
            refreshUsersTable();
        }
    });

    document.getElementById('btnAddUser')?.addEventListener('click', () => openUserModal(null));
    document.getElementById('btnSaveUser')?.addEventListener('click', saveUser);
    document.getElementById('userModalClose')?.addEventListener('click', () =>
        document.getElementById('userModal').classList.remove('open'));

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