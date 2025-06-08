import { auth, db, functions } from './firebase.js';
import {
  getAuth,
  sendPasswordResetEmail,
  signOut,
  signInWithCustomToken,
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';



const adminControls = document.getElementById('adminControls');
const unauthEl = document.getElementById('unauth');
const userTableBody = document.querySelector('#userTable tbody');
const searchInput = document.getElementById('searchUsers');
const selectAllBox = document.getElementById('selectAll');
const bulkRoleSelect = document.getElementById('bulkRole');
const applyBulkRoleBtn = document.getElementById('applyBulkRole');
const userCsvInput = document.getElementById('userCsv');
const importCsvBtn = document.getElementById('btnImportCsv');
const auditTableBody = document.querySelector('#auditTable tbody');
const ROLES = [
  'superAdmin',
  'admin',
  'projectManager',
  'teamLead',
  'developer',
  'designer',
  'client',
  'guest'
];

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showSystemNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function renderRoleOptions(selected) {
  return ROLES.map(r => `<option value="${r}" ${selected===r?'selected':''}>${r}</option>`).join('');
}

// populate role selects if they exist
const newRoleSelect = document.getElementById('newRole');
if (newRoleSelect) newRoleSelect.innerHTML = renderRoleOptions('guest');
if (bulkRoleSelect) bulkRoleSelect.innerHTML = renderRoleOptions('guest');

function handleError(err) {
  console.error(err);
  if (err.code === 'permission-denied') alert('You are not authorized.');
  else if (err.code === 'unauthenticated') window.location.href = 'login.html';
  else alert(err.message);
}

async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'));
  const query = (searchInput?.value || '').toLowerCase();
  userTableBody.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (query && !data.email.toLowerCase().includes(query) && !(data.displayName || '').toLowerCase().includes(query)) return;
    const tr = document.createElement('tr');
    tr.dataset.uid = docSnap.id;
    tr.dataset.disabled = !!data.disabled;
    const lastLogin = data.lastLogin ? new Date(data.lastLogin.seconds * 1000).toLocaleString() : '';
    tr.innerHTML = `
      <td><input type="checkbox" data-select="${docSnap.id}"></td>
      <td>${data.email}</td>
      <td>${data.displayName || ''}</td>
      <td>
        <select data-uid="${docSnap.id}">
          ${renderRoleOptions(data.role || 'guest')}
        </select>
      </td>
      <td>${data.disabled ? 'Disabled' : 'Active'}</td>
      <td>${lastLogin}</td>
      <td>
        <button data-impersonate="${docSnap.id}">Impersonate</button>
        <button data-toggle="${docSnap.id}" data-disabled="${!!data.disabled}">${data.disabled ? 'Activate' : 'Deactivate'}</button>
        <button data-edit="${docSnap.id}" data-email="${data.email}" data-name="${data.displayName || ''}">Edit</button>
        <button data-reset="${docSnap.id}" data-email="${data.email}">Reset</button>
        <button data-del="${docSnap.id}">Delete</button>
      </td>
    `;
    userTableBody.appendChild(tr);
  });
}

async function loadAuditLogs() {
  const snap = await getDocs(collection(db, 'auditLogs'));
  auditTableBody.innerHTML = '';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    const ts = d.timestamp ? new Date(d.timestamp.seconds * 1000).toLocaleString() : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${ts}</td><td>${d.adminUid}</td><td>${d.action}</td><td>${d.targetUid || ''}</td>`;
    auditTableBody.appendChild(tr);
  });
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  const prof = await getDoc(doc(db, 'users', user.uid));
  if (!prof.exists() || !['admin','superAdmin'].includes(prof.data().role)) {
    unauthEl.style.display = 'block';
    return;
  }
  adminControls.style.display = 'block';
  loadUsers();
  loadAuditLogs();
  requestNotificationPermission();
  const reqRef = collection(db, 'userRequests');
  onSnapshot(reqRef, snap => {
    snap.docChanges().forEach(ch => {
      if (ch.type === 'added') {
        const d = ch.doc.data();
        const msg = d.message || 'New request received';
        showSystemNotification('User Request', msg);
      }
    });
  });
});

// Create user
if (document.getElementById('btnCreateUser')) {
  document.getElementById('btnCreateUser').addEventListener('click', async () => {
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const displayName = document.getElementById('newDisplayName').value.trim();
    const role = document.getElementById('newRole').value;
    try {
      const fn = httpsCallable(functions, 'createUserWithRole');
      await fn({ email, password, displayName, role });
      alert('User successfully created!');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
  });
}

userTableBody.addEventListener('change', async (e) => {
  if (e.target.tagName === 'SELECT') {
    const uid = e.target.getAttribute('data-uid');
    const newRole = e.target.value;
    try {
      const fn = httpsCallable(functions, 'updateUserRole');
      await fn({ targetUid: uid, newRole });
      alert('Role successfully updated!');
    } catch (err) {
      handleError(err);
    }
  }
});

userTableBody.addEventListener('click', async (e) => {
  if (e.target.dataset.del) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const uid = e.target.dataset.del;
    try {
      const fn = httpsCallable(functions, 'deleteUserAccount');
      await fn({ targetUid: uid });
      alert('User deleted');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
    return;
  }

  if (e.target.dataset.reset) {
    const email = e.target.dataset.email;
    if (!confirm(`Send password reset email to ${email}?`)) return;
    try {
      const fn = httpsCallable(functions, 'adminSendPasswordReset');
      await fn({ targetEmail: email });
      alert('Password reset email sent!');
    } catch (err) {
      handleError(err);
    }
    return;
  }

  if (e.target.dataset.edit) {
    const uid = e.target.dataset.edit;
    const currentEmail = e.target.dataset.email;
    const currentName = e.target.dataset.name || '';
    const newEmail = prompt('Email:', currentEmail);
    if (newEmail === null) return;
    const newName = prompt('Display name:', currentName);
    if (newName === null) return;
    try {
      const fn = httpsCallable(functions, 'updateUserProfile');
      await fn({ targetUid: uid, email: newEmail, displayName: newName });
      alert('User profile updated');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
    return;
  }

  if (e.target.dataset.toggle) {
    const uid = e.target.dataset.toggle;
    const disabled = e.target.dataset.disabled === 'true';
    try {
      const fn = httpsCallable(functions, 'setUserDisabled');
      await fn({ targetUid: uid, disabled: !disabled });
      loadUsers();
    } catch (err) {
      handleError(err);
    }
    return;
  }

  if (e.target.dataset.impersonate) {
    const uid = e.target.dataset.impersonate;
    try {
      const fn = httpsCallable(functions, 'impersonateUser');
      const res = await fn({ targetUid: uid });
      const token = res.data.token;
      await signOut(auth);
      const auth2 = getAuth();
      await signInWithCustomToken(auth2, token);
    } catch (err) {
      handleError(err);
    }
    return;
  }
});

if (searchInput) {
  searchInput.addEventListener('input', loadUsers);
}

if (selectAllBox) {
  selectAllBox.addEventListener('change', () => {
    document.querySelectorAll('[data-select]').forEach(cb => {
      cb.checked = selectAllBox.checked;
    });
  });
}

if (applyBulkRoleBtn) {
  applyBulkRoleBtn.addEventListener('click', async () => {
    const role = bulkRoleSelect.value;
    const ids = Array.from(document.querySelectorAll('[data-select]:checked')).map(cb => cb.getAttribute('data-select'));
    if (!ids.length) return;
    try {
      const fn = httpsCallable(functions, 'bulkUpdateRoles');
      await fn({ updates: ids.map(uid => ({ uid, role })) });
      loadUsers();
    } catch (err) {
      handleError(err);
    }
  });
}

if (importCsvBtn) {
  importCsvBtn.addEventListener('click', async () => {
    if (!userCsvInput.files.length) return;
    const text = await userCsvInput.files[0].text();
    const rows = text.split(/\n+/).map(r => r.trim()).filter(r => r);
    const users = rows.map(r => {
      const [email, displayName, role] = r.split(',');
      return { email: email.trim(), displayName: (displayName || '').trim(), role: (role || 'guest').trim() };
    });
    try {
      const fn = httpsCallable(functions, 'bulkInviteUsers');
      await fn({ users });
      alert('CSV processed');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
  });
}

let touchStartX = 0;
let touchRow = null;
userTableBody.addEventListener('touchstart', e => {
  touchRow = e.target.closest('tr');
  if (!touchRow) return;
  touchStartX = e.touches[0].clientX;
});

userTableBody.addEventListener('touchend', async e => {
  if (!touchRow) return;
  const diff = e.changedTouches[0].clientX - touchStartX;
  const uid = touchRow.dataset.uid;
  const disabled = touchRow.dataset.disabled === 'true';
  if (Math.abs(diff) > 60) {
    if (diff < 0) {
      if (confirm('Delete this user?')) {
        try {
          const fn = httpsCallable(functions, 'deleteUserAccount');
          await fn({ targetUid: uid });
          loadUsers();
        } catch (err) { handleError(err); }
      }
    } else {
      try {
        const fn = httpsCallable(functions, 'setUserDisabled');
        await fn({ targetUid: uid, disabled: !disabled });
        loadUsers();
      } catch (err) { handleError(err); }
    }
  }
  touchRow = null;
});
