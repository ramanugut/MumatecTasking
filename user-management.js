import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const tbody = document.getElementById('userTableBody');
const searchInput = document.getElementById('userSearch');

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
    const snap = await getDocs(collection(db, 'users'));
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      const tr = document.createElement('tr');
      const name = data.displayName || data.name || '';
      const role = data.role || '';
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

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    loadUsers();
  }
});
