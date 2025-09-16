import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const { VITE_API_URL } = import.meta.env;

export const signIn = createAsyncThunk(
    'AUTH_SIGN_IN',
    async (_payload, _thunkAPI) => {
        window.location.href = `${VITE_API_URL}/api/access/google`;
    },
);

export const logOut = createAsyncThunk(
    'AUTH_LOG_OUT',
    async (_, _thunkAPI) => {
        const response = await fetch(`${VITE_API_URL}/api/access/logout`, { credentials: 'include' });
        if (!response.ok || response.status !== 200) {
            console.error('AUTH_SIGN_OUT_ERROR: ', response.statusText || 'Failed to sign out');
            throw new Error(response.statusText || 'Failed to sign out');
        }
       //  await persistor.purge(); // Limpiar el storage persistido
        return await response.json();
    }
);

export const me = createAsyncThunk(
    'AUTH_ME',
    async (_, _thunkAPI) => {
        const response = await fetch(`${VITE_API_URL}/api/access/me`, { credentials: 'include' });
        if (!response.ok || response.status !== 200) {
            console.error('AUTH_ME_ERROR: ', response.statusText || 'Failed to sign out');
            throw new Error(response.statusText || 'Failed to fetch user data');
        }
        return await response.json();
    }
);

const initialState = {
    fetching: 0,
    error: null as string | null,
    message: null as string | null,
    data: {
        jwt: null as string | null,
        permissions: [],
        rols: [],
        user: null as string | null,
        email: null as string | null,
        familyName: null as string | null,
        givenName: null as string | null,
        displayName: null as string | null,
        picture: null as string | null,
    },
};

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        cleanError: (state) => ({ ...state, error: null }),
        cleanMessage: (state) => ({ ...state, message: null }),
    },
    extraReducers: (builder) => {
        builder
            .addCase(signIn.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(signIn.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(signIn.fulfilled, (state, _action) => { state.fetching = state.fetching - 1 })
            .addCase(logOut.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(logOut.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(logOut.fulfilled, (state, _action) => { state.data = initialState.data; state.fetching = state.fetching - 1; })
            .addCase(me.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(me.rejected, (state, action) => { state.data = initialState.data; state.error = action.error.message ?? null; state.fetching = state.fetching - 1 })
            .addCase(me.fulfilled, (state, action) => {
                console.log('Auth: /me API response:', action.payload);
                const { user } = action.payload;
                console.log('Auth: Extracted user:', user);
                return {
                    ...state,
                    fetching: state.fetching - 1,
                    data: {
                        ...state.data,
                        permissions: user.permissions,
                        rols: user.rols,
                        user: user.user || user, // Fix: use user directly if user.user is undefined
                        email: user.email,
                        familyName: user.lastName,
                        givenName: user.firstName,
                        displayName: user.alias,
                        picture: user.profilePicture,
                    },
                };
            });
    },
})

export const { cleanError, cleanMessage } = authSlice.actions;
export default authSlice.reducer;