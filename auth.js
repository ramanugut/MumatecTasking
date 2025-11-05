import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, addDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

onAuthStateChanged(auth, async (user) => {
  window.currentUser = user;
  if (user) {
    let name = user.displayName || '';
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) {
        const data = snap.data();
        if (!name) name = data.displayName || data.name || '';
      }
    } catch (e) {
      console.error('Failed to fetch user info', e);
    }
    let roles = [];
    let permissions = [];
    try {
      const roleSnap = await getDocs(query(collection(db, 'userRoles'), where('userId', '==', user.uid)));
      roles = roleSnap.docs.map(d => d.data().roleId);
      const toLoad = new Set(roles);
      const fetched = {};
      while (toLoad.size) {
        const roleId = toLoad.values().next().value;
        toLoad.delete(roleId);
        if (fetched[roleId]) continue;
        const snapRole = await getDoc(doc(db, 'roles', roleId));
        if (snapRole.exists()) {
          const rData = snapRole.data();
          fetched[roleId] = rData;
          if (Array.isArray(rData.permissions)) permissions.push(...rData.permissions);
          if (rData.parentRole) toLoad.add(rData.parentRole);
        }
      }
    } catch (e) {
      console.error('Failed to fetch user roles', e);
    }
    window.currentUserRoles = roles;
    window.currentUserPermissions = Array.from(new Set(permissions));
    const hostingRoles = ['projectManager', 'hostingManager'];
    const pathSegment = window.location.pathname.split('/').pop() || 'index.html';
    const shouldDefaultToHosting = hostingRoles.some(role => roles.includes(role));
    if (shouldDefaultToHosting && (pathSegment === '' || pathSegment === 'index.html')) {
      const redirected = sessionStorage.getItem('hostingControlRedirected');
      if (!redirected) {
        sessionStorage.setItem('hostingControlRedirected', '1');
        window.location.href = 'project-dashboard.html';
        return;
      }
    }
    const required = window.REQUIRED_ROLES;
    if (required && required.length && !required.some(r => roles.includes(r))) {
      window.location.href = 'index.html';
      return;
    }
    const permsRequired = window.REQUIRED_PERMISSIONS;
    if (permsRequired && permsRequired.length && !permsRequired.every(p => window.currentUserPermissions.includes(p))) {
      window.location.href = 'index.html';
      return;
    }
    const nameEl = document.getElementById('userName');
    if (nameEl && name) nameEl.textContent = name;
    const roleEl = document.getElementById('userRole');
    if (roleEl && roles.length) roleEl.textContent = roles.join(', ');
    if (typeof window.initTodoApp === 'function') {
      window.initTodoApp();
    }
  } else {
    window.location.href = 'login.html';
  }
});

window.logout = () => signOut(auth);

export async function logAuditAction(adminUid, action, targetUid = null, extra = null) {
  if (!adminUid) return;
  try {
    await addDoc(collection(db, 'auditLogs'), {
      adminUid,
      action,
      targetUid: targetUid || null,
      extra: extra || null,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('Failed to log audit action', err);
  }
}
