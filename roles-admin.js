import { auth, db } from './firebase.js';
import { logAuditAction } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, setDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const tbody = document.getElementById('rolesBody');
const addBtn = document.getElementById('addRole');

async function loadRoles() {
  const snap = await getDocs(collection(db, 'roles'));
  tbody.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const perms = (data.permissions || []).join(', ');
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.id}</td><td>${data.description || ''}</td><td>${perms}</td><td><button class="action-btn secondary small" data-id="${d.id}">Edit</button></td>`;
    tbody.appendChild(tr);
  });
}

tbody.addEventListener('click', async e => {
  const id = e.target.closest('button[data-id]')?.dataset.id;
  if (!id) return;
  const snap = await getDoc(doc(db, 'roles', id));
  const data = snap.exists() ? snap.data() : {};
  const desc = prompt('Role description:', data.description || '')
  if (desc === null) return;
  const permsInput = prompt('Permissions (comma separated):', (data.permissions || []).join(', '));
  if (permsInput === null) return;
  const permissions = permsInput.split(',').map(p => p.trim()).filter(Boolean);
  await setDoc(doc(db, 'roles', id), { description: desc, permissions }, { merge: true });
  logAuditAction(auth.currentUser?.uid, 'updateRole', id, { description: desc, permissions });
  loadRoles();
});

addBtn.addEventListener('click', async () => {
  const name = prompt('Role name:');
  if (!name) return;
  const desc = prompt('Description:') || '';
  const permsInput = prompt('Permissions (comma separated):') || '';
  const permissions = permsInput.split(',').map(p => p.trim()).filter(Boolean);
  await setDoc(doc(db, 'roles', name.trim()), { description: desc, permissions });
  logAuditAction(auth.currentUser?.uid, 'createRole', name.trim(), { description: desc, permissions });
  loadRoles();
});

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    loadRoles();
  }
});
