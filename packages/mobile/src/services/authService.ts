import axios from 'axios';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

class AuthService {
  async login(email: string, password: string) {
    const response = await axios.post(`${API_URL}/api/auth/login`, {
      email,
      password,
    });
    return response.data;
  }

  async loginWithGoogle() {
    // Configure Google OAuth
    const redirectUri = AuthSession.makeRedirectUri({
      scheme: 'ventum',
    });

    const request = new AuthSession.AuthRequest({
      clientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID!,
      scopes: ['openid', 'profile', 'email'],
      redirectUri,
      responseType: AuthSession.ResponseType.Token,
      extraParams: {
        access_type: 'offline',
      },
    });

    const result = await request.promptAsync({
      authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
    });

    if (result.type === 'success') {
      // Exchange Google token for our API token
      const response = await axios.post(`${API_URL}/api/auth/google`, {
        token: result.params.access_token,
      });
      return response.data;
    }

    throw new Error('Google authentication cancelled');
  }

  async getCurrentUser(token: string) {
    const response = await axios.get(`${API_URL}/api/access/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  }

  async logout() {
    // Call logout endpoint if needed
    try {
      await axios.post(`${API_URL}/api/auth/logout`);
    } catch (error) {
      // Ignore logout errors
    }
  }

  async refreshToken(token: string) {
    const response = await axios.post(`${API_URL}/api/auth/refresh`, {
      token,
    });
    return response.data;
  }
}

export const authService = new AuthService();