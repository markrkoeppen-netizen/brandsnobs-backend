const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    console.log('Firebase already initialized');
    return admin;
  }

  try {
    // Try to use service account JSON file first
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
      });
      
      console.log('✅ Firebase Admin initialized with service account JSON');
    } 
    // Fallback to individual environment variables
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      const serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      };

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
      });
      
      console.log('✅ Firebase Admin initialized with environment variables');
    } else {
      throw new Error('Firebase credentials not found. Set either FIREBASE_SERVICE_ACCOUNT or individual credentials.');
    }

    firebaseInitialized = true;
    return admin;
    
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
}

function getFirestore() {
  if (!firebaseInitialized) {
    initializeFirebase();
  }
  return admin.firestore();
}

module.exports = {
  initializeFirebase,
  getFirestore
};
