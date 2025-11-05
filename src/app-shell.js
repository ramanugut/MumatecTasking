const loadShell = async () => {
  const headerHost = document.getElementById('appShellHeader');
  const sidebarHost = document.getElementById('appShellSidebar');
  if (!headerHost && !sidebarHost) {
    return;
  }

  const [headerResponse, sidebarResponse] = await Promise.all([
    fetch('partials/header.html'),
    fetch('partials/sidebar.html')
  ]);

  if (!headerResponse.ok || !sidebarResponse.ok) {
    throw new Error('Failed to load shell partials');
  }

  const [headerHtml, sidebarHtml] = await Promise.all([
    headerResponse.text(),
    sidebarResponse.text()
  ]);

  if (headerHost) {
    headerHost.innerHTML = headerHtml;
  }
  if (sidebarHost) {
    sidebarHost.innerHTML = sidebarHtml;
  }

  document.body.classList.add('shell-ready');
  applyPageMetadata();
  setupDropdownToggle();
  setupSidebarToggle();
  setupShortcutRail();
  markActiveNavLink();
};

const shellReady = new Promise((resolve, reject) => {
  const start = () => {
    loadShell().then(resolve).catch((error) => {
      console.error(error);
      reject(error);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
});

shellReady.catch((error) => {
  console.error('Shell initialization failed', error);
});

window.shellReady = shellReady;

function applyPageMetadata() {
  const title = document.body.dataset.pageTitle;
  const subtitle = document.body.dataset.pageSubtitle;
  if (title) {
    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = title;
  }
  if (subtitle) {
    const subtitleEl = document.getElementById('pageSubtitle');
    if (subtitleEl) subtitleEl.textContent = subtitle;
  }
}

function setupDropdownToggle() {
  const userInfo = document.getElementById('userInfo');
  const dropdown = document.getElementById('profileDropdown');
  if (!userInfo || !dropdown) return;

  userInfo.addEventListener('click', (event) => {
    event.stopPropagation();
    dropdown.classList.toggle('open');
  });

  document.addEventListener('click', (event) => {
    if (!dropdown.contains(event.target) && !userInfo.contains(event.target)) {
      dropdown.classList.remove('open');
    }
  });
}

function setupSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;

  const toggleSidebar = () => {
    if (window.todoApp && typeof window.todoApp.toggleSidebar === 'function') {
      window.todoApp.toggleSidebar();
      return;
    }

    if (window.innerWidth <= 768) {
      sidebar.classList.toggle('open');
    } else {
      sidebar.classList.toggle('collapsed');
    }
  };

  toggle.addEventListener('click', toggleSidebar);
}

function setupShortcutRail() {
  const shortcutButtons = Array.from(document.querySelectorAll('.shortcut-btn'));
  if (!shortcutButtons.length) return;

  const highlight = (focus) => {
    shortcutButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.focus === focus);
    });
  };

  window.highlightHostingShortcut = highlight;

  const urlFocus = new URLSearchParams(window.location.search).get('focus');
  const storedFocus = localStorage.getItem('hostingPreferredFocus');
  const initialFocus = urlFocus || storedFocus || null;
  if (initialFocus) {
    highlight(initialFocus);
    window.pendingShortcutFocus = initialFocus;
  }

  shortcutButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const focus = btn.dataset.focus;
      localStorage.setItem('hostingPreferredFocus', focus);
      highlight(focus);

      if (window.todoApp && typeof window.todoApp.handleHostingShortcut === 'function') {
        window.todoApp.handleHostingShortcut(focus);
      } else if (!window.location.pathname.endsWith('index.html')) {
        const url = new URL(window.location.href);
        url.pathname = 'index.html';
        url.searchParams.set('focus', focus);
        window.location.href = url.toString();
      }
    });
  });

  const provisionBtn = document.getElementById('provisionSiteBtn');
  if (provisionBtn) {
    provisionBtn.addEventListener('click', () => {
      const focus = 'environments';
      localStorage.setItem('hostingPreferredFocus', focus);
      if (window.todoApp && typeof window.todoApp.openAddTaskModal === 'function') {
        window.todoApp.handleHostingShortcut?.(focus);
        window.todoApp.openAddTaskModal('todo');
      } else if (!window.location.pathname.endsWith('index.html')) {
        const url = new URL(window.location.href);
        url.pathname = 'index.html';
        url.searchParams.set('focus', focus);
        url.searchParams.set('intent', 'provision');
        window.location.href = url.toString();
      }
    });
  }

  const addDomainBtn = document.getElementById('addDomainBtn');
  if (addDomainBtn) {
    addDomainBtn.addEventListener('click', () => {
      const focus = 'clients';
      localStorage.setItem('hostingPreferredFocus', focus);
      if (window.todoApp && typeof window.todoApp.openAddTaskModal === 'function') {
        window.todoApp.handleHostingShortcut?.(focus);
        window.todoApp.openAddTaskModal('todo');
      } else if (!window.location.pathname.endsWith('index.html')) {
        const url = new URL(window.location.href);
        url.pathname = 'index.html';
        url.searchParams.set('focus', focus);
        url.searchParams.set('intent', 'domain');
        window.location.href = url.toString();
      }
    });
  }
}

function markActiveNavLink() {
  const shellPage = document.body.dataset.shellPage;
  if (!shellPage) return;
  const selector = `.nav-item[data-shell-link="${shellPage}"]`;
  const link = document.querySelector(selector);
  if (link) {
    link.classList.add('active');
  }
}
