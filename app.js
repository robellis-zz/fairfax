// ==========================================
// Garage Force Fairfax — Installer Portal JS
// ==========================================

(function() {
  'use strict';

  const API = "port/8000".startsWith("__") ? "http://localhost:8000" : "port/8000";

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

      // Load users when admin panel is opened
      if (target === 'admin') loadUsers();
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
