import { auth, db } from './firebase.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-functions.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

const functions = getFunctions();
const createUser = httpsCallable(functions, 'createUserWithRole');
const updateRole = httpsCallable(functions, 'updateUserRole');
const deleteUser = httpsCallable(functions, 'deleteUserAccount');

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
      <td><button data-del="${docSnap.id}">Delete</button></td>
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
      await createUser({ email, password, displayName });
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
      await updateRole({ targetUid: uid, newRole });
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
      await deleteUser({ targetUid: uid });
      alert('User account deleted!');
      loadUsers();
    } catch (err) {
      handleError(err);
    }
  }
});
