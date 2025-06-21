import { auth, db } from './firebase.js';
import { logAuditAction } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, query, where, addDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const tbody = document.getElementById('userTableBody');
const searchInput = document.getElementById('userSearch');
let userRolesMap = {};
let availableRoles = [];

async function fetchRoles() {
  const snap = await getDocs(collection(db, 'roles'));
  availableRoles = snap.docs.map(d => d.id);
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString();
}

function filterRows() {
  const term = searchInput.value.trim().toLowerCase();
  tbody.querySelectorAll('tr').forEach(tr => {
    tr.style.display = tr.textContent.toLowerCase().includes(term) ? '' : 'none';
  });
}

searchInput?.addEventListener('input', filterRows);

async function loadUsers() {
  if (!db) return;
  try {
    const roleSnap = await getDocs(collection(db, 'userRoles'));
    userRolesMap = {};
    roleSnap.forEach(d => {
      const data = d.data();
      if (!userRolesMap[data.userId]) userRolesMap[data.userId] = [];
      userRolesMap[data.userId].push(data.roleId);
    });
    const snap = await getDocs(collection(db, 'users'));
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      const tr = document.createElement('tr');
      const name = data.displayName || data.name || '';
      const role = (userRolesMap[doc.id] || []).join(', ');
      const dept = data.department || '';
      const projects = (data.projects || []).length;
      const last = formatDate(data.lastLogin);
      const status = data.status || (data.disabled ? 'Suspended' : (data.emailVerified ? 'Active' : 'Pending'));
      tr.innerHTML = `
        <td><div class="avatar-name">${name}</div></td>
        <td>${data.email || ''}</td>
        <td>${role}</td>
        <td>${dept}</td>
        <td>${projects}</td>
        <td>${last}</td>
        <td>${status}</td>
        <td><button class="action-btn secondary small" data-id="${doc.id}">Edit</button></td>`;
      tbody.appendChild(tr);
    });
    filterRows();
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

tbody.addEventListener('click', async e => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const userId = btn.dataset.id;
  const current = (userRolesMap[userId] || []).join(', ');
  const input = prompt(`Assign roles (comma separated). Available: ${availableRoles.join(', ')}`, current);
  if (input === null) return;
  const roles = input.split(',').map(r => r.trim()).filter(Boolean);
  try {
    const snap = await getDocs(query(collection(db, 'userRoles'), where('userId', '==', userId)));
    const ops = [];
    snap.forEach(d => ops.push(deleteDoc(d.ref)));
    roles.forEach(r => ops.push(addDoc(collection(db, 'userRoles'), { userId, roleId: r, assignedAt: new Date() })));
    await Promise.all(ops);
    logAuditAction(auth.currentUser?.uid, 'setUserRoles', userId, { roles });
    loadUsers();
  } catch (err) {
    console.error('Failed to update roles', err);
  }
});

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    fetchRoles().then(loadUsers);
  }
});
