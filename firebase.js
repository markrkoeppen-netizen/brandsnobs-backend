const admin = require('firebase-admin');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    console.log('Firebase already initialized');
    return admin;
  }

  try {
    // Try to get complete service account JSON first
    let serviceAccount;
    
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      // Parse the complete JSON service account
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      console.log('✅ Using FIREBASE_SERVICE_ACCOUNT');
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // Fallback to individual credentials
      serviceAccount = {
        type: "service_account",
        project_id: process.env.FIREBASE_PROJECT_ID,
        private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        client_email: process.env.FIREBASE_CLIENT_EMAIL,
      };
      console.log('✅ Using individual Firebase credentials');
    } else {
      throw new Error('Firebase credentials not found. Set either FIREBASE_SERVICE_ACCOUNT or individual credentials.');
    }

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized successfully');
    
    return admin;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error.message);
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
