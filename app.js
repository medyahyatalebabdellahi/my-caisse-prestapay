<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>My Caisse Prestapay — Dashboard</title>
<link rel="stylesheet" href="style.css">
<script src="config.js"></script>
<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.1/jspdf.plugin.autotable.min.js"></script>
</head>
<body>

<header class="app-header">
    <div class="brand">
        <img src="logo.png" alt="" onerror="this.style.display='none'">
        <span>MY CAISSE <span style="color:#A78BFA">PRESTAPAY</span></span>
    </div>
    <div class="user-info">
        <div class="avatar" id="userAvatar">U</div>
        <div style="text-align:right;line-height:1.2">
            <div style="font-weight:700" id="userName">User</div>
            <div style="font-size:11px;opacity:.8" id="userRole">—</div>
        </div>
        <button class="btn-ghost" id="btnLogout">🚪 Logout</button>
    </div>
</header>

<div class="stats-banner">
    <div class="stat"><div class="label">Opening Balance</div>
        <div class="value" id="statOpening">0 MRU</div></div>
    <div class="stat recette"><div class="label">Total Income</div>
        <div class="value" id="statRecettes">0 MRU</div></div>
    <div class="stat depense"><div class="label">Total Expenses</div>
        <div class="value" id="statDepenses">0 MRU</div></div>
    <div class="stat final"><div class="label">Final Balance</div>
        <div class="value" id="statFinal">0 MRU</div></div>
</div>

<div class="app-container">
    <aside>
        <div class="card" data-add-only>
            <div class="card-header" id="formTitle">New Movement</div>
            <div class="card-body">
                <div class="radio-group" id="opTypeGroup">
                    <label><input type="radio" name="opType" value="Dépense" checked><span>💸 Expense</span></label>
                    <label><input type="radio" name="opType" value="Recette"><span>💰 Income</span></label>
                </div>
                <div class="form-group"><label>Date</label>
                    <input type="text" id="inpDate" class="form-control" placeholder="DD/MM/YYYY"></div>
                <div class="form-group"><label>Transaction No.</label>
                    <input type="text" id="inpTransaction" class="form-control"></div>
                <div class="form-group"><label>Category</label>
                    <select id="selCategory" class="form-control"></select></div>
                <div class="form-group"><label>Type</label>
                    <select id="selType" class="form-control"></select></div>
                <div class="form-group"><label>Description</label>
                    <input type="text" id="inpDescription" class="form-control"></div>
                <div class="form-group"><label>Amount (MRU)</label>
                    <input type="number" id="inpAmount" class="form-control" step="0.01"></div>
                <div style="display:flex;gap:8px;margin-top:10px">
                    <button class="btn btn-violet btn-block" id="btnSave">➕ Add</button>
                    <button class="btn btn-gray" id="btnClear">Clear</button>
                </div>
            </div>
        </div>

        <div class="card">
            <div class="card-header">📥 Import File</div>
            <div class="card-body">
                <label class="upload-zone" for="fileInput">
                    <div style="font-size:28px">📄</div>
                    <div style="font-weight:700;color:var(--violet-dark);margin-top:6px">Click or drop a file</div>
                    <div style="font-size:11px;color:var(--gray);margin-top:4px">CSV, JSON</div>
                    <input type="file" id="fileInput" accept=".csv,.json">
                </label>
            </div>
        </div>
    </aside>

    <main>
        <div class="tabs">
            <button class="tab active" data-tab="tabMovements">📊 Movements</button>
            <button class="tab" data-tab="tabReport">📈 Monthly Report</button>
            <button class="tab" data-tab="tabManage" data-admin-only>🗂️ Categories & Types</button>
            <button class="tab" data-tab="tabUsers" data-admin-only>👥 Users</button>
        </div>

        <!-- MOVEMENTS -->
        <div class="tab-panel active" id="tabMovements">
            <div class="table-wrap">
                <div class="table-toolbar">
                    <span style="font-weight:700;color:var(--violet-dark)">From</span>
                    <input type="text" id="filterFrom" class="form-control" style="width:120px">
                    <span style="font-weight:700;color:var(--violet-dark)">To</span>
                    <input type="text" id="filterTo" class="form-control" style="width:120px">
                    <button class="btn btn-violet" id="btnFilter">🔍 Filter</button>
                    <input type="text" id="searchInput" class="form-control"
                           style="flex:1;min-width:180px" placeholder="🔎 Search...">
                    <span style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
                        <button class="btn btn-success" data-export="excel">📗 Excel</button>
                        <button class="btn btn-blue"    data-export="word">📘 Word</button>
                        <button class="btn btn-danger"  data-export="pdf">📕 PDF</button>
                        <button class="btn btn-gray"    data-export="csv">📄 CSV</button>
                    </span>
                </div>
                <div class="scroll-area">
                    <table class="data">
                        <thead><tr>
                            <th>Date</th><th>Transaction</th><th>Category</th>
                            <th>Type</th><th>Description</th>
                            <th style="text-align:right">Income</th>
                            <th style="text-align:right">Expense</th>
                            <th style="text-align:right">Balance</th>
                            <th>Actions</th>
                        </tr></thead>
                        <tbody id="movTbody"></tbody>
                    </table>
                </div>
                <div style="padding:10px 16px;background:var(--violet-light);
                            font-size:12px;color:var(--violet-dark);font-weight:600"
                     id="movCount">0 row(s)</div>
            </div>
        </div>

        <!-- MONTHLY REPORT -->
        <div class="tab-panel" id="tabReport">
            <div class="card">
                <div class="card-header">📈 Monthly Report — Dépense Exploitation Prestapay</div>
                <div class="card-body">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
                        <div class="form-group"><label>Month</label>
                            <input type="month" id="reportMonth" class="form-control"></div>
                        <div class="form-group"><label>Categories (multi-select)</label>
                            <select id="reportCategories" class="form-control" multiple
                                    style="height:auto;min-height:42px;padding:6px"></select></div>
                    </div>
                    <div style="display:flex;gap:8px;margin-bottom:18px;flex-wrap:wrap">
                        <button class="btn btn-violet" id="btnGenerateReport">📊 Generate</button>
                        <button class="btn btn-success" id="btnReportExcel">📗 Excel</button>
                        <button class="btn btn-danger"  id="btnReportPDF">📕 PDF</button>
                        <button class="btn btn-warning" id="btnSaveClosing">💾 Save Closing as Opening</button>
                    </div>
                    <div id="reportOutput"></div>
                </div>
            </div>
        </div>

        <!-- MANAGE -->
        <div class="tab-panel" id="tabManage">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
                <div class="card">
                    <div class="card-header">🗂️ Categories</div>
                    <div class="card-body">
                        <div class="form-group"><label>Category Name</label>
                            <input type="text" id="newCatName" class="form-control"></div>
                        <div class="form-group"><label>Kind</label>
                            <select id="newCatKind" class="form-control">
                                <option value="Dépenses">Dépenses (Expense)</option>
                                <option value="Recettes">Recettes (Income)</option>
                            </select></div>
                        <button class="btn btn-violet btn-block" id="btnAddCategory">➕ Add Category</button>
                        <div style="margin-top:16px;max-height:400px;overflow-y:auto">
                            <table class="data" style="font-size:12px">
                                <thead><tr><th>Name</th><th>Kind</th><th>Actions</th></tr></thead>
                                <tbody id="catTbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="card">
                    <div class="card-header">🏷️ Types</div>
                    <div class="card-body">
                        <div class="form-group"><label>Parent Category</label>
                            <select id="typeParentCat" class="form-control"></select></div>
                        <div class="form-group"><label>Type Name</label>
                            <input type="text" id="newTypeName" class="form-control"></div>
                        <button class="btn btn-violet btn-block" id="btnAddType">➕ Add Type</button>
                        <div style="margin-top:16px;max-height:400px;overflow-y:auto">
                            <table class="data" style="font-size:12px">
                                <thead><tr><th>Name</th><th>Category</th><th>Actions</th></tr></thead>
                                <tbody id="typeTbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- USERS -->
        <div class="tab-panel" id="tabUsers">
            <div class="table-wrap">
                <div class="table-toolbar">
                    <span style="font-weight:700;color:var(--violet-dark)">👥 Users Management</span>
                    <button class="btn btn-violet" id="btnAddUser"
                            style="margin-left:auto">➕ New User</button>
                </div>
                <table class="data">
                    <thead><tr>
                        <th>ID</th><th>Username</th><th>Role</th>
                        <th>Permissions</th><th>Status</th><th>Actions</th>
                    </tr></thead>
                    <tbody id="usersTbody"></tbody>
                </table>
            </div>
        </div>
    </main>
</div>

<!-- USER MODAL -->
<div class="modal-overlay" id="userModal">
    <div class="modal">
        <div class="modal-header">
            <h3 id="userModalTitle">New User</h3>
            <button class="modal-close" id="userModalClose">✕</button>
        </div>
        <div class="modal-body">
            <div class="form-group"><label>Username</label>
                <input type="text" id="inpUserName" class="form-control"></div>
            <div class="form-group"><label>Password</label>
                <input type="text" id="inpUserPass" class="form-control"></div>
            <div class="form-group"><label>Role</label>
                <select id="selUserRole" class="form-control">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                </select></div>
            <div class="form-group"><label>Permissions</label>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px">
                    <label><input type="checkbox" class="perm-check" value="view"> View</label>
                    <label><input type="checkbox" class="perm-check" value="add"> Add</label>
                    <label><input type="checkbox" class="perm-check" value="edit"> Edit</label>
                    <label><input type="checkbox" class="perm-check" value="delete"> Delete</label>
                    <label><input type="checkbox" class="perm-check" value="export"> Export</label>
                    <label><input type="checkbox" class="perm-check" value="manage_users"> Manage Users</label>
                </div></div>
            <label style="display:flex;gap:8px;align-items:center;margin-top:10px">
                <input type="checkbox" id="chkActive" checked> Active
            </label>
        </div>
        <div class="modal-footer">
            <button class="btn btn-gray"
                    onclick="document.getElementById('userModal').classList.remove('open')">Cancel</button>
            <button class="btn btn-violet" id="btnSaveUser">💾 Save</button>
        </div>
    </div>
</div>

<div class="toast" id="toast"></div>
<script src="app.js"></script>
</body>
</html>
