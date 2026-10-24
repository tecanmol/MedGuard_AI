import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, indexedDBLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyDTfvE_Yy6tkE8AVK7vdBCGirgrJo8LDwU",
  authDomain: "medgaurd-2b15f.firebaseapp.com",
  projectId: "medgaurd-2b15f",
  storageBucket: "medgaurd-2b15f.firebasestorage.app",
  messagingSenderId: "861770354193",
  appId: "1:861770354193:web:c3db9c65abc3115159ebb0",
  measurementId: "G-T15DJZ7L9C"
};

// @ts-ignore
import { getReactNativePersistence } from 'firebase/auth';
import { createAsyncStorage } from '@react-native-async-storage/async-storage';

const appStorage = createAsyncStorage('app');
const persistence = getReactNativePersistence(appStorage);

export const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with proper persistence for Expo/React Native
export const auth = initializeAuth(app, {
  persistence
});

export const db = getFirestore(app);
