const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const SUPER_ADMIN_EMAIL = 'mumatechosting@gmail.com';

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
    if (!snap.exists || snap.data().role !== 'admin') {
      await docRef.set({
        email: userRecord.email,
        displayName: userRecord.displayName || '',
        role: 'admin',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    const claims = userRecord.customClaims || {};
    if (claims.role !== 'admin') {
      await admin.auth().setCustomUserClaims(callerUid, { role: 'admin' });
    }
    return;
  }

  const docSnap = await admin.firestore().doc(`users/${callerUid}`).get();
  if (!docSnap.exists || docSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admin only.');
  }
}

exports.createUserWithRole = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { email, password, displayName } = data;
  if (!email || !password || !displayName) {
    throw new functions.https.HttpsError('invalid-argument','Missing fields');
  }
  const userRecord = await admin.auth().createUser({ email, password, displayName });
  const newUid = userRecord.uid;
  await admin.firestore().doc(`users/${newUid}`).set({
    email,
    displayName,
    role: 'member',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  await admin.auth().setCustomUserClaims(newUid, { role: 'member' });
  return { uid: newUid };
});

exports.updateUserRole = functions.https.onCall(async (data, context) => {
  await checkAdmin(context.auth.uid);
  const { targetUid, newRole } = data;
  if (!targetUid || !['admin','member'].includes(newRole)) {
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
  return { link };
});
