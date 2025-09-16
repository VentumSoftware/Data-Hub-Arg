import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../services/authService';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  alias?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Load stored auth token on app start
export const loadStoredAuth = createAsyncThunk(
  'auth/loadStored',
  async () => {
    const token = await SecureStore.getItemAsync('authToken');
    if (token) {
      const user = await authService.getCurrentUser(token);
      return { token, user };
    }
    return null;
  }
);

// Login with email and password
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }) => {
    const response = await authService.login(email, password);
    await SecureStore.setItemAsync('authToken', response.token);
    return response;
  }
);

// Login with Google
export const loginWithGoogle = createAsyncThunk(
  'auth/loginWithGoogle',
  async () => {
    const response = await authService.loginWithGoogle();
    await SecureStore.setItemAsync('authToken', response.token);
    return response;
  }
);

// Logout
export const logout = createAsyncThunk(
  'auth/logout',
  async () => {
    await SecureStore.deleteItemAsync('authToken');
    await authService.logout();
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // Load stored auth
    builder.addCase(loadStoredAuth.pending, (state) => {
      state.isLoading = true;
    });
    builder.addCase(loadStoredAuth.fulfilled, (state, action) => {
      if (action.payload) {
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.isAuthenticated = true;
      }
      state.isLoading = false;
    });
    builder.addCase(loadStoredAuth.rejected, (state) => {
      state.isLoading = false;
    });

    // Login
    builder.addCase(login.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(login.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
    });
    builder.addCase(login.rejected, (state, action) => {
      state.error = action.error.message || 'Login failed';
      state.isLoading = false;
    });

    // Login with Google
    builder.addCase(loginWithGoogle.pending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addCase(loginWithGoogle.fulfilled, (state, action) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      state.isLoading = false;
    });
    builder.addCase(loginWithGoogle.rejected, (state, action) => {
      state.error = action.error.message || 'Google login failed';
      state.isLoading = false;
    });

    // Logout
    builder.addCase(logout.fulfilled, (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
    });
  },
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;