import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Konfigurasi Firebase dari screenshot kamu
const firebaseConfig = {
  apiKey: "AIzaSyBRZ36ZFgxNBKGXzxLOLY7Y5XTMK-zVYRs",
  authDomain: "laundrysaas-98069.firebaseapp.com",
  projectId: "laundrysaas-98069",
  storageBucket: "laundrysaas-98069.firebasestorage.app",
  messagingSenderId: "548371052375",
  appId: "1:548371052375:web:c022e9d663bbc8ee78f012",
  measurementId: "G-KFGN99GR1B"
};

// Inisialisasi Firebase & Export Firestore
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);