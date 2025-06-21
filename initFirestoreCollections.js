const {initializeApp, cert, applicationDefault} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const fs = require('fs');

const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json';
let app;
if (fs.existsSync(credentialsPath)) {
  const serviceAccount = require(credentialsPath);
  app = initializeApp({ credential: cert(serviceAccount) });
} else {
  console.warn('Service account key not found, using application default credentials');
  app = initializeApp({ credential: applicationDefault() });
}

const db = getFirestore(app);

// Base collections used throughout the app. Additional collections for the
// advanced task features are appended below.
const collections = [
  'users',
  'settings',
  'auditLogs',
  'teams',
  'clients',
  'projects',
  'invoices',
  'apiKeys',
  'rateLimits',
  'userRequests',
  // Task management
  'tasks',
  'taskComments',
  'taskActivity',
  'taskAttachments',
  'timeLogs',
  'taskRelations',
  'notifications'
];

async function ensureCollection(col) {
  const docRef = db.collection(col).doc('_init');
  try {
    const snap = await docRef.get();
    if (!snap.exists) {
      await docRef.set({ createdAt: new Date().toISOString() });
      console.log(`Created ${col}/_init`);
    } else {
      console.log(`${col} already exists`);
    }
  } catch (err) {
    console.error(`Failed to create collection ${col}:`, err.message);
  }
}

(async () => {
  for (const col of collections) {
    await ensureCollection(col);
  }
  console.log('Firestore collections initialization complete');
  process.exit(0);
})();
