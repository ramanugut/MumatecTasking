import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, setDoc, collection, addDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const photoURL = document.getElementById('photoURL').value.trim();
  const jobTitle = document.getElementById('jobTitle').value.trim();
  const department = document.getElementById('department').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const timezone = document.getElementById('timezone').value.trim();
  const skills = document.getElementById('skills').value.split(',').map(s => s.trim()).filter(Boolean);
  const status = document.getElementById('status').value;
  const emailNotif = document.getElementById('emailNotif').checked;
  const pushNotif = document.getElementById('pushNotif').checked;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      photoURL: photoURL || null,
      jobTitle,
      department,
      phone,
      timezone,
      skills,
      status,
      role: 'client',
      onboarded: false,
      notifications: { email: emailNotif, push: pushNotif }
    });
    await addDoc(collection(db, 'userRoles'), {
      userId: cred.user.uid,
      roleId: 'client',
      assignedAt: new Date()
    });
    window.location.href = 'index.html';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    window.location.href = 'index.html';
  }
});
