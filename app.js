// ==========================================
// Garage Force Fairfax — Installer Portal JS
// ==========================================

(function() {
  'use strict';

  const API = "";

  let currentUser = null;
  let authToken = null;

  const loginGate = document.getElementById('login-gate');
  const app = document.getElementById('app');
  const loginForm = document.getElementById('login-form');
  const usernameInput = document.getElementById('username');
  const pw = document.getElementById('pw');
  const pwError = document.getElementById('pw-error');
  const userGreeting = document.getElementById('user-greeting');
  const logoutBtn = document.getElementById('logout-btn');
  const adminTab = document.getElementById('admin-tab');
  const adminMobileTab = document.getElementById('admin-mobile-tab');

  // --- Login ---
  loginForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    var uname = usernameInput.value.trim().toLowerCase();
    var pass = pw.value.trim();

    try {
      var res = await fetch(API + '/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: uname, password: pass })
      });

      if (!res.ok) {
        pwError.hidden = false;
        pw.value = '';
        pw.focus();
        return;
      }

      var data = await res.json();
      currentUser = { username: data.username, name: data.name, role: data.role };
      authToken = data.token;
      pwError.hidden = true;
      showApp();
    } catch (err) {
      pwError.textContent = 'Connection error. Please try again.';
      pwError.hidden = false;
    }
  });

  function showApp() {
    loginGate.hidden = true;
    app.hidden = false;
    if (currentUser && userGreeting) {
      userGreeting.textContent = currentUser.name;
    }
    // Show admin tab only for admin users
    if (currentUser && currentUser.role === 'admin') {
      if (adminTab) adminTab.hidden = false;
      if (adminMobileTab) adminMobileTab.hidden = false;
    } else {
      if (adminTab) adminTab.hidden = true;
      if (adminMobileTab) adminMobileTab.hidden = true;
    }
  }

  // --- Logout ---
  logoutBtn.addEventListener('click', async function() {
    if (authToken) {
      try {
        await fetch(API + '/api/logout', {
          method: 'POST',
          headers: { 'X-Auth-Token': authToken }
        });
      } catch (e) { /* ignore */ }
    }
    currentUser = null;
    authToken = null;
    loginGate.hidden = false;
    app.hidden = true;
    usernameInput.value = '';
    pw.value = '';
    pwError.hidden = true;
    pwError.textContent = 'Invalid username or password.';
    usernameInput.focus();
    // Hide admin tab
    if (adminTab) adminTab.hidden = true;
    if (adminMobileTab) adminMobileTab.hidden = true;
  });

  // --- Dark/Light Mode Toggle ---
  const themeToggle = document.getElementById('theme-toggle');
  const iconSun = document.getElementById('icon-sun');
  const iconMoon = document.getElementById('icon-moon');
  let theme = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcons();

  themeToggle.addEventListener('click', function() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcons();
  });

  function updateThemeIcons() {
    iconSun.style.display = theme === 'dark' ? 'block' : 'none';
    iconMoon.style.display = theme === 'dark' ? 'none' : 'block';
  }

  // --- Tab Navigation ---
  const tabs = document.querySelectorAll('.tab');
  const panels = document.querySelectorAll('.tab-panel');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const target = this.getAttribute('data-tab');

      tabs.forEach(function(t) { t.classList.remove('active'); });
      panels.forEach(function(p) { p.classList.remove('active'); });

      this.classList.add('active');
      const panel = document.getElementById(target);
      if (panel) panel.classList.add('active');

      // Load data when tabs are opened
      if (target === 'admin') { loadUsers(); loadLookups(); }
      if (target === 'inventory') { loadInventory(); loadLookups(); }
      if (target === 'jobs') loadJobs();
    });
  });

  // --- Mobile Menu ---
  const menuToggle = document.getElementById('menu-toggle');
  const tabBar = document.querySelector('.tab-bar');

  if (menuToggle) {
    menuToggle.addEventListener('click', function() {
      tabBar.classList.toggle('mobile-open');
    });
  }

  // --- Category Accordions (event delegation) ---
  document.addEventListener('click', function(e) {
    const header = e.target.closest('.category-header');
    if (!header) return;
    const content = header.parentElement.querySelector('.category-content');
    if (!content) return;
    content.toggleAttribute('hidden');
    const arrow = header.querySelector('.category-arrow');
    if (arrow) {
      const isOpen = !content.hidden;
      arrow.style.transform = isOpen ? 'rotate(90deg)' : '';
    }
  });

  // ==========================================
  // ADMIN PANEL — User Management
  // ==========================================

  const userTableBody = document.getElementById('user-table-body');
  const addUserForm = document.getElementById('add-user-form');
  const adminMsg = document.getElementById('admin-msg');

  function apiHeaders() {
    return {
      'Content-Type': 'application/json',
      'X-Auth-Token': authToken || ''
    };
  }

  function showAdminMsg(text, isError) {
    if (!adminMsg) return;
    adminMsg.textContent = text;
    adminMsg.className = 'admin-msg ' + (isError ? 'admin-msg-error' : 'admin-msg-success');
    adminMsg.hidden = false;
    setTimeout(function() { adminMsg.hidden = true; }, 4000);
  }

  async function loadUsers() {
    if (!userTableBody || !authToken) return;
    try {
      var res = await fetch(API + '/api/users', { headers: apiHeaders() });
      if (!res.ok) return;
      var users = await res.json();
      renderUsers(users);
    } catch (e) {
      userTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--color-text-muted)">Could not load users.</td></tr>';
    }
  }

  function renderUsers(users) {
    userTableBody.innerHTML = '';
    users.forEach(function(u) {
      var tr = document.createElement('tr');
      var isSelf = currentUser && currentUser.username.toLowerCase() === u.username.toLowerCase();

      tr.innerHTML =
        '<td><span class="user-cell-name">' + esc(u.name) + '</span>' +
        (isSelf ? ' <span class="badge-you">You</span>' : '') + '</td>' +
        '<td>' + esc(u.username) + '</td>' +
        '<td><span class="role-badge role-' + esc(u.role) + '">' + esc(u.role) + '</span></td>' +
        '<td>' + formatDate(u.created_at) + '</td>' +
        '<td class="user-actions">' +
          '<button class="btn-icon btn-reset" title="Reset password" data-id="' + u.id + '" data-name="' + esc(u.name) + '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
          '</button>' +
          (isSelf ? '' :
          '<button class="btn-icon btn-delete" title="Remove user" data-id="' + u.id + '" data-name="' + esc(u.name) + '">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
          '</button>') +
        '</td>';

      userTableBody.appendChild(tr);
    });

    // Attach event listeners
    userTableBody.querySelectorAll('.btn-delete').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        var name = this.getAttribute('data-name');
        showConfirmDialog(
          'Remove ' + name + '?',
          'They will no longer be able to log in to the portal.',
          'Remove',
          function() { deleteUser(id); }
        );
      });
    });

    userTableBody.querySelectorAll('.btn-reset').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        var name = this.getAttribute('data-name');
        showPasswordDialog(id, name);
      });
    });
  }

  async function deleteUser(id) {
    try {
      var res = await fetch(API + '/api/users/' + id, {
        method: 'DELETE',
        headers: apiHeaders()
      });
      if (res.ok) {
        showAdminMsg('User removed.', false);
        loadUsers();
      } else {
        var err = await res.json();
        showAdminMsg(err.detail || 'Could not remove user.', true);
      }
    } catch (e) {
      showAdminMsg('Connection error.', true);
    }
  }

  async function resetPassword(id, newPw) {
    try {
      var res = await fetch(API + '/api/users/' + id, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ password: newPw })
      });
      if (res.ok) {
        showAdminMsg('Password updated.', false);
      } else {
        showAdminMsg('Could not update password.', true);
      }
    } catch (e) {
      showAdminMsg('Connection error.', true);
    }
  }

  // --- Add User Form ---
  if (addUserForm) {
    addUserForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var name = document.getElementById('new-name').value.trim();
      var username = document.getElementById('new-username').value.trim().toLowerCase();
      var password = document.getElementById('new-password').value.trim();
      var role = document.getElementById('new-role').value;

      if (!name || !username || !password) {
        showAdminMsg('All fields are required.', true);
        return;
      }
      if (password.length < 4) {
        showAdminMsg('Password must be at least 4 characters.', true);
        return;
      }

      try {
        var res = await fetch(API + '/api/users', {
          method: 'POST',
          headers: apiHeaders(),
          body: JSON.stringify({ username: username, password: password, name: name, role: role })
        });
        if (res.ok) {
          showAdminMsg(name + ' has been added.', false);
          addUserForm.reset();
          loadUsers();
        } else {
          var err = await res.json();
          showAdminMsg(err.detail || 'Could not add user.', true);
        }
      } catch (e) {
        showAdminMsg('Connection error.', true);
      }
    });
  }

  function esc(s) {
    var d = document.createElement('div');
    d.textContent = s || '';
    return d.innerHTML;
  }

  function formatDate(ts) {
    if (!ts) return '—';
    var d = new Date(ts + 'Z');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ==========================================
  // CATEGORIES & UNITS
  // ==========================================

  async function loadLookups() {
    try {
      var [catRes, unitRes] = await Promise.all([
        fetch(API + '/api/categories', { headers: apiHeaders() }),
        fetch(API + '/api/units', { headers: apiHeaders() })
      ]);
      var cats = await catRes.json();
      var units = await unitRes.json();
      populateSelect('prod-category', cats);
      populateSelect('prod-unit', units);
      if (currentUser && currentUser.role === 'admin') {
        renderLookupList('category-list', cats, '/api/categories');
        renderLookupList('unit-list', units, '/api/units');
      }
    } catch(e) {}
  }

  function populateSelect(id, items) {
    var sel = document.getElementById(id);
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">— select —</option>' +
      items.map(function(i) { return '<option value="' + esc(i.name) + '">' + esc(i.name) + '</option>'; }).join('');
    if (current) sel.value = current;
  }

  function renderLookupList(listId, items, apiPath) {
    var ul = document.getElementById(listId);
    if (!ul) return;
    ul.innerHTML = '';
    items.forEach(function(item) {
      var li = document.createElement('li');
      li.className = 'lookup-item';
      li.innerHTML = '<span>' + esc(item.name) + '</span>' +
        '<button class="btn-icon btn-delete" data-id="' + item.id + '" title="Remove">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>' +
        '</button>';
      li.querySelector('.btn-delete').addEventListener('click', function() {
        var id = this.getAttribute('data-id');
        fetch(API + apiPath + '/' + id, { method: 'DELETE', headers: apiHeaders() })
          .then(function() { loadLookups(); });
      });
      ul.appendChild(li);
    });
    if (items.length === 0) {
      ul.innerHTML = '<li style="color:var(--color-text-muted);font-size:.85rem;padding:.25rem 0">None yet.</li>';
    }
  }

  // Add category form
  var addCategoryForm = document.getElementById('add-category-form');
  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var name = document.getElementById('new-category').value.trim();
      if (!name) return;
      await fetch(API + '/api/categories', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ name: name }) });
      document.getElementById('new-category').value = '';
      loadLookups();
    });
  }

  // Add unit form
  var addUnitForm = document.getElementById('add-unit-form');
  if (addUnitForm) {
    addUnitForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var name = document.getElementById('new-unit').value.trim();
      if (!name) return;
      await fetch(API + '/api/units', { method: 'POST', headers: apiHeaders(), body: JSON.stringify({ name: name }) });
      document.getElementById('new-unit').value = '';
      loadLookups();
    });
  }

  // ==========================================
  // INVENTORY
  // ==========================================

  var invTableBody = document.getElementById('inv-table-body');
  var invAddCard = document.getElementById('inv-add-card');
  var addProductForm = document.getElementById('add-product-form');
  var invMsg = document.getElementById('inv-msg');
  var invStats = document.getElementById('inv-stats');
  var invActionsCol = document.getElementById('inv-actions-col');
  var allProducts = [];
  var currentInvFilter = 'all';
  var currentInvSort = { key: 'name', dir: 1 };

  // Source filter buttons
  document.querySelectorAll('[data-inv-filter]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentInvFilter = this.getAttribute('data-inv-filter');
      document.querySelectorAll('[data-inv-filter]').forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      renderInventory(allProducts);
    });
  });

  function showInvMsg(text, isError) {
    if (!invMsg) return;
    invMsg.textContent = text;
    invMsg.className = 'admin-msg ' + (isError ? 'admin-msg-error' : 'admin-msg-success');
    invMsg.hidden = false;
    setTimeout(function() { invMsg.hidden = true; }, 4000);
  }

  async function loadInventory() {
    if (!invTableBody || !authToken) return;
    try {
      var res = await fetch(API + '/api/products', { headers: apiHeaders() });
      if (!res.ok) return;
      allProducts = await res.json();
      renderInventory(allProducts);
    } catch (e) {
      if (invTableBody) invTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted)">Could not load inventory.</td></tr>';
    }
  }

  // Sort header clicks
  document.querySelectorAll('.inv-sort').forEach(function(th) {
    th.addEventListener('click', function() {
      var key = this.getAttribute('data-sort');
      if (currentInvSort.key === key) {
        currentInvSort.dir *= -1;
      } else {
        currentInvSort = { key: key, dir: 1 };
      }
      renderInventory(allProducts);
    });
  });

  var SOURCE_COLORS = { 'Corporate': '#6366f1', 'Home Depot': '#f97316', 'Other': '#9ca3af' };

  function renderInventory(products) {
    if (!invTableBody) return;
    // Stats (always from full list)
    var low = products.filter(function(p) { return p.quantity <= p.low_stock_qty; }).length;
    if (invStats) {
      invStats.innerHTML =
        '<div class="stat-card"><span class="stat-num">' + products.length + '</span><span class="stat-label">Products</span></div>' +
        '<div class="stat-card' + (low > 0 ? ' stat-warn' : '') + '"><span class="stat-num">' + low + '</span><span class="stat-label">Low Stock</span></div>';
    }
    // Admin controls
    var isAdmin = currentUser && currentUser.role === 'admin';
    if (invAddCard) invAddCard.hidden = !isAdmin;
    if (invActionsCol) invActionsCol.style.display = isAdmin ? '' : 'none';

    // Filter by source
    var filtered = currentInvFilter === 'all' ? products.slice() : products.filter(function(p) { return p.source === currentInvFilter; });

    // Sort
    filtered.sort(function(a, b) {
      var av = a[currentInvSort.key], bv = b[currentInvSort.key];
      if (typeof av === 'string') av = av.toLowerCase();
      if (typeof bv === 'string') bv = bv.toLowerCase();
      return av < bv ? -currentInvSort.dir : av > bv ? currentInvSort.dir : 0;
    });

    // Update sort indicators
    document.querySelectorAll('.inv-sort').forEach(function(th) {
      var key = th.getAttribute('data-sort');
      th.textContent = (key === 'name' ? 'Product' : 'Quantity') +
        (currentInvSort.key === key ? (currentInvSort.dir === 1 ? ' ↑' : ' ↓') : ' ↕');
    });

    if (filtered.length === 0) {
      invTableBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--color-text-muted)">No products found.</td></tr>';
      return;
    }

    invTableBody.innerHTML = '';
    filtered.forEach(function(p) {
      var isLow = p.quantity <= p.low_stock_qty;
      var srcColor = SOURCE_COLORS[p.source] || '#9ca3af';
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><strong>' + esc(p.name) + '</strong></td>' +
        '<td><span style="display:inline-block;background:' + srcColor + ';color:#fff;border-radius:10px;padding:.1rem .55rem;font-size:.78rem;font-weight:600">' + esc(p.source || 'Other') + '</span></td>' +
        '<td>' + esc(p.category) + '</td>' +
        '<td>' + esc(p.unit) + '</td>' +
        '<td>' +
          '<div style="display:flex;align-items:center;gap:.4rem">' +
            '<button class="btn-icon inv-dec" data-id="' + p.id + '" data-qty="' + p.quantity + '" title="Decrease">−</button>' +
            '<span class="inv-qty" id="qty-' + p.id + '">' + p.quantity + '</span>' +
            '<button class="btn-icon inv-inc" data-id="' + p.id + '" data-qty="' + p.quantity + '" title="Increase">+</button>' +
          '</div>' +
        '</td>' +
        '<td>' + (isLow ? '<span class="role-badge role-admin" style="background:var(--color-warn,#f59e0b);color:#fff">Low</span>' : '<span class="role-badge role-installer">OK</span>') + '</td>' +
        (isAdmin ?
          '<td class="user-actions">' +
            '<button class="btn-icon btn-edit" title="Edit product" data-id="' + p.id + '">' +
              '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events:none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
            '</button>' +
            '<button class="btn-icon btn-delete" title="Remove product" data-id="' + p.id + '" data-name="' + esc(p.name) + '">' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="pointer-events:none"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
            '</button>' +
          '</td>'
          : '<td></td>') ;
      invTableBody.appendChild(tr);
    });

    // Qty buttons
    invTableBody.querySelectorAll('.inv-inc').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = +this.getAttribute('data-id');
        var qty = +this.getAttribute('data-qty');
        updateProductQty(id, qty + 1);
      });
    });
    invTableBody.querySelectorAll('.inv-dec').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var id = +this.getAttribute('data-id');
        var qty = +this.getAttribute('data-qty');
        if (qty <= 0) return;
        updateProductQty(id, qty - 1);
      });
    });
    if (isAdmin) {
      invTableBody.querySelectorAll('.btn-edit').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = +this.getAttribute('data-id');
          var product = allProducts.find(function(p) { return p.id === id; });
          if (product) setInvFormMode('edit', product);
        });
      });
      invTableBody.querySelectorAll('.btn-delete').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = this.getAttribute('data-id');
          var name = this.getAttribute('data-name');
          showConfirmDialog('Remove ' + name + '?', 'This product will be permanently deleted.', 'Remove', function() { deleteProduct(id); });
        });
      });
    }
  }

  async function updateProductQty(id, newQty) {
    try {
      var res = await fetch(API + '/api/products/' + id, {
        method: 'PUT',
        headers: apiHeaders(),
        body: JSON.stringify({ quantity: newQty })
      });
      if (res.ok) {
        var data = await res.json();
        // Update allProducts and re-render
        allProducts = allProducts.map(function(p) { return p.id === data.id ? data : p; });
        renderInventory(allProducts);
      }
    } catch(e) { showInvMsg('Connection error.', true); }
  }

  async function deleteProduct(id) {
    try {
      var res = await fetch(API + '/api/products/' + id, { method: 'DELETE', headers: apiHeaders() });
      if (res.ok) { showInvMsg('Product removed.', false); loadInventory(); }
      else { showInvMsg('Could not remove product.', true); }
    } catch(e) { showInvMsg('Connection error.', true); }
  }

  var invSubmitBtn = document.getElementById('inv-submit-btn');
  var invCancelBtn = document.getElementById('inv-cancel-btn');
  var invFormTitle = document.getElementById('inv-form-title');
  var editProductIdField = document.getElementById('edit-product-id');

  function setInvFormMode(mode, product) {
    if (mode === 'edit' && product) {
      editProductIdField.value = product.id;
      document.getElementById('prod-name').value = product.name || '';
      document.getElementById('prod-source').value = product.source || 'Other';
      document.getElementById('prod-qty').value = product.quantity || 0;
      document.getElementById('prod-low').value = product.low_stock_qty || 5;
      // Set selects after a tick so they're populated
      setTimeout(function() {
        document.getElementById('prod-category').value = product.category || '';
        document.getElementById('prod-unit').value = product.unit || '';
      }, 50);
      if (invSubmitBtn) invSubmitBtn.textContent = 'Save Changes';
      if (invCancelBtn) invCancelBtn.hidden = false;
      if (invFormTitle) invFormTitle.innerHTML = invFormTitle.innerHTML.replace('Add Product', 'Edit Product');
      invAddCard.hidden = false;
      invAddCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      editProductIdField.value = '';
      addProductForm.reset();
      if (invSubmitBtn) invSubmitBtn.textContent = 'Add Product';
      if (invCancelBtn) invCancelBtn.hidden = true;
      if (invFormTitle) invFormTitle.innerHTML = invFormTitle.innerHTML.replace('Edit Product', 'Add Product');
    }
  }

  if (invCancelBtn) {
    invCancelBtn.addEventListener('click', function() { setInvFormMode('add'); });
  }

  if (addProductForm) {
    addProductForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var editId = editProductIdField ? editProductIdField.value : '';
      var body = {
        name: document.getElementById('prod-name').value.trim(),
        category: document.getElementById('prod-category').value,
        source: document.getElementById('prod-source').value,
        unit: document.getElementById('prod-unit').value,
        quantity: parseFloat(document.getElementById('prod-qty').value) || 0,
        low_stock_qty: parseFloat(document.getElementById('prod-low').value) || 5
      };
      if (!body.name) { showInvMsg('Product name is required.', true); return; }
      try {
        var isEdit = !!editId;
        var res = await fetch(
          API + '/api/products' + (isEdit ? '/' + editId : ''),
          { method: isEdit ? 'PUT' : 'POST', headers: apiHeaders(), body: JSON.stringify(body) }
        );
        if (res.ok) {
          showInvMsg(body.name + (isEdit ? ' updated.' : ' added.'), false);
          setInvFormMode('add');
          var updated = await res.json();
          if (isEdit) {
            allProducts = allProducts.map(function(p) { return p.id === updated.id ? updated : p; });
          } else {
            allProducts.push(updated);
          }
          renderInventory(allProducts);
        } else {
          var err = await res.json();
          showInvMsg(err.detail || 'Could not save product.', true);
        }
      } catch(e) { showInvMsg('Connection error.', true); }
    });
  }

  // Snapshot report
  var invReportBtn = document.getElementById('inv-report-btn');
  if (invReportBtn) {
    invReportBtn.addEventListener('click', async function() {
      var res = await fetch(API + '/api/products', { headers: apiHeaders() });
      var products = await res.json();
      var now = new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
      var rows = products.map(function(p) {
        var status = p.quantity <= p.low_stock_qty ? '⚠ LOW' : 'OK';
        return '<tr><td>' + esc(p.name) + '</td><td>' + esc(p.category) + '</td><td>' + p.quantity + ' ' + esc(p.unit) + '</td><td>' + status + '</td></tr>';
      }).join('');
      var html = '<html><head><title>Inventory Snapshot</title><style>body{font-family:sans-serif;padding:2rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:.5rem .75rem;text-align:left}th{background:#f3f4f6}h2{margin-bottom:.25rem}p{color:#6b7280;margin:0 0 1rem}</style></head><body><h2>Inventory Snapshot — GF Fairfax</h2><p>' + now + '</p><table><thead><tr><th>Product</th><th>Category</th><th>Quantity</th><th>Status</th></tr></thead><tbody>' + rows + '</tbody></table></body></html>';
      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    });
  }

  // ==========================================
  // JOBS
  // ==========================================

  var addJobForm = document.getElementById('add-job-form');
  var jobsList = document.getElementById('jobs-list');
  var jobsMsg = document.getElementById('jobs-msg');
  var jobsStats = document.getElementById('jobs-stats');
  var jobsFilterBtns = document.querySelectorAll('.jobs-filter');
  var currentJobFilter = 'all';
  var allJobs = [];

  function showJobsMsg(text, isError) {
    if (!jobsMsg) return;
    jobsMsg.textContent = text;
    jobsMsg.className = 'admin-msg ' + (isError ? 'admin-msg-error' : 'admin-msg-success');
    jobsMsg.hidden = false;
    setTimeout(function() { jobsMsg.hidden = true; }, 4000);
  }

  jobsFilterBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      currentJobFilter = this.getAttribute('data-filter');
      jobsFilterBtns.forEach(function(b) { b.classList.remove('active'); });
      this.classList.add('active');
      renderJobs(allJobs);
    });
  });

  async function loadJobs() {
    if (!jobsList || !authToken) return;
    try {
      var res = await fetch(API + '/api/jobs', { headers: apiHeaders() });
      if (!res.ok) return;
      allJobs = await res.json();
      renderJobs(allJobs);
    } catch(e) {
      if (jobsList) jobsList.innerHTML = '<div style="text-align:center;color:var(--color-text-muted);padding:2rem">Could not load jobs.</div>';
    }
  }

  var STATUS_LABELS = { upcoming: 'Upcoming', in_progress: 'In Progress', completed: 'Completed', cancelled: 'Cancelled' };
  var STATUS_COLORS = { upcoming: '#3b82f6', in_progress: '#f59e0b', completed: '#22c55e', cancelled: '#9ca3af' };

  function renderJobs(jobs) {
    if (!jobsList) return;
    // Stats
    var counts = { upcoming: 0, in_progress: 0, completed: 0, cancelled: 0 };
    jobs.forEach(function(j) { if (counts[j.status] !== undefined) counts[j.status]++; });
    if (jobsStats) {
      jobsStats.innerHTML =
        '<div class="stat-card"><span class="stat-num">' + counts.upcoming + '</span><span class="stat-label">Upcoming</span></div>' +
        '<div class="stat-card stat-warn"><span class="stat-num">' + counts.in_progress + '</span><span class="stat-label">In Progress</span></div>' +
        '<div class="stat-card stat-ok"><span class="stat-num">' + counts.completed + '</span><span class="stat-label">Completed</span></div>';
    }

    var filtered = currentJobFilter === 'all' ? jobs : jobs.filter(function(j) { return j.status === currentJobFilter; });
    if (filtered.length === 0) {
      jobsList.innerHTML = '<div style="text-align:center;color:var(--color-text-muted);padding:2rem">No jobs found.</div>';
      return;
    }

    var isAdmin = currentUser && currentUser.role === 'admin';
    jobsList.innerHTML = '';
    filtered.forEach(function(j) {
      var card = document.createElement('div');
      card.className = 'job-card';
      var statusColor = STATUS_COLORS[j.status] || '#9ca3af';
      var statusLabel = STATUS_LABELS[j.status] || j.status;
      var dateStr = j.job_date ? new Date(j.job_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';

      // Status options for dropdown
      var statusOpts = Object.keys(STATUS_LABELS).map(function(s) {
        return '<option value="' + s + '"' + (j.status === s ? ' selected' : '') + '>' + STATUS_LABELS[s] + '</option>';
      }).join('');

      card.innerHTML =
        '<div class="job-card-header">' +
          '<div>' +
            '<span class="job-customer">' + esc(j.customer_name) + '</span>' +
            '<span class="job-type-badge">' + esc(j.job_type) + '</span>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:.5rem">' +
            '<select class="job-status-select" data-id="' + j.id + '" style="border:none;background:' + statusColor + ';color:#fff;border-radius:12px;padding:.2rem .6rem;font-size:.8rem;font-weight:600;cursor:pointer">' + statusOpts + '</select>' +
            (isAdmin ? '<button class="btn-icon btn-delete job-delete" title="Delete job" data-id="' + j.id + '" data-name="' + esc(j.customer_name) + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg></button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="job-card-body">' +
          (j.address ? '<div class="job-detail"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> ' + esc(j.address) + '</div>' : '') +
          '<div class="job-detail"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> ' + dateStr + '</div>' +
          (j.assigned_to ? '<div class="job-detail"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ' + esc(j.assigned_to) + '</div>' : '') +
          (j.notes ? '<div class="job-detail job-notes">' + esc(j.notes) + '</div>' : '') +
        '</div>';

      jobsList.appendChild(card);
    });

    // Status change
    jobsList.querySelectorAll('.job-status-select').forEach(function(sel) {
      sel.addEventListener('change', async function() {
        var id = this.getAttribute('data-id');
        var newStatus = this.value;
        var color = STATUS_COLORS[newStatus] || '#9ca3af';
        this.style.background = color;
        try {
          await fetch(API + '/api/jobs/' + id, { method: 'PUT', headers: apiHeaders(), body: JSON.stringify({ status: newStatus }) });
          loadJobs();
        } catch(e) { showJobsMsg('Could not update status.', true); }
      });
    });

    if (isAdmin) {
      jobsList.querySelectorAll('.job-delete').forEach(function(btn) {
        btn.addEventListener('click', function() {
          var id = this.getAttribute('data-id');
          var name = this.getAttribute('data-name');
          showConfirmDialog('Delete job for ' + name + '?', 'This cannot be undone.', 'Delete', function() { deleteJob(id); });
        });
      });
    }
  }

  if (addJobForm) {
    addJobForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      var body = {
        customer_name: document.getElementById('job-customer').value.trim(),
        address: document.getElementById('job-address').value.trim(),
        job_date: document.getElementById('job-date').value,
        job_type: document.getElementById('job-type').value,
        assigned_to: document.getElementById('job-assigned').value.trim(),
        notes: document.getElementById('job-notes').value.trim(),
        status: 'upcoming'
      };
      if (!body.customer_name) { showJobsMsg('Customer name is required.', true); return; }
      try {
        var res = await fetch(API + '/api/jobs', { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) });
        if (res.ok) { showJobsMsg('Job added for ' + body.customer_name + '.', false); addJobForm.reset(); loadJobs(); }
        else { var err = await res.json(); showJobsMsg(err.detail || 'Could not add job.', true); }
      } catch(e) { showJobsMsg('Connection error.', true); }
    });
  }

  // --- Export / Print ---
  var jobsExportBtn = document.getElementById('jobs-export-btn');
  if (jobsExportBtn) {
    jobsExportBtn.addEventListener('click', function() {
      // Export whatever is currently filtered, defaulting to upcoming if showing all
      var exportJobs = currentJobFilter === 'all'
        ? allJobs.filter(function(j) { return j.status === 'upcoming'; })
        : allJobs.filter(function(j) { return j.status === currentJobFilter; });

      var filterLabel = currentJobFilter === 'all' ? 'Upcoming' : STATUS_LABELS[currentJobFilter] || currentJobFilter;
      var now = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      var cards = exportJobs.map(function(j) {
        var dateStr = j.job_date
          ? new Date(j.job_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
          : '—';
        return [
          '<div class="job-card">',
          '  <div class="job-header">',
          '    <div class="job-customer">' + esc(j.customer_name) + '</div>',
          '    <div class="job-date">' + dateStr + '</div>',
          '  </div>',
          '  <div class="job-body">',
          '    <div class="job-row"><span class="label">Type</span><span>' + esc(j.job_type) + '</span></div>',
          j.address   ? '    <div class="job-row"><span class="label">Address</span><span>' + esc(j.address) + '</span></div>' : '',
          j.assigned_to ? '    <div class="job-row"><span class="label">Assigned To</span><span>' + esc(j.assigned_to) + '</span></div>' : '',
          j.notes     ? '    <div class="job-row"><span class="label">Notes</span><span>' + esc(j.notes) + '</span></div>' : '',
          '  </div>',
          '</div>'
        ].filter(Boolean).join('\n');
      }).join('\n');

      if (exportJobs.length === 0) {
        cards = '<p style="color:#6b7280;font-style:italic">No jobs to display.</p>';
      }

      var html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>GF Fairfax — ' + filterLabel + ' Jobs</title><style>' +
        'body{font-family:"Helvetica Neue",Arial,sans-serif;margin:0;padding:2rem;color:#111;font-size:14px}' +
        'h1{font-size:1.5rem;margin:0 0 .25rem}' +
        '.meta{color:#6b7280;margin:0 0 1.5rem;font-size:.9rem}' +
        '.job-card{border:1px solid #d1d5db;border-radius:8px;margin-bottom:1.25rem;page-break-inside:avoid;overflow:hidden}' +
        '.job-header{background:#f3f4f6;padding:.75rem 1rem;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #d1d5db}' +
        '.job-customer{font-size:1.15rem;font-weight:700}' +
        '.job-date{font-size:.9rem;color:#374151;font-weight:600}' +
        '.job-body{padding:.75rem 1rem}' +
        '.job-row{display:flex;gap:.75rem;padding:.3rem 0;border-bottom:1px solid #f3f4f6;font-size:.95rem}' +
        '.job-row:last-child{border-bottom:none}' +
        '.label{min-width:100px;font-weight:600;color:#6b7280;flex-shrink:0}' +
        '@media print{body{padding:1rem}.job-card{margin-bottom:1rem}}' +
        '</style></head><body>' +
        '<h1>Garage Force Fairfax — ' + filterLabel + ' Jobs</h1>' +
        '<p class="meta">Printed ' + now + ' &nbsp;·&nbsp; ' + exportJobs.length + ' job' + (exportJobs.length !== 1 ? 's' : '') + '</p>' +
        cards +
        '<script>window.onload=function(){window.print()}<\/script>' +
        '</body></html>';

      var w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
    });
  }

  async function deleteJob(id) {
    try {
      var res = await fetch(API + '/api/jobs/' + id, { method: 'DELETE', headers: apiHeaders() });
      if (res.ok) { showJobsMsg('Job deleted.', false); loadJobs(); }
      else { showJobsMsg('Could not delete job.', true); }
    } catch(e) { showJobsMsg('Connection error.', true); }
  }

  // ==========================================
  // MODAL DIALOGS (replaces prompt/confirm which are blocked in iframes)
  // ==========================================

  function createOverlay() {
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
    // Animate in
    requestAnimationFrame(function() { overlay.classList.add('active'); });
    return overlay;
  }

  function removeOverlay(overlay) {
    overlay.classList.remove('active');
    setTimeout(function() { overlay.remove(); }, 200);
  }

  // --- Password Reset Dialog ---
  function showPasswordDialog(userId, userName) {
    var overlay = createOverlay();
    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML =
      '<h3 class="modal-title">' +
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
        ' Reset Password' +
      '</h3>' +
      '<p class="modal-desc">Enter a new password for <strong>' + esc(userName) + '</strong>.</p>' +
      '<input type="text" class="form-input modal-input" id="modal-pw" placeholder="New password (min 4 characters)" autocomplete="off">' +
      '<p class="modal-hint" id="modal-pw-hint" hidden>Password must be at least 4 characters.</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-outline modal-cancel">Cancel</button>' +
        '<button class="btn btn-primary modal-confirm" id="modal-pw-save">Save Password</button>' +
      '</div>';
    overlay.appendChild(dialog);

    var input = dialog.querySelector('#modal-pw');
    var hint = dialog.querySelector('#modal-pw-hint');
    var saveBtn = dialog.querySelector('#modal-pw-save');
    var cancelBtn = dialog.querySelector('.modal-cancel');

    input.focus();

    saveBtn.addEventListener('click', function() {
      var val = input.value.trim();
      if (val.length < 4) {
        hint.hidden = false;
        input.focus();
        return;
      }
      removeOverlay(overlay);
      resetPassword(userId, val);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') saveBtn.click();
      if (e.key === 'Escape') cancelBtn.click();
    });

    cancelBtn.addEventListener('click', function() {
      removeOverlay(overlay);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) removeOverlay(overlay);
    });
  }

  // --- Confirm Dialog ---
  function showConfirmDialog(title, message, actionLabel, onConfirm) {
    var overlay = createOverlay();
    var dialog = document.createElement('div');
    dialog.className = 'modal-dialog';
    dialog.innerHTML =
      '<h3 class="modal-title">' + esc(title) + '</h3>' +
      '<p class="modal-desc">' + esc(message) + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-outline modal-cancel">Cancel</button>' +
        '<button class="btn btn-danger modal-confirm">' + esc(actionLabel) + '</button>' +
      '</div>';
    overlay.appendChild(dialog);

    var confirmBtn = dialog.querySelector('.modal-confirm');
    var cancelBtn = dialog.querySelector('.modal-cancel');

    confirmBtn.focus();

    confirmBtn.addEventListener('click', function() {
      removeOverlay(overlay);
      onConfirm();
    });

    cancelBtn.addEventListener('click', function() {
      removeOverlay(overlay);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) removeOverlay(overlay);
    });

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        removeOverlay(overlay);
        document.removeEventListener('keydown', handler);
      }
    });
  }

})();
