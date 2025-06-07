import { auth, db, firebaseConfig } from './firebase.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-app.js';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

// Secondary Firebase app used for creating users without affecting current session
const secondaryApp = initializeApp(firebaseConfig, 'secondary');
const secondaryAuth = getAuth(secondaryApp);

const adminControls = document.getElementById('adminControls');
const unauthEl = document.getElementById('unauth');
const userTableBody = document.querySelector('#userTable tbody');

function handleError(err) {
  console.error(err);
  if (err.code === 'permission-denied') alert('You are not authorized.');
  else if (err.code === 'unauthenticated') window.location.href = 'login.html';
  else alert(err.message);
}

async function loadUsers() {
  const snap = await getDocs(collection(db, 'users'));
  userTableBody.innerHTML = '';
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${data.email}</td>
      <td>${data.displayName || ''}</td>
      <td>
        <select data-uid="${docSnap.id}">
          <option value="member" ${data.role === 'member' ? 'selected' : ''}>member</option>
          <option value="admin" ${data.role === 'admin' ? 'selected' : ''}>admin</option>
        </select>
      </td>
      <td>
        <button data-edit="${docSnap.id}" data-email="${data.email}" data-name="${data.displayName || ''}">Edit</button>
        <button data-reset="${docSnap.id}" data-email="${data.email}">Reset</button>
        <button data-del="${docSnap.id}">Delete</button>
      </td>
    `;
    userTableBody.appendChild(tr);
  });
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    window.location.href = 'login.html';
    return;
  }
  const prof = await getDoc(doc(db, 'users', user.uid));
  if (!prof.exists() || prof.data().role !== 'admin') {
    unauthEl.style.display = 'block';
    return;
  }
  adminControls.style.display = 'block';
  loadUsers();
});

// Create user
if (document.getElementById('btnCreateUser')) {
  document.getElementById('btnCreateUser').addEventListener('click', async () => {
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const displayName = document.getElementById('newDisplayName').value.trim();
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      if (displayName) {
        await updateProfile(cred.user, { displayName });
      }
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        displayName,
        role: 'member'
      });
      await signOut(secondaryAuth);
      alert('User successfully created!');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
  });
}

userTableBody.addEventListener('change', async (e) => {
  if (e.target.tagName === 'SELECT') {
    const uid = e.target.getAttribute('data-uid');
    const newRole = e.target.value;
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      alert('Role successfully updated!');
    } catch (err) {
      handleError(err);
    }
  }
});

userTableBody.addEventListener('click', async (e) => {
  if (e.target.dataset.del) {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const uid = e.target.dataset.del;
    try {
      await deleteDoc(doc(db, 'users', uid));
      alert('User record deleted. Remove auth user manually.');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
    return;
  }

  if (e.target.dataset.reset) {
    const email = e.target.dataset.email;
    if (!confirm(`Send password reset email to ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert('Password reset email sent!');
    } catch (err) {
      handleError(err);
    }
    return;
  }

  if (e.target.dataset.edit) {
    const uid = e.target.dataset.edit;
    const currentEmail = e.target.dataset.email;
    const currentName = e.target.dataset.name || '';
    const newEmail = prompt('Email:', currentEmail);
    if (newEmail === null) return;
    const newName = prompt('Display name:', currentName);
    if (newName === null) return;
    try {
      await updateDoc(doc(db, 'users', uid), { email: newEmail, displayName: newName });
      alert('User profile updated');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
    return;
  }
});
