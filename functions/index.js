const functions = require('firebase-functions');
const admin     = require('firebase-admin');
admin.initializeApp();

// Helper to confirm caller is Admin
async function checkAdmin(callerUid) {
  if (!callerUid) {
    throw new functions.https.HttpsError('unauthenticated','Sign-in required.');
  }
  const docSnap = await admin.firestore().doc(`users/${callerUid}`).get();
  if (!docSnap.exists || docSnap.data().role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied','Admin only.');
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
