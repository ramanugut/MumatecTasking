import { auth, db } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, onSnapshot } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const list = document.getElementById('clientTasks');

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  const tasksCol = collection(db, 'users', user.uid, 'tasks');
  onSnapshot(tasksCol, snap => {
    list.innerHTML = '';
    snap.forEach(doc => {
      const t = doc.data();
      list.insertAdjacentHTML('beforeend', `<div class="task-item">${t.title} - ${t.status}</div>`);
    });
  });
});
