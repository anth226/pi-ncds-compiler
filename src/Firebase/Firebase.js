import * as admin from "firebase-admin";
var serviceAccount = require('./tower-staging.json');

const config = {
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL
};

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: config.databaseURL
});

// Messaging
const messaging = admin.messaging();

export { messaging };
