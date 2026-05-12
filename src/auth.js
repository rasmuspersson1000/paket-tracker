const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const MS_SCOPE = 'https://graph.microsoft.com/Mail.Read offline_access';

function generateCodeVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export class AuthManager {
  constructor(config) {
    this.config = config;
    this.redirectUri = window.location.origin + '/';
  }

  async startOAuth(provider) {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateCodeVerifier();
    sessionStorage.setItem('pkce_verifier', verifier);
    sessionStorage.setItem('pkce_provider', provider);
    sessionStorage.setItem('pkce_state', state);

    const params = new URLSearchParams({
      response_type: 'code',
      redirect_uri: this.redirectUri,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      ...(provider === 'google' ? {
        client_id: this.config.google.clientId,
        scope: GOOGLE_SCOPE,
        access_type: 'offline',
        prompt: 'consent',
      } : {
        client_id: this.config.microsoft.clientId,
        scope: MS_SCOPE,
      }),
    });

    const base = provider === 'google' ? GOOGLE_AUTH_URL : MS_AUTH_URL;
    window.location.href = `${base}?${params}`;
  }

  async handleCallback(code, state) {
    const verifier = sessionStorage.getItem('pkce_verifier');
    const provider = sessionStorage.getItem('pkce_provider');
    if (!verifier || !provider) return null;
    const expectedState = sessionStorage.getItem('pkce_state');
    sessionStorage.removeItem('pkce_state');
    if (state !== expectedState) return null;
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('pkce_provider');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri,
      code_verifier: verifier,
      ...(provider === 'google' ? {
        client_id: this.config.google.clientId,
      } : {
        client_id: this.config.microsoft.clientId,
      }),
    });

    const tokenUrl = provider === 'google' ? GOOGLE_TOKEN_URL : MS_TOKEN_URL;
    const res = await fetch(tokenUrl, { method: 'POST', body });
    if (!res.ok) return null;
    const json = await res.json();

    return {
      provider,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? null,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
  }

  async refreshAccessToken(account) {
    if (!account.refreshToken) return null;
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      ...(account.provider === 'google' ? {
        client_id: this.config.google.clientId,
      } : {
        client_id: this.config.microsoft.clientId,
      }),
    });
    const tokenUrl = account.provider === 'google' ? GOOGLE_TOKEN_URL : MS_TOKEN_URL;
    const res = await fetch(tokenUrl, { method: 'POST', body });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      ...account,
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? account.refreshToken,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
  }

  isExpired(account) {
    return Date.now() > account.expiresAt - 60_000;
  }
}
