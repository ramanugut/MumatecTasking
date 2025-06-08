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

async function checkRateLimit(uid, action, limit = 10, windowMs = 60000) {
  const ref = admin.firestore().doc(`rateLimits/${uid}_${action}`);
  const doc = await ref.get();
  const now = Date.now();
  if (doc.exists && now - doc.data().startAt.toMillis() < windowMs) {
    if (doc.data().count >= limit) {
      throw new functions.https.HttpsError('resource-exhausted', 'Rate limit exceeded');
    }
    await ref.update({ count: admin.firestore.FieldValue.increment(1) });
  } else {
    await ref.set({ startAt: admin.firestore.Timestamp.fromMillis(now), count: 1 });
  }
}

exports.createUserWithRole = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  await checkRateLimit(context.auth.uid, 'createUser');
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
  await checkRateLimit(context.auth.uid, 'invite', 20);
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

// Invite a single user and optionally set an expiration for guest access.
exports.inviteUser = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  await checkRateLimit(context.auth.uid, 'invite');
  const { email, displayName, role, expiresAt } = data;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing email');
  }
  const record = await admin.auth().createUser({ email, displayName: displayName || '' });
  const userData = {
    email,
    displayName: displayName || '',
    role: ALLOWED_ROLES.includes(role) ? role : 'guest',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    onboarded: false,
  };
  if (expiresAt) {
    userData.guestExpiresAt = admin.firestore.Timestamp.fromMillis(expiresAt);
  }
  await admin.firestore().doc(`users/${record.uid}`).set(userData);
  await admin.auth().setCustomUserClaims(record.uid, { role: userData.role });
  const link = await admin.auth().generatePasswordResetLink(email);
  await logAudit(context.auth.uid, 'invite', record.uid, { email });
  return { link };
});

exports.logUserLogin = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated');
  const uid = context.auth.uid;
  await admin.firestore().doc(`users/${uid}`).set({ lastLogin: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { ok: true };
});

exports.logUserSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated');
  const { sessionId, action, userAgent } = data || {};
  if (!sessionId || !action) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing session data');
  }
  const uid = context.auth.uid;
  const ref = admin.firestore().doc(`users/${uid}/sessions/${sessionId}`);
  if (action === 'start') {
    await ref.set({ userAgent: userAgent || '', startAt: admin.firestore.FieldValue.serverTimestamp(), active: true });
  } else if (action === 'end') {
    await ref.set({ endAt: admin.firestore.FieldValue.serverTimestamp(), active: false }, { merge: true });
  }
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

// Advanced admin settings
exports.updateSettings = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { section, settings } = data;
  if (!section) throw new functions.https.HttpsError('invalid-argument', 'Missing section');
  await admin.firestore().doc(`settings/${section}`).set(settings || {}, { merge: true });
  await logAudit(context.auth.uid, 'updateSettings', null, { section });
  return { ok: true };
});

exports.getSettings = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { section } = data;
  if (!section) throw new functions.https.HttpsError('invalid-argument', 'Missing section');
  const snap = await admin.firestore().doc(`settings/${section}`).get();
  return { settings: snap.exists ? snap.data() : null };
});

const crypto = require('crypto');

exports.createApiKey = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const key = crypto.randomBytes(16).toString('hex');
  const ref = await admin.firestore().collection('apiKeys').add({
    key,
    createdBy: context.auth.uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await logAudit(context.auth.uid, 'createApiKey', ref.id);
  return { id: ref.id, key };
});

exports.revokeApiKey = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { id } = data;
  if (!id) throw new functions.https.HttpsError('invalid-argument', 'Missing id');
  await admin.firestore().collection('apiKeys').doc(id).delete();
  await logAudit(context.auth.uid, 'revokeApiKey', id);
  return { ok: true };
});

exports.listApiKeys = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const snap = await admin.firestore().collection('apiKeys').get();
  const keys = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { keys };
});

exports.exportUserData = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { email } = data || {};
  let query;
  if (email) {
    query = await admin.firestore().collection('users').where('email', '==', email).limit(1).get();
    if (query.empty) throw new functions.https.HttpsError('not-found', 'User not found');
  }
  const usersSnap = email ? query : await admin.firestore().collection('users').get();
  const result = [];
  for (const docSnap of usersSnap.docs) {
    const userId = docSnap.id;
    const data = docSnap.data();
    const tasksSnap = await admin.firestore().collection(`users/${userId}/tasks`).get();
    const tasks = tasksSnap.docs.map(t => ({ id: t.id, ...t.data() }));
    result.push({ id: userId, ...data, tasks });
  }
  return result;
});

exports.exportAuditLogs = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const snap = await admin.firestore().collection('auditLogs').orderBy('timestamp', 'desc').limit(1000).get();
  const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { logs };
});
