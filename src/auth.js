import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { FIREBASE_CONFIG } from '../firebase-config.js';

const firebaseApp = initializeApp(FIREBASE_CONFIG);
const firebaseAuth = getAuth(firebaseApp);

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/gmail.readonly');

const msProvider = new OAuthProvider('microsoft.com');
msProvider.addScope('https://graph.microsoft.com/Mail.Read');
msProvider.setCustomParameters({ prompt: 'consent' });

export class AuthManager {
  async signInGoogle() {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    return {
      provider: 'google',
      accessToken: credential.accessToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
  }

  async signInMicrosoft() {
    const result = await signInWithPopup(firebaseAuth, msProvider);
    const credential = OAuthProvider.credentialFromResult(result);
    return {
      provider: 'microsoft',
      accessToken: credential.accessToken,
      expiresAt: Date.now() + 55 * 60 * 1000,
    };
  }

  isExpired(account) {
    return Date.now() > account.expiresAt - 60_000;
  }
}
