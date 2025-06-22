import { auth, db } from './firebase.js';
import { logAuditAction } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, setDoc, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const editRoleModal = document.getElementById('editRoleModal');
const editRoleClose = document.getElementById('editRoleClose');
const roleForm = document.getElementById('roleForm');
const roleNameInput = document.getElementById('roleName');
const roleDescInput = document.getElementById('roleDesc');
const rolePermsInput = document.getElementById('rolePerms');
const roleParentSelect = document.getElementById('roleParent');
const editRoleTitle = document.getElementById('editRoleTitle');
const roleCancelBtn = document.getElementById('roleCancel');
let editingRoleId = null;

const tbody = document.getElementById('rolesBody');
const addBtn = document.getElementById('addRole');

async function loadRoles() {
  const snap = await getDocs(collection(db, 'roles'));
  tbody.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const perms = (data.permissions || []).join(', ');
    const parent = data.parentRole || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.id}</td><td>${data.description || ''}</td><td>${parent}</td><td>${perms}</td><td><button class="action-btn secondary small" data-id="${d.id}">Edit</button></td>`;
    tbody.appendChild(tr);
  });
}

function openModal(modal) {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
}

async function populateParentRoles(excludeId) {
  const snap = await getDocs(collection(db, 'roles'));
  roleParentSelect.innerHTML = '<option value="">None</option>';
  snap.forEach(d => {
    if (d.id !== excludeId) {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.id;
      roleParentSelect.appendChild(opt);
    }
  });
}

async function showEditModal(id) {
  editingRoleId = id || null;
  roleForm.reset();
  roleNameInput.disabled = !!id;
  await populateParentRoles(id);
  if (id) {
    const snap = await getDoc(doc(db, 'roles', id));
    const data = snap.exists() ? snap.data() : {};
    roleNameInput.value = id;
    roleDescInput.value = data.description || '';
    rolePermsInput.value = (data.permissions || []).join(', ');
    roleParentSelect.value = data.parentRole || '';
    editRoleTitle.textContent = 'Edit Role';
  } else {
    editRoleTitle.textContent = 'Add Role';
  }
  openModal(editRoleModal);
}

tbody.addEventListener('click', e => {
  const id = e.target.closest('button[data-id]')?.dataset.id;
  if (!id) return;
  showEditModal(id);
});

addBtn.addEventListener('click', () => {
  showEditModal();
});

editRoleClose.addEventListener('click', () => closeModal(editRoleModal));
roleCancelBtn.addEventListener('click', () => closeModal(editRoleModal));
editRoleModal.addEventListener('click', e => { if (e.target === editRoleModal) closeModal(editRoleModal); });

roleForm.addEventListener('submit', async e => {
  e.preventDefault();
  const name = roleNameInput.value.trim();
  if (!name) return;
  const desc = roleDescInput.value.trim();
  const permsInput = rolePermsInput.value;
  const parentRole = roleParentSelect.value;
  const permissions = permsInput.split(',').map(p => p.trim()).filter(Boolean);
  await setDoc(doc(db, 'roles', name), { description: desc, permissions, parentRole }, { merge: true });
  const action = editingRoleId ? 'updateRole' : 'createRole';
  logAuditAction(auth.currentUser?.uid, action, name, { description: desc, permissions, parentRole });
  closeModal(editRoleModal);
  loadRoles();
});

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    loadRoles();
  }
});
