import { functions, db } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const form = document.getElementById('inviteForm');
const result = document.getElementById('inviteResult');
const projectSelect = document.getElementById('inviteProject');

async function loadProjects() {
  if (!projectSelect) return;
  const snap = await getDocs(collection(db, 'projects'));
  projectSelect.innerHTML = '<option value="">--none--</option>';
  snap.forEach(docSnap => {
    const d = docSnap.data();
    projectSelect.insertAdjacentHTML('beforeend', `<option value="${docSnap.id}">${d.name}</option>`);
  });
}

loadProjects();
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('inviteEmail').value.trim();
  const displayName = document.getElementById('inviteName').value.trim();
  const role = document.getElementById('inviteRole').value;
  const days = parseInt(document.getElementById('inviteDays').value, 10);
  const projectId = projectSelect.value || null;
  const inviteFn = httpsCallable(functions, 'inviteUser');
  try {
    const expiresAt = days ? Date.now() + days * 86400000 : undefined;
    const res = await inviteFn({ email, displayName, role, projectId, expiresAt });
    result.textContent = `Invite link: ${res.data.link}`;
  } catch (err) {
    result.textContent = err.message;
  }
});
