import { initializeApp } from "firebase/app";
import { getStorage } from "firebase/storage";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAptJyMRrYRvOcSfvO4xYkW6ypxENp5qNU",
  authDomain: "wedding-album-b0cf7.firebaseapp.com",
  projectId: "wedding-album-b0cf7",
  storageBucket: "wedding-album-b0cf7.firebasestorage.app",
  messagingSenderId: "1010912297271",
  appId: "1:1010912297271:web:d5571b17a7a07b748adab2"
};

const app = initializeApp(firebaseConfig);

export const storage = getStorage(app);
export const db = getFirestore(app);
export const auth = getAuth(app);