import { auth, db } from './firebase.js';
import { logAuditAction } from './auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const tbody = document.getElementById('invitesBody');
const addBtn = document.getElementById('addInvite');

function randomToken(len = 10) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let str = '';
  for (let i = 0; i < len; i++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return str;
}

async function loadInvites() {
  const snap = await getDocs(collection(db, 'invites'));
  tbody.innerHTML = '';
  const now = Date.now();
  for (const d of snap.docs) {
    const data = d.data();
    if (data.status === 'sent' && data.createdAt?.toDate && now - data.createdAt.toDate().getTime() > 30 * 24 * 60 * 60 * 1000) {
      await updateDoc(d.ref, { status: 'expired' });
      data.status = 'expired';
    }
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.email}</td>
      <td>${data.roleId || ''}</td>
      <td>${data.projectId || ''}</td>
      <td>${data.status}</td>
      <td><button class="action-btn secondary small" data-id="${d.id}">Delete</button></td>`;
    tbody.appendChild(tr);
  }
}

tbody.addEventListener('click', async e => {
  const id = e.target.closest('button[data-id]')?.dataset.id;
  if (!id) return;
  await deleteDoc(doc(db, 'invites', id));
  logAuditAction(auth.currentUser?.uid, 'inviteDeleted', null, { inviteId: id });
  loadInvites();
});

addBtn.addEventListener('click', async () => {
  const email = prompt('Invitee email:');
  if (!email) return;
  const roleId = prompt('Role for user:') || 'client';
  const projectId = prompt('Project ID (optional):');
  await addDoc(collection(db, 'invites'), {
    email: email.trim(),
    roleId: roleId.trim(),
    projectId: projectId ? projectId.trim() : null,
    token: randomToken(),
    status: 'sent',
    createdAt: new Date()
  });
  logAuditAction(auth.currentUser?.uid, 'inviteSent', null, { email: email.trim(), roleId: roleId.trim(), projectId: projectId ? projectId.trim() : null });
  loadInvites();
});

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    loadInvites();
  }
});
