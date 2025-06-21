import { auth, db } from './firebase.js';
import { createUserWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, setDoc, collection, addDoc, getDocs, query, where, updateDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const photoURL = document.getElementById('photoURL').value.trim();
  const jobTitle = document.getElementById('jobTitle').value.trim();
  const department = document.getElementById('department').value.trim();
  const team = document.getElementById('team').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const timezone = document.getElementById('timezone').value.trim();
  const skills = document.getElementById('skills').value.split(',').map(s => s.trim()).filter(Boolean);
  const status = document.getElementById('status').value;
  const inviteToken = document.getElementById('inviteToken').value.trim();
  const emailNotif = document.getElementById('emailNotif').checked;
  const pushNotif = document.getElementById('pushNotif').checked;
  const errorEl = document.getElementById('error');
  errorEl.textContent = '';
  try {
    let inviteData = null;
    if (inviteToken) {
      const snap = await getDocs(query(collection(db, 'invites'), where('token', '==', inviteToken), where('status', '==', 'sent')));
      if (snap.empty) {
        errorEl.textContent = 'Invalid or expired invitation token.';
        return;
      }
      inviteData = { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    const assignedRole = inviteData ? inviteData.roleId : 'client';
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      photoURL: photoURL || null,
      jobTitle,
      department,
      team,
      phone,
      timezone,
      skills,
      status,
      role: assignedRole,
      onboarded: false,
      notifications: { email: emailNotif, push: pushNotif }
    });
    await addDoc(collection(db, 'userRoles'), {
      userId: cred.user.uid,
      roleId: assignedRole,
      assignedAt: new Date()
    });
    if (department) {
      await setDoc(doc(db, 'departments', department), { createdAt: new Date() }, { merge: true });
      await setDoc(doc(db, 'departments', department, 'members', cred.user.uid), { assignedAt: new Date() });
    }
    if (team) {
      await setDoc(doc(db, 'teams', team), { createdAt: new Date() }, { merge: true });
      await setDoc(doc(db, 'teams', team, 'members', cred.user.uid), { assignedAt: new Date() });
    }
    if (inviteData) {
      if (inviteData.projectId) {
        await updateDoc(doc(db, 'users', cred.user.uid), { projects: [inviteData.projectId] });
      }
      await updateDoc(doc(db, 'invites', inviteData.id), {
        status: 'accepted',
        acceptedAt: new Date(),
        acceptedBy: cred.user.uid
      });
    }
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
