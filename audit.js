import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, query, where, orderBy } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const tbody = document.getElementById('auditBody');
const userInput = document.getElementById('userFilter');
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');
const loadBtn = document.getElementById('loadLogs');

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

async function loadLogs() {
  if (!db) return;
  let q = collection(db, 'auditLogs');
  const filters = [];
  if (userInput.value.trim()) filters.push(where('adminUid', '==', userInput.value.trim()));
  if (startInput.value) filters.push(where('timestamp', '>=', new Date(startInput.value)));
  if (endInput.value) filters.push(where('timestamp', '<=', endOfDay(endInput.value)));
  if (filters.length) {
    q = query(q, ...filters, orderBy('timestamp', 'desc'));
  } else {
    q = query(q, orderBy('timestamp', 'desc'));
  }
  const snap = await getDocs(q);
  tbody.innerHTML = '';
  snap.forEach(d => {
    const data = d.data();
    const ts = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString() : '';
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${ts}</td><td>${data.adminUid}</td><td>${data.action}</td><td>${data.targetUid || ''}</td><td>${data.extra ? JSON.stringify(data.extra) : ''}</td>`;
    tbody.appendChild(tr);
  });
}

loadBtn?.addEventListener('click', loadLogs);

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
  } else {
    loadLogs();
  }
});
