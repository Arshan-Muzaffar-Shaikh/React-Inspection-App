import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCgwc-cbOO_jchzQfPNErAPNUrhAFFaDVs",
  authDomain: "aepl-electrical-inspection.firebaseapp.com",
  projectId: "aepl-electrical-inspection",
  storageBucket: "aepl-electrical-inspection.appspot.com",
  messagingSenderId: "496602708182",
  appId: "1:496602708182:web:6e7456d7eaeb541cba3177",
  measurementId: "G-FXVPDCSDM3"
};

const firebaseApp =
  getApps().length > 0
    ? getApps()[0]
    : initializeApp(firebaseConfig);

const auth = getAuth(firebaseApp);

const db = getFirestore(firebaseApp);

const hasFirebase = () => !!(auth && db);

export {
  firebaseApp,
  auth,
  db,
  hasFirebase
};