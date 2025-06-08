import { auth, db, functions } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, addDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';

let startTime = null;
const status = document.getElementById('timerStatus');
const projectSelect = document.getElementById('billingProject');

onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'login.html'; return; }
  const snap = await getDocs(collection(db, 'projects'));
  snap.forEach(doc => {
    projectSelect.insertAdjacentHTML('beforeend', `<option value="${doc.id}">${doc.data().name}</option>`);
  });
});

document.getElementById('startTimer').addEventListener('click', () => {
  startTime = Date.now();
  status.textContent = 'Timer running...';
});

document.getElementById('stopTimer').addEventListener('click', async () => {
  if (!startTime) return;
  const minutes = Math.round((Date.now() - startTime) / 60000);
  startTime = null;
  status.textContent = `Recorded ${minutes} minutes`;
  const fn = httpsCallable(functions, 'logTimeEntry');
  await fn({ projectId: projectSelect.value, minutes, description: 'Tracked time' });
});
