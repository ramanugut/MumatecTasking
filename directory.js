import { auth, db, rtdb } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { ref, onValue } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-database.js';

const tableBody = document.querySelector('#dirTable tbody');
const searchInput = document.getElementById('search');
let users = [];
let presence = {};

function render() {
  const q = (searchInput.value || '').toLowerCase();
  tableBody.innerHTML = '';
  users.forEach(u => {
    const skills = (u.skills || []).join(', ');
    if (q && !u.email.toLowerCase().includes(q) && !(u.displayName || '').toLowerCase().includes(q) && !skills.toLowerCase().includes(q)) return;
    const tr = document.createElement('tr');
    const status = presence[u.id]?.state === 'online' ? 'Online' : 'Offline';
    tr.innerHTML = `<td>${u.displayName || ''}</td><td>${u.email}</td><td>${u.jobTitle || ''}</td><td>${skills}</td><td>${status}</td>`;
    tableBody.appendChild(tr);
  });
}

searchInput.addEventListener('input', render);

onAuthStateChanged(auth, user => {
  if (!user) { window.location.href = 'login.html'; return; }
  onSnapshot(collection(db, 'users'), snap => {
    users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  });
  onValue(ref(rtdb, 'presence'), snap => {
    presence = snap.val() || {};
    render();
  });
});
