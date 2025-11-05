import { auth, db } from './firebase.js';
import { logAuditAction } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, setDoc, doc, getDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const PERMISSION_GROUPS = {
  'User Management Rights': [
    'user.create','user.edit','user.delete','user.activate','user.suspend','user.impersonate','user.view_all','user.bulk_operations','user.invite','user.export'
  ],
  'Role & Permission Management Rights': [
    'role.create','role.edit','role.delete','role.assign','role.revoke','permission.grant','permission.revoke','permission.view'
  ],
  'System Administration Rights': [
    'system.settings','system.backup','system.restore','system.logs','system.maintenance','billing.manage','integration.manage'
  ],
  'Department Management Rights': [
    'department.create','department.edit','department.delete','department.manage_members','department.view_all'
  ],
  'Team Management Rights': [
    'team.create','team.edit','team.delete','team.manage_members','team.assign_lead'
  ],
  'Project Management Rights': [
    'project.create','project.edit','project.delete','project.archive','project.view_all','project.view_assigned'
  ],
  'Project Access Rights': [
    'project.manage_members','project.assign_roles','project.change_settings','project.view_reports'
  ],
  'Task Creation & Management Rights': [
    'task.create','task.edit','task.delete','task.assign','task.reassign','task.clone'
  ],
  'Task Status Rights': [
    'task.close','task.reopen','task.change_status','task.change_priority','task.set_deadline'
  ],
  'Task Viewing Rights': [
    'task.view_all','task.view_assigned','task.view_created','task.view_team'
  ],
  'Comment Rights': [
    'comment.create','comment.edit','comment.edit_all','comment.delete','comment.delete_all','comment.view'
  ],
  'File & Attachment Rights': [
    'attachment.upload','attachment.download','attachment.delete','attachment.view'
  ],
  'Report Generation Rights': [
    'report.view_basic','report.view_advanced','report.create_custom','report.schedule','report.export'
  ],
  'Data Access Rights': [
    'data.export','data.import','audit.view','analytics.view'
  ],
  'Security Management Rights': [
    'security.view_logs','security.manage_sessions','security.ip_restrictions','security.2fa_enforce'
  ],
  'Audit & Compliance Rights': [
    'audit.full_access','audit.user_actions','compliance.gdpr','compliance.export_data'
  ],
  'Notification Rights': [
    'notification.send','notification.broadcast','notification.manage_templates'
  ],
  'Integration Rights': [
    'integration.slack','integration.email','integration.calendar','integration.sso'
  ],
  'Time Management Rights': [
    'time.track','time.edit','time.view_all','time.approve','time.export'
  ],
  'Resource Management Rights': [
    'resource.allocate','resource.view','resource.manage'
  ],
  'API Access Rights': [
    'api.read','api.write','api.admin','webhook.create','webhook.manage'
  ],
  'Automation Rights': [
    'automation.create','automation.edit','automation.execute'
  ]
};

const editRoleModal = document.getElementById('editRoleModal');
const editRoleClose = document.getElementById('editRoleClose');
const roleForm = document.getElementById('roleForm');
const roleNameInput = document.getElementById('roleName');
const roleDescInput = document.getElementById('roleDesc');
const rolePermsInput = document.getElementById('rolePerms');
const roleParentSelect = document.getElementById('roleParent');
const editRoleTitle = document.getElementById('editRoleTitle');
const roleCancelBtn = document.getElementById('roleCancel');
const editPermsBtn = document.getElementById('editPermsBtn');

const permissionsModal = document.getElementById('permissionsModal');
const permClose = document.getElementById('permClose');
const permCancel = document.getElementById('permCancel');
const permSave = document.getElementById('permSave');
const permSelectAll = document.getElementById('permSelectAll');
const permissionsContainer = document.getElementById('permissionsContainer');
let editingRoleId = null;

const tbody = document.getElementById('rolesBody');
const addBtn = document.getElementById('addRole');

function lockBodyScroll() {
  document.body?.classList.add('modal-open');
}

function unlockBodyScroll() {
  if (!document.querySelector('.modal-overlay.active')) {
    document.body?.classList.remove('modal-open');
  }
}

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
  lockBodyScroll();
}

function closeModal(modal) {
  modal.classList.remove('active');
  modal.setAttribute('aria-hidden', 'true');
  unlockBodyScroll();
}

function populatePermissions(selected = []) {
  permissionsContainer.innerHTML = '';
  Object.entries(PERMISSION_GROUPS).forEach(([group, perms]) => {
    const div = document.createElement('div');
    div.className = 'perm-group';
    const header = document.createElement('div');
    header.className = 'perm-group-header';
    const groupCb = document.createElement('input');
    groupCb.type = 'checkbox';
    groupCb.dataset.group = group;
    groupCb.checked = perms.every(p => selected.includes(p));
    header.appendChild(groupCb);
    header.appendChild(document.createTextNode(group));
    div.appendChild(header);
    perms.forEach(p => {
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = p;
      if (selected.includes(p)) cb.checked = true;
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + p));
      label.className = 'perm-item';
      cb.className = 'perm-' + group;
      div.appendChild(label);
    });
    permissionsContainer.appendChild(div);
  });
  updateSelectAll();
}

function getSelectedPerms() {
  return Array.from(permissionsContainer.querySelectorAll('input[type="checkbox"][value]:checked')).map(c => c.value);
}

function updateGroupState(group) {
  const boxes = permissionsContainer.querySelectorAll('input.perm-' + CSS.escape(group));
  const groupCb = permissionsContainer.querySelector('input[data-group="' + CSS.escape(group) + '"]');
  if (!groupCb) return;
  groupCb.checked = Array.from(boxes).every(b => b.checked);
}

function updateSelectAll() {
  const all = permissionsContainer.querySelectorAll('input[type="checkbox"][value]');
  permSelectAll.checked = Array.from(all).every(b => b.checked);
}

function openPermissionsModal() {
  const selected = rolePermsInput.value.split(',').map(p => p.trim()).filter(Boolean);
  populatePermissions(selected);
  openModal(permissionsModal);
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

editPermsBtn.addEventListener('click', openPermissionsModal);

permClose.addEventListener('click', () => closeModal(permissionsModal));
permCancel.addEventListener('click', () => closeModal(permissionsModal));
permissionsModal.addEventListener('click', e => { if (e.target === permissionsModal) closeModal(permissionsModal); });

permSave.addEventListener('click', () => {
  const selected = getSelectedPerms();
  rolePermsInput.value = selected.join(', ');
  closeModal(permissionsModal);
});

permissionsContainer.addEventListener('change', e => {
  if (e.target.dataset.group) {
    const group = e.target.dataset.group;
    permissionsContainer.querySelectorAll('input.perm-' + CSS.escape(group)).forEach(cb => {
      cb.checked = e.target.checked;
    });
  }
  if (e.target.value) {
    const group = Array.from(e.target.classList).find(c => c.startsWith('perm-'))?.slice(5);
    if (group) updateGroupState(group);
  }
  updateSelectAll();
});

permSelectAll.addEventListener('change', () => {
  const all = permissionsContainer.querySelectorAll('input[type="checkbox"]');
  all.forEach(cb => { cb.checked = permSelectAll.checked; });
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
  let action = 'createRole';
  if (editingRoleId) {
    if (editingRoleId !== name) {
      await setDoc(doc(db, 'roles', name), { description: desc, permissions, parentRole }, { merge: true });
      await deleteDoc(doc(db, 'roles', editingRoleId));
      action = 'renameRole';
    } else {
      await setDoc(doc(db, 'roles', name), { description: desc, permissions, parentRole }, { merge: true });
      action = 'updateRole';
    }
  } else {
    await setDoc(doc(db, 'roles', name), { description: desc, permissions, parentRole }, { merge: true });
  }
  logAuditAction(auth.currentUser?.uid, action, name, { description: desc, permissions, parentRole, previousId: editingRoleId && editingRoleId !== name ? editingRoleId : null });
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
