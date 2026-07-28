// @ts-nocheck
import { initializeApp } from 'firebase/app';
import { 
  initializeAuth, 
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithPhoneNumber,
  onAuthStateChanged,
  inMemoryPersistence
} from 'firebase/auth';
import { Platform } from 'react-native';

export const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Web SDK (always runs, safe fallback and main driver on Web and Expo Go)
const webApp = initializeApp(firebaseConfig);
const webAuth = getAuth(webApp);
const googleProvider = new GoogleAuthProvider();

// Dynamic imports for Native to avoid Web/Expo Go compilation crashes
let nativeAuth: any = null;
let GoogleSignin: any = null;
let useNativeAuth = false;

if (Platform.OS !== 'web') {
  try {
    // Check if the native Firebase auth and Google signin modules are available in the binary
    const nativeFirebaseApp = require('@react-native-firebase/app');
    nativeAuth = require('@react-native-firebase/auth').default;
    GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;

    // Check if the native module is actually linked in the current host app
    if (nativeAuth && nativeAuth().signInWithPhoneNumber) {
      GoogleSignin.configure({
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '',
        offlineAccess: true,
      });
      useNativeAuth = true;
    }
  } catch (error) {
    console.warn("Native Firebase modules not available in binary. Falling back to Firebase Web JS SDK (e.g. Expo Go sandbox).");
    useNativeAuth = false;
  }
}

/**
 * Returns whether native auth is active and available in the current runtime.
 */
export const isNativeAuthAvailable = useNativeAuth;

/**
 * Returns the active Auth instance depending on the platform.
 */
export const getFirebaseAuth = () => {
  return isNativeAuthAvailable ? nativeAuth() : webAuth;
};

/**
 * Platform-agnostic login using Phone Number authentication.
 * Returns a confirmation object with a `.confirm(code)` method.
 */
export async function loginWithPhone(phoneNumber: string, appVerifier?: any) {
  if (isNativeAuthAvailable) {
    return await nativeAuth().signInWithPhoneNumber(phoneNumber);
  } else {
    return await signInWithPhoneNumber(webAuth, phoneNumber, appVerifier);
  }
}

/**
 * Platform-agnostic Google Sign-In helper.
 */
export async function loginWithGoogle() {
  if (isNativeAuthAvailable) {
    if (!GoogleSignin || !nativeAuth) {
      throw new Error("Native Google Sign-In modules not loaded.");
    }
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const userInfo = await GoogleSignin.signIn();
    
    // Support both pre-v13 and v13+ return signatures
    let idToken = null;
    if (userInfo && userInfo.type === 'success' && userInfo.data) {
      idToken = userInfo.data.idToken;
    } else if (userInfo && userInfo.idToken) {
      idToken = userInfo.idToken;
    }
    
    // Fetch access token (and fallback ID token) using getTokens()
    let accessToken = null;
    try {
      const tokens = await GoogleSignin.getTokens();
      idToken = idToken || tokens.idToken;
      accessToken = tokens.accessToken;
    } catch (e) {
      console.warn("Could not retrieve tokens from GoogleSignin.getTokens():", e);
    }
    
    if (!idToken) {
      throw new Error("No Google ID Token found. Please rebuild the APK to bundle the updated google-services.json.");
    }
    
    // If accessToken is present, pass both. If not, pass only idToken to avoid Android JSI bridge null-to-empty-string bug.
    const credential = accessToken 
      ? nativeAuth.GoogleAuthProvider.credential(idToken, accessToken)
      : nativeAuth.GoogleAuthProvider.credential(idToken);
      
    return await nativeAuth().signInWithCredential(credential);
  } else {
    return await signInWithPopup(webAuth, googleProvider);
  }
}

/**
 * Platform-agnostic sign-out.
 */
export async function logoutUser() {
  if (isNativeAuthAvailable) {
    if (nativeAuth) {
      await nativeAuth().signOut();
    }
    if (GoogleSignin) {
      try {
        await GoogleSignin.signOut();
      } catch (e) {
        console.warn("Failed to sign out from native Google account:", e);
      }
    }
  } else {
    await webAuth.signOut();
  }
}

/**
 * Platform-agnostic auth state listener.
 */
export function subscribeToAuthChanges(callback: (user: any) => void) {
  if (isNativeAuthAvailable) {
    return nativeAuth().onAuthStateChanged(callback);
  } else {
    return onAuthStateChanged(webAuth, callback);
  }
}

export { 
  webApp as app, 
  googleProvider,
  signInWithPopup,
  signInWithPhoneNumber
};
