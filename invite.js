import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';

const form = document.getElementById('inviteForm');
const result = document.getElementById('inviteResult');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('inviteEmail').value.trim();
  const displayName = document.getElementById('inviteName').value.trim();
  const role = document.getElementById('inviteRole').value;
  const days = parseInt(document.getElementById('inviteDays').value, 10);
  const inviteFn = httpsCallable(functions, 'inviteUser');
  try {
    const expiresAt = days ? Date.now() + days * 86400000 : undefined;
    const res = await inviteFn({ email, displayName, role, expiresAt });
    result.textContent = `Invite link: ${res.data.link}`;
  } catch (err) {
    result.textContent = err.message;
  }
});
