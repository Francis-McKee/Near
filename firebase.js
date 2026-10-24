// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {getAuth} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB6ecvd4trXM1IAu_kddfNeVw6fzzUqtnU",
  authDomain: "social-media-628f7.firebaseapp.com",
  projectId: "social-media-628f7",
  storageBucket: "social-media-628f7.firebasestorage.app",
  messagingSenderId: "823759878667",
  appId: "1:823759878667:web:5b78bc71f8223654a8a50e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
