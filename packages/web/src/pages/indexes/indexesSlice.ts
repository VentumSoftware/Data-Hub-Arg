import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

const { VITE_API_URL } = import.meta.env;

export const getIndexes = createAsyncThunk(

    'INDEXES_GET_INDEXES',
    async (_payload: { page: number, pageSize: number }, _thunkAPI) => {
        const { page, pageSize } = _payload;
        const url = new URL(`${VITE_API_URL}/api/indexes/historical-by-dates`);
        url.searchParams.set('page', (page + 1).toString()); // Convert 0-based to 1-based
        url.searchParams.set('pageSize', pageSize.toString());
        url.searchParams.set('sortOrder', 'desc');
        const response = await fetch(url.toString(), { credentials: 'include' });

        if (!response.ok || response.status !== 200) {
            throw new Error('Failed to fetch indexes');

        };
        const data = await response.json();
        return data;
    },
);
export const getCurrencyIndexes = createAsyncThunk(

    'INDEXES_GET_CURRENCIES',
    async (_payload, _thunkAPI) => {
        const response = await fetch(`${VITE_API_URL}/api/indexes/currencies`, { credentials: 'include' });

        if (!response.ok || response.status !== 200) {
            throw new Error('Failed to fetch currencies');

        };
        const data = await response.json();
        return data;
    },
)
export const logOut = createAsyncThunk(
    'AUTH_LOG_OUT',
    async (_, _thunkAPI) => {
        const response = await fetch(`${VITE_API_URL}/api/indexes/logout`, { credentials: 'include' });
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
        const response = await fetch(`${VITE_API_URL}/api/indexes/me`, { credentials: 'include' });
        if (!response.ok || response.status !== 200) {
            console.error('AUTH_ME_ERROR: ', response.statusText || 'Failed to sign out');
            throw new Error(response.statusText || 'Failed to fetch user data');
        }
        return await response.json();
    }
);
export interface Index {
    [key: string]: any;
};
interface CurrencyIndex {
    id: number;
    date: string;
    currenciesRelationsId: number;
    value: number;
    isDeleted: boolean;
    editedAt: string;
    editedBy: number;
    editedSession?: string;
    dividendCurrencyCode: string;
    dividendCurrencyLabel: string;
    divisorCurrencyCode: string;
    divisorCurrencyLabel: string;
    op: 'direct' | 'inverse' | 'both';
}
interface Currency {
    id: number;
    code: string;
    label: string;
    symbol: string;
}
export interface IndexesState {
    fetching: number;
    error: string | null;
    message: string | null;
    data: { indexes: CurrencyIndex[], currencies: Currency[] };
}
const initialState: IndexesState = {
    fetching: 0,
    error: null as string | null,
    message: null as string | null,
    data: {
        indexes: [],
        currencies: [],
    },
};

const indexesSlice = createSlice({
    name: 'indexes',
    initialState,
    reducers: {
        cleanError: (state) => ({ ...state, error: null }),
        cleanMessage: (state) => ({ ...state, message: null }),
    },
    extraReducers: (builder) => {
        builder
            .addCase(getIndexes.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(getIndexes.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(getIndexes.fulfilled, (state, _action) => { state.fetching = state.fetching - 1; state.data.indexes = _action.payload?.data; })
            .addCase(getCurrencyIndexes.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(getCurrencyIndexes.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(getCurrencyIndexes.fulfilled, (state, _action) => { state.fetching = state.fetching - 1; state.data.currencies = _action.payload; })
            
            
            .addCase(logOut.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(logOut.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(logOut.fulfilled, (state, _action) => { state.data = initialState.data; state.fetching = state.fetching - 1; })
            .addCase(me.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(me.rejected, (state, action) => { state.data = initialState.data; state.error = action.error.message ?? null; state.fetching = state.fetching - 1 })
            .addCase(me.fulfilled, (state, action) => {
                console.log('Indexes: /me API response:', action.payload);
                const { user } = action.payload;
                console.log('Indexes: Extracted user:', user);
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

export const { cleanError, cleanMessage } = indexesSlice.actions;
export default indexesSlice.reducer;