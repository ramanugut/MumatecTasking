import { auth, db } from './firebase.js';
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
let userRolesMap = {};
let availableRoles = [];
let availableProjects = [];
const selectedUsers = new Set();


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
  const current = (userRolesMap[userId] || []).map(r => {
    if (r.projectId) return `${r.roleId}:${r.projectId}`;
    if (r.department) return `${r.roleId}@${r.department}`;
    return r.roleId;
  }).join(', ');
  const input = prompt(`Assign roles (comma separated). Use role:projectId or role@department. Available roles: ${availableRoles.join(', ')}`, current);
  if (input === null) return;
  const roles = input.split(',').map(r => r.trim()).filter(Boolean);
  const dept = prompt('Department:', userDeptMap[userId] || '')
  if (dept === null) return;
  const team = prompt('Team:', userTeamMap[userId] || '')
  if (team === null) return;
  try {
    const snap = await getDocs(query(collection(db, 'userRoles'), where('userId', '==', userId)));
    const ops = [];
    snap.forEach(d => ops.push(deleteDoc(d.ref)));

    roles.forEach(r => ops.push(addDoc(collection(db, 'userRoles'), { userId, roleId: r, assignedAt: new Date() })));
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
    loadUsers();
  } catch (err) {
    console.error('Failed to update roles', err);
  }
});

function openBulkModal() {
  bulkModal.classList.add('active');
  bulkModal.setAttribute('aria-hidden', 'false');
}

function closeBulkModal() {
  bulkModal.classList.remove('active');
  bulkModal.setAttribute('aria-hidden', 'true');
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

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    Promise.all([fetchRoles(), fetchProjects()]).then(loadUsers);
  }
});
