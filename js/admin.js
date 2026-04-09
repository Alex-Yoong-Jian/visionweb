'use strict';

/* ═══════════════════════════════════════════════
   ADMIN PANEL
   Access: triple-tap version badge within 1.5s
   Auth:   PIN validated server-side via /api/admin-auth
   Token:  stored in sessionStorage (clears on tab close)
   Data:   paginated issue reports from /api/admin
═══════════════════════════════════════════════ */
const AdminPanel = (() => {
  const STORAGE_KEY = 'visionweb_admin_token';
  let currentPage = 1;
  let totalPages  = 1;

  // ── Triple-tap detection on version badge ──
  let tapCount = 0;
  let tapTimer = null;

  function initBadgeTap() {
    const badge = document.getElementById('version-badge');
    badge.addEventListener('click', () => {
      tapCount++;
      clearTimeout(tapTimer);
      if (tapCount >= 3) {
        tapCount = 0;
        open();
      } else {
        tapTimer = setTimeout(() => { tapCount = 0; }, 1500);
      }
    });
  }

  function open() {
    // Hide chrome elements not needed in admin
    document.getElementById('report-btn-trigger').style.display = 'none';
    document.getElementById('unlock-toggle').style.display      = 'none';

    ScreenManager.show('admin');

    const token = sessionStorage.getItem(STORAGE_KEY);
    if (token) {
      showIssues();
      fetchPage(currentPage);
    } else {
      showPinEntry();
    }
  }

  function close() {
    document.getElementById('report-btn-trigger').style.display = '';
    document.getElementById('unlock-toggle').style.display      = '';
    App.showPrompt();
  }

  function showPinEntry() {
    document.getElementById('admin-pin-wrap').classList.remove('hidden');
    document.getElementById('admin-issues-wrap').classList.add('hidden');
    document.getElementById('admin-pin-input').value    = '';
    document.getElementById('admin-pin-error').textContent = '';
  }

  function showIssues() {
    document.getElementById('admin-pin-wrap').classList.add('hidden');
    document.getElementById('admin-issues-wrap').classList.remove('hidden');
  }

  async function authenticate() {
    const pin = document.getElementById('admin-pin-input').value.trim();
    const btn = document.getElementById('admin-pin-btn');
    const err = document.getElementById('admin-pin-error');

    if (!pin) return;
    btn.disabled    = true;
    btn.textContent = 'Verifying…';
    err.textContent = '';

    try {
      const resp = await fetch('/api/admin-auth', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ pin }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        err.textContent    = data.error || 'Invalid PIN';
        btn.disabled       = false;
        btn.textContent    = 'Unlock';
        return;
      }

      sessionStorage.setItem(STORAGE_KEY, data.token);
      showIssues();
      fetchPage(1);
    } catch {
      err.textContent = 'Connection error. Please try again.';
      btn.disabled    = false;
      btn.textContent = 'Unlock';
    }
  }

  async function fetchPage(page) {
    const token = sessionStorage.getItem(STORAGE_KEY);
    const list  = document.getElementById('admin-issues-list');
    list.innerHTML = '<div class="admin-loading">Loading…</div>';

    try {
      const resp = await fetch('/api/admin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, page }),
      });

      if (resp.status === 401) {
        sessionStorage.removeItem(STORAGE_KEY);
        showPinEntry();
        return;
      }

      const data  = await resp.json();
      currentPage = data.page;
      totalPages  = data.totalPages;

      document.getElementById('admin-total').textContent     = `${data.total} report${data.total !== 1 ? 's' : ''}`;
      document.getElementById('admin-page-info').textContent = `${currentPage} / ${totalPages}`;
      document.getElementById('admin-prev-btn').disabled     = currentPage <= 1;
      document.getElementById('admin-next-btn').disabled     = currentPage >= totalPages;

      renderIssues(data.issues);
    } catch {
      list.innerHTML = '<div class="admin-loading">Failed to load. Please try again.</div>';
    }
  }

  function renderIssues(issues) {
    const list = document.getElementById('admin-issues-list');
    if (!issues || issues.length === 0) {
      list.innerHTML = '<div class="admin-loading">No reports submitted yet.</div>';
      return;
    }

    list.innerHTML = issues.map(issue => {
      const shortId = issue.id.slice(0, 8).toUpperCase();
      const elapsed = timeAgo(issue.created_at);
      const date    = new Date(issue.created_at).toLocaleDateString('en-MY', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      const device  = [issue.browser, issue.os, issue.brand, issue.model]
        .filter(Boolean).join(' · ') || 'Unknown device';

      return `
        <div class="admin-issue-card" onclick="AdminPanel.toggleDesc('${issue.id}')">
          <div class="admin-issue-row">
            <span class="admin-issue-id">#${escHtml(shortId)}</span>
            <span class="admin-issue-elapsed">${escHtml(elapsed)}</span>
          </div>
          <div class="admin-issue-email">${escHtml(issue.email)}</div>
          <div class="admin-issue-title">${escHtml(issue.title)}</div>
          <div class="admin-issue-meta">${escHtml(device)} · ${date}</div>
          <div class="admin-issue-desc hidden" id="desc-${issue.id}">${escHtml(issue.description)}</div>
        </div>`;
    }).join('');
  }

  function toggleDesc(id) {
    const el = document.getElementById('desc-' + id);
    if (el) el.classList.toggle('hidden');
  }

  function logout() {
    sessionStorage.removeItem(STORAGE_KEY);
    showPinEntry();
  }

  // ── Helpers ──

  function timeAgo(dateStr) {
    const diff  = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins  < 1)  return 'just now';
    if (mins  < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days  < 7)  return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-MY', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function init() {
    initBadgeTap();
    document.getElementById('admin-pin-btn').addEventListener('click', authenticate);
    document.getElementById('admin-pin-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') authenticate();
    });
    document.getElementById('admin-logout-btn').addEventListener('click', logout);
    document.getElementById('admin-close-btn').addEventListener('click', close);
    document.getElementById('admin-prev-btn').addEventListener('click', () => {
      if (currentPage > 1) fetchPage(currentPage - 1);
    });
    document.getElementById('admin-next-btn').addEventListener('click', () => {
      if (currentPage < totalPages) fetchPage(currentPage + 1);
    });
  }

  return { init, toggleDesc };
})();
