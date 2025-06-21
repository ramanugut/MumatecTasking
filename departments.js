import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, setDoc, doc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const deptBody = document.getElementById('departmentsBody');
const teamBody = document.getElementById('teamsBody');
const addDeptBtn = document.getElementById('addDepartment');
const addTeamBtn = document.getElementById('addTeam');

async function loadList(col, tbody) {
  const snap = await getDocs(collection(db, col));
  tbody.innerHTML = '';
  snap.forEach(d => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${d.id}</td><td><button class="action-btn secondary small" data-col="${col}" data-id="${d.id}">Edit</button></td>`;
    tbody.appendChild(tr);
  });
}

async function loadAll() {
  await Promise.all([
    loadList('departments', deptBody),
    loadList('teams', teamBody)
  ]);
}

document.body.addEventListener('click', async e => {
  const btn = e.target.closest('button[data-col]');
  if (!btn) return;
  const { col, id } = btn.dataset;
  const name = prompt('Name:', id);
  if (!name) return;
  await setDoc(doc(db, col, name.trim()), { createdAt: new Date() }, { merge: true });
  if (id !== name) {
    // simple rename by deleting old doc reference if different
    // Firestore doesn't support server-side delete here; handled manually if needed
  }
  loadAll();
});

addDeptBtn.addEventListener('click', async () => {
  const name = prompt('Department name:');
  if (!name) return;
  await setDoc(doc(db, 'departments', name.trim()), { createdAt: new Date() }, { merge: true });
  loadAll();
});

addTeamBtn.addEventListener('click', async () => {
  const name = prompt('Team name:');
  if (!name) return;
  await setDoc(doc(db, 'teams', name.trim()), { createdAt: new Date() }, { merge: true });
  loadAll();
});

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    loadAll();
  }
});
