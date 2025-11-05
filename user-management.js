import { auth, db } from './firebase.js';
import { logAuditAction } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, query, where, addDoc, deleteDoc, doc, writeBatch, updateDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';


const tbody = document.getElementById('userTableBody');
const searchInput = document.getElementById('userSearch');
const bulkBtn = document.getElementById('bulkEditBtn');
const bulkModal = document.getElementById('bulkModal');
const bulkRolesSel = document.getElementById('bulkRoles');
const bulkProjectSel = document.getElementById('bulkProject');
const bulkDeactivateChk = document.getElementById('bulkDeactivate');
const bulkApplyBtn = document.getElementById('bulkApply');
const bulkCancelBtn = document.getElementById('bulkCancel');
const bulkCloseBtn = document.getElementById('bulkClose');
const selectAll = document.getElementById('selectAll');
const rolesNav = document.querySelector('.nav-item[aria-label="User Roles & Permissions"]');
const departmentsNav = document.querySelector('.nav-item[aria-label="Departments/Teams"]');
const invitesNav = document.querySelector('.nav-item[aria-label="Pending Invitations"]');
const auditNav = document.querySelector('.nav-item[aria-label="Audit Logs"]');
const inactiveNav = document.querySelector('.nav-item[aria-label="Inactive Users"]');
const bulkNav = document.querySelector('.nav-item[aria-label="Bulk Actions"]');

const rolesModal = document.getElementById('rolesModal');
const rolesClose = document.getElementById('rolesClose');
const departmentsModal = document.getElementById('departmentsModal');
const departmentsClose = document.getElementById('departmentsClose');
const invitesModal = document.getElementById('invitesModal');
const invitesClose = document.getElementById('invitesClose');
const auditModal = document.getElementById('auditModal');
const auditClose = document.getElementById('auditClose');
const inactiveModal = document.getElementById('inactiveModal');
const inactiveClose = document.getElementById('inactiveClose');
const inactiveBody = document.getElementById('inactiveBody');
let userRolesMap = {};
let availableRoles = [];
let availableProjects = [];
const selectedUsers = new Set();
const userDeptMap = {};
const userTeamMap = {};
const MASTER_ROLE = 'superAdmin';


function lockBodyScroll() {
  document.body?.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (!document.querySelector('.modal-overlay.active')) {
    document.body?.classList.remove('modal-open');
  }
}


async function fetchRoles() {
  const snap = await getDocs(collection(db, 'roles'));
  availableRoles = snap.docs.map(d => d.id);
  if (bulkRolesSel) {
    bulkRolesSel.innerHTML = availableRoles.map(r => `<option value="${r}">${r}</option>`).join('');
  }
}

async function fetchProjects() {
  try {
    const snap = await getDocs(collection(db, 'projects'));
    availableProjects = snap.docs.map(d => ({ id: d.id, ...(d.data() || {}) }));
    if (bulkProjectSel) {
      const opts = ['<option value="">None</option>'];
      opts.push(...availableProjects.map(p => `<option value="${p.id}">${p.name || p.id}</option>`));
      bulkProjectSel.innerHTML = opts.join('');
    }
  } catch (e) {
    console.error('Failed to fetch projects', e);
  }
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

tbody.addEventListener('change', e => {
  const cb = e.target.closest('.row-select');
  if (!cb) return;
  if (cb.checked) {
    selectedUsers.add(cb.dataset.id);
  } else {
    selectedUsers.delete(cb.dataset.id);
  }
});

selectAll?.addEventListener('change', () => {
  const checked = selectAll.checked;
  tbody.querySelectorAll('.row-select').forEach(cb => {
    cb.checked = checked;
    if (checked) selectedUsers.add(cb.dataset.id); else selectedUsers.delete(cb.dataset.id);
  });
});

async function loadUsers() {
  if (!db) return;
  try {
    const roleSnap = await getDocs(collection(db, 'userRoles'));
    userRolesMap = {};
    roleSnap.forEach(d => {
      const data = d.data();
      if (!userRolesMap[data.userId]) userRolesMap[data.userId] = [];
      userRolesMap[data.userId].push({
        roleId: data.roleId,
        projectId: data.projectId || '',
        department: data.department || ''
      });
    });
    const snap = await getDocs(collection(db, 'users'));
    tbody.innerHTML = '';
    selectedUsers.clear();
    if (selectAll) selectAll.checked = false;

    snap.forEach(doc => {
      const data = doc.data();
      userDeptMap[doc.id] = data.department || '';
      userTeamMap[doc.id] = data.team || '';
      const tr = document.createElement('tr');
      const name = data.displayName || data.name || '';
      const role = (userRolesMap[doc.id] || []).map(r => {
        if (r.projectId) return `${r.roleId}:${r.projectId}`;
        if (r.department) return `${r.roleId}@${r.department}`;
        return r.roleId;
      }).join(', ');
      const dept = data.department || '';
      const team = data.team || '';
      const projects = (data.projects || []).length;
      const last = formatDate(data.lastLogin);
      const status = data.status || (data.disabled ? 'Suspended' : (data.emailVerified ? 'Active' : 'Pending'));
      const isMaster = (userRolesMap[doc.id] || []).some(r => r.roleId === MASTER_ROLE);
      const canDelete = window.currentUserRoles?.includes(MASTER_ROLE) && !isMaster && auth.currentUser?.uid !== doc.id;
      const deleteBtn = canDelete ? `<button class="action-btn danger small delete-btn" data-id="${doc.id}">Delete</button>` : '';
      tr.innerHTML = `
        <td><input type="checkbox" class="row-select" data-id="${doc.id}"></td>
        <td><div class="avatar-name">${name}</div></td>
        <td>${data.email || ''}</td>
        <td>${role}</td>
        <td>${dept}</td>
        <td>${team}</td>
        <td>${projects}</td>
        <td>${last}</td>
        <td>${status}</td>
        <td><button class="action-btn secondary small edit-btn" data-id="${doc.id}">Edit</button> ${deleteBtn}</td>`;
      tbody.appendChild(tr);
    });
    filterRows();
  } catch (e) {
    console.error('Failed to load users', e);
  }
}

async function loadInactiveUsers() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'users'));
    inactiveBody.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      if (data.disabled || data.status === 'inactive') {
        const tr = document.createElement('tr');
        const name = data.displayName || data.name || '';
        const last = formatDate(data.lastLogin);
        tr.innerHTML = `<td>${name}</td><td>${data.email || ''}</td><td>${last}</td>`;
        inactiveBody.appendChild(tr);
      }
    });
  } catch (e) {
    console.error('Failed to load inactive users', e);
  }
}

tbody.addEventListener('click', async e => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;
  const userId = btn.dataset.id;
  if (btn.classList.contains('delete-btn')) {
    if (!confirm('Delete this user?')) return;
    try {
      if ((userRolesMap[userId] || []).some(r => r.roleId === MASTER_ROLE)) {
        alert('Master Users cannot be deleted.');
        return;
      }
      const snap = await getDocs(query(collection(db, 'userRoles'), where('userId', '==', userId)));
      const ops = [];
      snap.forEach(d => ops.push(deleteDoc(d.ref)));
      ops.push(deleteDoc(doc(db, 'users', userId)));
      await Promise.all(ops);
      logAuditAction(auth.currentUser?.uid, 'deleteUser', userId);
      loadUsers();
    } catch (err) {
      console.error('Failed to delete user', err);
    }
    return;
  }
  const current = (userRolesMap[userId] || []).map(r => {
    if (r.projectId) return `${r.roleId}:${r.projectId}`;
    if (r.department) return `${r.roleId}@${r.department}`;
    return r.roleId;
  }).join(', ');
  const input = prompt(`Assign roles (comma separated). Use role:projectId or role@department. Available roles: ${availableRoles.join(', ')}`, current);
  if (input === null) return;
  const roles = input.split(',').map(r => r.trim()).filter(Boolean);
  const hadMaster = (userRolesMap[userId] || []).some(r => r.roleId === MASTER_ROLE);
  let updatedRoles = [...roles];
  if (updatedRoles.includes(MASTER_ROLE) && !window.currentUserRoles?.includes(MASTER_ROLE)) {
    alert('Only Master Users can grant superAdmin role.');
    updatedRoles = updatedRoles.filter(r => r !== MASTER_ROLE);
  }
  if (updatedRoles.includes(MASTER_ROLE) && !hadMaster) {
    if (!confirm('Grant Master User privileges to this user?')) {
      updatedRoles = updatedRoles.filter(r => r !== MASTER_ROLE);
    }
  }
  if (hadMaster && !updatedRoles.includes(MASTER_ROLE)) {
    alert('Master Users cannot lose the superAdmin role.');
    updatedRoles.push(MASTER_ROLE);
  }
  const dept = prompt('Department:', userDeptMap[userId] || '')
  if (dept === null) return;
  const team = prompt('Team:', userTeamMap[userId] || '')
  if (team === null) return;
  try {
    const snap = await getDocs(query(collection(db, 'userRoles'), where('userId', '==', userId)));
    const ops = [];
    snap.forEach(d => ops.push(deleteDoc(d.ref)));

    updatedRoles.forEach(r => ops.push(addDoc(collection(db, 'userRoles'), { userId, roleId: r, assignedAt: new Date() })));
    ops.push(updateDoc(doc(db, 'users', userId), { department: dept.trim() || null, team: team.trim() || null }));
    if (dept.trim()) {
      ops.push(setDoc(doc(db, 'departments', dept.trim()), { createdAt: new Date() }, { merge: true }));
      ops.push(setDoc(doc(db, 'departments', dept.trim(), 'members', userId), { assignedAt: new Date() }));
    }
    if (team.trim()) {
      ops.push(setDoc(doc(db, 'teams', team.trim()), { createdAt: new Date() }, { merge: true }));
      ops.push(setDoc(doc(db, 'teams', team.trim(), 'members', userId), { assignedAt: new Date() }));
    }

    await Promise.all(ops);
    logAuditAction(auth.currentUser?.uid, 'setUserRoles', userId, { roles: updatedRoles });
    loadUsers();
  } catch (err) {
    console.error('Failed to update roles', err);
  }
});

function openBulkModal() {
  bulkModal.classList.add('active');
  bulkModal.setAttribute('aria-hidden', 'false');
  lockBodyScroll();
}

function closeBulkModal() {
  bulkModal.classList.remove('active');
  bulkModal.setAttribute('aria-hidden', 'true');
  unlockBodyScroll();
}

function openModal(modal) {
  modal.classList.add('active');
  modal.setAttribute('aria-hidden', 'false');
  lockBodyScroll();
}

function closeModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  unlockBodyScroll();
}

bulkBtn?.addEventListener('click', () => {
  if (selectedUsers.size === 0) {
    alert('Select users first');
    return;
  }
  openBulkModal();
});

bulkCloseBtn?.addEventListener('click', closeBulkModal);
bulkCancelBtn?.addEventListener('click', closeBulkModal);
bulkModal?.addEventListener('click', e => { if (e.target === bulkModal) closeBulkModal(); });

bulkApplyBtn?.addEventListener('click', async () => {
  const roles = Array.from(bulkRolesSel.selectedOptions).map(o => o.value).filter(Boolean);
  const projectId = bulkProjectSel.value;
  const deactivate = bulkDeactivateChk.checked;
  if (!roles.length && !projectId && !deactivate) { closeBulkModal(); return; }
  try {
    const batch = writeBatch(db);
    for (const uid of selectedUsers) {
      if (roles.length) {
        const snap = await getDocs(query(collection(db, 'userRoles'), where('userId', '==', uid)));
        snap.forEach(d => batch.delete(d.ref));
        roles.forEach(r => batch.set(doc(collection(db, 'userRoles')), { userId: uid, roleId: r, assignedAt: new Date() }));
      }
      if (projectId) {
        batch.set(doc(db, 'users', uid), { projects: [projectId] }, { merge: true });
      }
      if (deactivate) {
        batch.update(doc(db, 'users', uid), { disabled: true });
      }
    }
    await batch.commit();
    closeBulkModal();
    loadUsers();
  } catch (err) {
    console.error('Failed to apply bulk changes', err);
  }
});

rolesNav?.addEventListener('click', () => openModal(rolesModal));
rolesClose?.addEventListener('click', () => closeModal(rolesModal));
rolesModal?.addEventListener('click', e => { if (e.target === rolesModal) closeModal(rolesModal); });

departmentsNav?.addEventListener('click', () => openModal(departmentsModal));
departmentsClose?.addEventListener('click', () => closeModal(departmentsModal));
departmentsModal?.addEventListener('click', e => { if (e.target === departmentsModal) closeModal(departmentsModal); });

invitesNav?.addEventListener('click', () => openModal(invitesModal));
invitesClose?.addEventListener('click', () => closeModal(invitesModal));
invitesModal?.addEventListener('click', e => { if (e.target === invitesModal) closeModal(invitesModal); });

auditNav?.addEventListener('click', () => openModal(auditModal));
auditClose?.addEventListener('click', () => closeModal(auditModal));
auditModal?.addEventListener('click', e => { if (e.target === auditModal) closeModal(auditModal); });

bulkNav?.addEventListener('click', () => openBulkModal());

inactiveNav?.addEventListener('click', () => { loadInactiveUsers(); openModal(inactiveModal); });
inactiveClose?.addEventListener('click', () => closeModal(inactiveModal));
inactiveModal?.addEventListener('click', e => { if (e.target === inactiveModal) closeModal(inactiveModal); });

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    Promise.all([fetchRoles(), fetchProjects()]).then(loadUsers);
  }
});
