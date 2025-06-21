import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const tbody = document.getElementById('userTableBody');

async function loadUsers() {
  if (!db) return;
  try {
    const snap = await getDocs(collection(db, 'users'));
    tbody.innerHTML = '';
    snap.forEach(doc => {
      const data = doc.data();
      const tr = document.createElement('tr');
      const name = data.displayName || data.name || '';
      tr.innerHTML = `<td>${name}</td><td>${data.email || ''}</td>`;
      tbody.appendChild(tr);
    });
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
