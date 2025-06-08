const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const SUPER_ADMIN_EMAIL = 'mumatechosting@gmail.com';
const ALLOWED_ROLES = [
  'superAdmin',
  'admin',
  'projectManager',
  'teamLead',
  'developer',
  'designer',
  'client',
  'guest'
];

// Helper to confirm the caller is Admin. The email defined in
// SUPER_ADMIN_EMAIL is always considered an admin even if no Firestore
// document exists yet.
async function checkAdmin(callerUid) {
  if (!callerUid) {
    throw new functions.https.HttpsError('unauthenticated', 'Sign-in required.');
  }

  const userRecord = await admin.auth().getUser(callerUid);

  // If the authenticated user is the configured super admin email, ensure they
  // have the admin role in Firestore and custom claims then allow.
  if (userRecord.email === SUPER_ADMIN_EMAIL) {
    const docRef = admin.firestore().doc(`users/${callerUid}`);
    const snap = await docRef.get();
    if (!snap.exists || snap.data().role !== 'superAdmin') {
      await docRef.set({
        email: userRecord.email,
        displayName: userRecord.displayName || '',
        role: 'superAdmin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const claims = userRecord.customClaims || {};
    if (claims.role !== 'superAdmin') {
      await admin.auth().setCustomUserClaims(callerUid, { role: 'superAdmin' });
    }
    return;
  }

  const docSnap = await admin.firestore().doc(`users/${callerUid}`).get();
  if (!docSnap.exists || !['superAdmin','admin'].includes(docSnap.data().role)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}

exports.createUserWithRole = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { email, password, displayName, role } = data;
  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError('invalid-argument','Missing fields');
  }
  const userRecord = await admin.auth().createUser({ email, password, displayName });
  const newUid = userRecord.uid;
  await admin.firestore().doc(`users/${newUid}`).set({
    email,
    displayName,
    role: ALLOWED_ROLES.includes(role) ? role : 'guest',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await admin.auth().setCustomUserClaims(newUid, { role: ALLOWED_ROLES.includes(role) ? role : 'guest' });
  await logAudit(context.auth.uid, 'createUser', newUid);
  return { uid: newUid };
});

exports.updateUserRole = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetUid, newRole } = data;
  if (!targetUid || !ALLOWED_ROLES.includes(newRole)) {
    throw new functions.https.HttpsError('invalid-argument','Missing or invalid fields');
  }
  // Prevent demoting last Admin
  const adminsSnapshot = await admin.firestore().collection('users').where('role','==','admin').get();
  const targetSnap = await admin.firestore().doc(`users/${targetUid}`).get();
  const wasAdmin = targetSnap.exists && targetSnap.data().role === 'admin';
  if (wasAdmin && adminsSnapshot.size <= 1) {
    throw new functions.https.HttpsError('failed-precondition','Cannot remove last admin');
  }
  await admin.firestore().doc(`users/${targetUid}`).update({ role: newRole });
  await admin.auth().setCustomUserClaims(targetUid, { role: newRole });
  await logAudit(context.auth.uid, 'updateRole', targetUid, { role: newRole });
  return { message: 'Role updated' };
});

exports.deleteUserAccount = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetUid } = data;
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument','Missing targetUid');
  }
  await admin.auth().deleteUser(targetUid);
  await admin.firestore().doc(`users/${targetUid}`).delete();
  await logAudit(context.auth.uid, 'deleteUser', targetUid);
  return { message: 'User deleted' };
});

// Update a user's basic profile information (email and display name).
exports.updateUserProfile = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetUid, email, displayName } = data;
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing targetUid');
  }
  const updateAuth = {};
  if (email) updateAuth.email = email;
  if (displayName) updateAuth.displayName = displayName;
  if (Object.keys(updateAuth).length) {
    await admin.auth().updateUser(targetUid, updateAuth);
    await admin.firestore().doc(`users/${targetUid}`).set(updateAuth, { merge: true });
  }
  await logAudit(context.auth.uid, 'updateProfile', targetUid, updateAuth);
  return { message: 'User profile updated' };
});

// Generate a password reset link for a user.
exports.adminSendPasswordReset = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetEmail } = data;
  if (!targetEmail) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing targetEmail');
  }
  const link = await admin.auth().generatePasswordResetLink(targetEmail);
  await logAudit(context.auth.uid, 'resetPassword', null, { targetEmail });
  return { link };
});

async function logAudit(adminUid, action, targetUid, extra = {}) {
  await admin.firestore().collection('auditLogs').add({
    adminUid,
    action,
    targetUid: targetUid || null,
    extra,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

exports.setUserDisabled = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetUid, disabled } = data;
  if (!targetUid || typeof disabled !== 'boolean') {
    throw new functions.https.HttpsError('invalid-argument', 'Missing fields');
  }
  await admin.auth().updateUser(targetUid, { disabled });
  await admin.firestore().doc(`users/${targetUid}`).set({ disabled }, { merge: true });
  await logAudit(context.auth.uid, disabled ? 'deactivate' : 'activate', targetUid);
  return { message: 'updated' };
});

exports.impersonateUser = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetUid } = data;
  if (!targetUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing targetUid');
  }
  const token = await admin.auth().createCustomToken(targetUid, { impersonatedBy: context.auth.uid });
  await logAudit(context.auth.uid, 'impersonate', targetUid);
  return { token };
});

exports.bulkUpdateRoles = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const updates = Array.isArray(data.updates) ? data.updates : [];
  const batch = admin.firestore().batch();
  for (const u of updates) {
    if (!u.uid || !ALLOWED_ROLES.includes(u.role)) continue;
    batch.update(admin.firestore().doc(`users/${u.uid}`), { role: u.role });
    await admin.auth().setCustomUserClaims(u.uid, { role: u.role });
    await logAudit(context.auth.uid, 'bulkRole', u.uid, { role: u.role });
  }
  await batch.commit();
  return { message: 'roles updated' };
});

exports.bulkInviteUsers = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const users = Array.isArray(data.users) ? data.users : [];
  const results = [];
  for (const u of users) {
    if (!u.email) continue;
    const record = await admin.auth().createUser({ email: u.email, displayName: u.displayName || '' });
    await admin.firestore().doc(`users/${record.uid}`).set({
      email: u.email,
      displayName: u.displayName || '',
      role: ALLOWED_ROLES.includes(u.role) ? u.role : 'guest',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await admin.auth().setCustomUserClaims(record.uid, { role: ALLOWED_ROLES.includes(u.role) ? u.role : 'guest' });
    const link = await admin.auth().generatePasswordResetLink(u.email);
    results.push({ email: u.email, link });
    await logAudit(context.auth.uid, 'invite', record.uid, { email: u.email });
  }
  return { results };
});

exports.logUserLogin = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated');
  const uid = context.auth.uid;
  await admin.firestore().doc(`users/${uid}`).set({ lastLogin: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

// Organization Management Extensions

exports.createTeam = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { name } = data;
  if (!name) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing team name');
  }
  const ref = await admin.firestore().collection('teams').add({
    name,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await logAudit(context.auth.uid, 'createTeam', ref.id);
  return { id: ref.id };
});

exports.assignUserToTeam = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { uid, teamId } = data;
  if (!uid || !teamId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing uid or teamId');
  }
  const teamMemberRef = admin.firestore().doc(`teams/${teamId}/members/${uid}`);
  await teamMemberRef.set({ assignedAt: admin.firestore.FieldValue.serverTimestamp() });
  await admin.firestore().doc(`users/${uid}`).set({
    teams: admin.firestore.FieldValue.arrayUnion(teamId)
  }, { merge: true });
  await logAudit(context.auth.uid, 'assignUserToTeam', uid, { teamId });
  return { ok: true };
});

exports.createClient = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { name } = data;
  if (!name) throw new functions.https.HttpsError('invalid-argument', 'Missing client name');
  const ref = await admin.firestore().collection('clients').add({
    name,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await logAudit(context.auth.uid, 'createClient', ref.id);
  return { id: ref.id };
});

exports.assignUserToClient = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { uid, clientId } = data;
  if (!uid || !clientId) throw new functions.https.HttpsError('invalid-argument', 'Missing uid or clientId');
  await admin.firestore().doc(`users/${uid}`).set({
    clients: admin.firestore.FieldValue.arrayUnion(clientId)
  }, { merge: true });
  await logAudit(context.auth.uid, 'assignUserToClient', uid, { clientId });
  return { ok: true };
});

exports.createProject = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { name, teamId, clientId } = data;
  if (!name) throw new functions.https.HttpsError('invalid-argument', 'Missing project name');
  const ref = await admin.firestore().collection('projects').add({
    name,
    teamId: teamId || null,
    clientId: clientId || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await logAudit(context.auth.uid, 'createProject', ref.id, { teamId, clientId });
  return { id: ref.id };
});

exports.assignUserToProject = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { uid, projectId } = data;
  if (!uid || !projectId) throw new functions.https.HttpsError('invalid-argument', 'Missing uid or projectId');
  const projMemberRef = admin.firestore().doc(`projects/${projectId}/members/${uid}`);
  await projMemberRef.set({ assignedAt: admin.firestore.FieldValue.serverTimestamp() });
  await admin.firestore().doc(`users/${uid}`).set({
    projects: admin.firestore.FieldValue.arrayUnion(projectId)
  }, { merge: true });
  await logAudit(context.auth.uid, 'assignUserToProject', uid, { projectId });
  return { ok: true };
});

exports.setManager = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { subordinateUid, managerUid } = data;
  if (!subordinateUid || !managerUid) throw new functions.https.HttpsError('invalid-argument', 'Missing uids');
  await admin.firestore().doc(`users/${subordinateUid}`).set({ managerUid }, { merge: true });
  await logAudit(context.auth.uid, 'setManager', subordinateUid, { managerUid });
  return { ok: true };
});

exports.getTeamWorkload = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { teamId } = data;
  if (!teamId) throw new functions.https.HttpsError('invalid-argument', 'Missing teamId');
  const membersSnap = await admin.firestore().collection(`teams/${teamId}/members`).get();
  const workload = [];
  for (const docSnap of membersSnap.docs) {
    const uid = docSnap.id;
    const tasksSnap = await admin.firestore().collection(`users/${uid}/tasks`).get();
    workload.push({ uid, taskCount: tasksSnap.size });
  }
  return { workload };
});
