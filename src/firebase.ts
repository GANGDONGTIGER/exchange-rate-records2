// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyAJJkz_jiQtQqAK8EU36yBm6YOCW0dTxSw",
  authDomain: "exchange-log.firebaseapp.com",
  projectId: "exchange-log",
  storageBucket: "exchange-log.firebasestorage.app",
  messagingSenderId: "784814898386",
  appId: "1:784814898386:web:540fd17962f4f40017010b"
};

// 파이어베이스 앱 시작!
const app = initializeApp(firebaseConfig);

// 데이터베이스(Firestore) 문 열기!
export const db = getFirestore(app);