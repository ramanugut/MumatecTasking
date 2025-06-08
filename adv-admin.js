import { auth, db, functions } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';

const unauthEl = document.getElementById('unauth');
const controlsEl = document.getElementById('advControls');

// Organization
const orgName = document.getElementById('orgName');
const brandColor = document.getElementById('brandColor');
const domains = document.getElementById('domains');
const saveOrgBtn = document.getElementById('saveOrg');

// Security
const minPass = document.getElementById('minPass');
const sessionTimeout = document.getElementById('sessionTimeout');
const allowedIps = document.getElementById('allowedIps');
const saveSecurityBtn = document.getElementById('saveSecurity');

// Integrations
const webhook = document.getElementById('webhook');
const saveIntegrationBtn = document.getElementById('saveIntegration');
const newKeyBtn = document.getElementById('newKey');
const keysTable = document.querySelector('#keysTable tbody');

// Backup & compliance
const exportUsersBtn = document.getElementById('exportUsers');
const gdprEmail = document.getElementById('gdprEmail');
const reqGdprBtn = document.getElementById('reqGdpr');
const exportAuditBtn = document.getElementById('exportAudit');

function handleError(err) {
  console.error(err);
  alert(err.message);
}

async function loadSettings() {
  const get = httpsCallable(functions, 'getSettings');
  try {
    let res = await get({ section: 'organization' });
    if (res.data.settings) {
      const s = res.data.settings;
      orgName.value = s.name || '';
      brandColor.value = s.brandColor || '#000000';
      domains.value = (s.domains || []).join(', ');
    }
    res = await get({ section: 'security' });
    if (res.data.settings) {
      const s = res.data.settings;
      minPass.value = s.minPass || '';
      sessionTimeout.value = s.sessionTimeout || '';
      allowedIps.value = (s.allowedIps || []).join(', ');
    }
    res = await get({ section: 'integrations' });
    if (res.data.settings) {
      const s = res.data.settings;
      webhook.value = s.webhook || '';
    }
    await loadKeys();
  } catch (err) {
    handleError(err);
  }
}

async function saveSection(section, settings) {
  const fn = httpsCallable(functions, 'updateSettings');
  try {
    await fn({ section, settings });
    alert('Saved');
  } catch (err) {
    handleError(err);
  }
}

saveOrgBtn?.addEventListener('click', () => {
  saveSection('organization', {
    name: orgName.value.trim(),
    brandColor: brandColor.value,
    domains: domains.value.split(',').map(d => d.trim()).filter(Boolean)
  });
});

saveSecurityBtn?.addEventListener('click', () => {
  saveSection('security', {
    minPass: parseInt(minPass.value, 10) || 6,
    sessionTimeout: parseInt(sessionTimeout.value, 10) || 60,
    allowedIps: allowedIps.value.split(',').map(d => d.trim()).filter(Boolean)
  });
});

saveIntegrationBtn?.addEventListener('click', () => {
  saveSection('integrations', { webhook: webhook.value.trim() });
});

newKeyBtn?.addEventListener('click', async () => {
  const fn = httpsCallable(functions, 'createApiKey');
  try {
    const res = await fn();
    alert('New key: ' + res.data.key);
    loadKeys();
  } catch (err) {
    handleError(err);
  }
});

async function loadKeys() {
  keysTable.innerHTML = '';
  const fn = httpsCallable(functions, 'listApiKeys');
  try {
    const res = await fn();
    (res.data.keys || []).forEach(k => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${k.id}</td><td>${k.key}</td><td><button data-id="${k.id}">Revoke</button></td>`;
      keysTable.appendChild(tr);
    });
  } catch (err) {
    handleError(err);
  }
}

keysTable.addEventListener('click', async e => {
  if (e.target.dataset.id) {
    if (!confirm('Revoke this key?')) return;
    const fn = httpsCallable(functions, 'revokeApiKey');
    try {
      await fn({ id: e.target.dataset.id });
      loadKeys();
    } catch (err) {
      handleError(err);
    }
  }
});

exportUsersBtn?.addEventListener('click', async () => {
  const fn = httpsCallable(functions, 'exportUserData');
  try {
    const res = await fn();
    const blob = new Blob([JSON.stringify(res.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    handleError(err);
  }
});

reqGdprBtn?.addEventListener('click', async () => {
  const fn = httpsCallable(functions, 'exportUserData');
  try {
    const res = await fn({ email: gdprEmail.value.trim() });
    const blob = new Blob([JSON.stringify(res.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gdpr-data.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    handleError(err);
  }
});

exportAuditBtn?.addEventListener('click', async () => {
  const fn = httpsCallable(functions, 'exportAuditLogs');
  try {
    const res = await fn();
    const blob = new Blob([JSON.stringify(res.data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'auditLogs.json';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    handleError(err);
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  const token = await user.getIdTokenResult();
  if (['admin', 'superAdmin'].includes(token.claims.role)) {
    controlsEl.style.display = 'block';
    loadSettings();
  } else {
    unauthEl.style.display = 'block';
  }
});
