import { auth, db } from './firebase.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, addDoc } from 'https://www.gstatic.com/firebasejs/11.9.0/firebase-firestore.js';

function resolveHostingFocus(roles = []) {
  const normalized = new Set(roles.map(r => (r || '').toLowerCase()));
  const hasAny = (...names) => names.some(name => normalized.has(name));

  if (hasAny('superadmin', 'admin')) return 'environments';
  if (hasAny('automation', 'devops', 'sre')) return 'automation';
  if (hasAny('finance', 'billing', 'accounting')) return 'billing';
  if (hasAny('client', 'clientsuccess', 'accountmanager', 'projectmanager', 'designer')) return 'clients';
  if (hasAny('developer', 'teamlead')) return 'environments';
  if (hasAny('guest')) return 'clients';
  return 'environments';
}

function redirectToHostingCenter(roles = []) {
  const focus = resolveHostingFocus(Array.isArray(roles) ? roles : []);
  const target = focus ? `index.html?focus=${focus}` : 'index.html';
  window.location.href = target;
}

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
    const required = window.REQUIRED_ROLES;
    if (required && required.length && !required.some(r => roles.includes(r))) {
      redirectToHostingCenter(roles);
      return;
    }
    const permsRequired = window.REQUIRED_PERMISSIONS;
    if (permsRequired && permsRequired.length && !permsRequired.every(p => window.currentUserPermissions.includes(p))) {
      redirectToHostingCenter(roles);
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
