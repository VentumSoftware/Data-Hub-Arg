import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { RootState } from '../../../store/index';
const { VITE_API_URL } = import.meta.env;

const getHeaders = () => ({
    //  Authorization: `Bearer ${state.auth.data.jwt}`,
    'Content-Type': 'application/json',
});

export const getData = createAsyncThunk(
    'USERS_GET_DATA',
    async (_payload, _thunkAPI) => {
        try {
            console.log('Fetching users from:', `${VITE_API_URL}/api/access/users`);
            
            const response = await fetch(`${VITE_API_URL}/api/access/users`, { 
                method: 'GET', 
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                }
            });
            
            console.log('Users API response status:', response.status);
            console.log('Users API response headers:', Object.fromEntries(response.headers.entries()));
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Users API error:', response.status, response.statusText);
                console.error('Error response body:', errorText);
                throw new Error(`Failed to fetch users: ${response.status} ${response.statusText} - ${errorText}`);
            }
            
            const apiResponse = await response.json();
            console.log('Raw users API response:', apiResponse);
            
            // Extract the users array from the API response
            const users = apiResponse.success ? apiResponse.data : [];
            console.log('Extracted users array:', users);
            console.log('Type of users:', typeof users);
            console.log('Is array:', Array.isArray(users));
            
            return { users, permissions: null, rols: null };
        } catch (error) {
            console.error('Network or parsing error in getData:', error);
            throw error;
        }
    },
);

export const getUserDetails = createAsyncThunk(
    'USERS_GET_USER_DETAILS',
    async (userId: number, _thunkAPI) => {
        let response = await fetch(`${VITE_API_URL}/api/access/users/${userId}`, { 
            method: 'GET', 
            credentials: 'include' 
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user details');
        }
        return await response.json();
    },
);


// 4. Editar proyecto
export const updateUser = createAsyncThunk<any, { userId: number; data: any }, { state: RootState }>(
    'users/updateUser',
    async ({ userId, data }: { userId: number; data: any }, thunkAPI) => {
        console.log('🔄 Updating user:', userId, data);
        try {
            const res = await fetch(`${VITE_API_URL}/api/access/users/${userId}`, {
                method: 'PUT',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });
            
            console.log('📡 Update response status:', res.status);
            
            if (!res.ok) {
                const errorText = await res.text();
                console.error('❌ Update failed:', res.status, errorText);
                throw new Error(`Failed to update user: ${res.status} - ${errorText}`);
            }
            
            const result = await res.json();
            console.log('✅ Update successful:', result);
            return result;
        } catch (error) {
            console.error('🚨 Update error:', error);
            throw error;
        }
    }
);
//5. Crear Proyecto 
export const createUser = createAsyncThunk<any, CreateUserPayload, { state: RootState }>(
    'users/payment',
    async (data, thunkAPI) => {
        let res = await fetch(`${VITE_API_URL}/users/payment`, {
            method: 'POST',
            credentials: 'include',
            body: JSON.stringify(data),
            headers: getHeaders(),
        });
        res = (await res.json())[0];
        return res
    }
);
// 6. Editar unidad
export const deleteUser = createAsyncThunk<any, { userId: number }, { state: RootState }>(
    'users/deleteUser',
    async ({ userId }: { userId: number | string | null | undefined }, thunkAPI) => {
        const res = await fetch(`${VITE_API_URL}/api/access/users/${userId}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        if (!res.ok) {
            throw new Error('Failed to delete user');
        }
        return await res.json();
    }
);

export const fetchUserHistory = createAsyncThunk(
    'users/fetchUserHistory',
    async (userId: number, { rejectWithValue }) => {
        try {
            const response = await fetch(`${VITE_API_URL}/api/access/users/${userId}/history`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch history: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.data;
        } catch (error: any) {
            return rejectWithValue(error.message);
        }
    }
);
export type User = {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
    alias: string;
    profilePicture: string;
    url: string;
    bio: string;
    birthday: string;
    gender: string;
    locale: string;
    timezone: string;
    location: string;
    phone: string;
    address: string;
    createdAt: string;
    isDeleted: boolean;
    editedBy: number;
    company: number;
}
export type CreateUserPayload = {
    email: string;
    alias: string;
    firstName: string;
    lastName: string;
    profilePicture: string;
    url: string;
    bio: string;
    birthday: string;
    gender: string;
    locale: string;
    timezone: string;
    location: string;
    phone: string;
    address: string;
    createdAt: string;
    isDeleted: boolean;
    editedBy: number;
    company: number;
}
const initialState: {
    fetching: number;
    fetched: boolean;
    error: string | null;
    message: string | null;
    data: {
        users: User[];
        permissions: Array<any> | null;
        rols: Array<any> | null;
    };
    userDetails: {
        data: any | null;
        fetching: boolean;
        error: string | null;
    };
    userHistory: {
        data: any | null;
        fetching: boolean;
        error: string | null;
    };
}  = {
    fetched: false,
    fetching: 0,
    error: null as string | null,
    message: null as string | null,
    data: {
        users: [],
        permissions: null as Array<any> | null,
        rols: null as Array<any> | null,
    },
    userDetails: {
        data: null,
        fetching: false,
        error: null,
    },
    userHistory: {
        data: null,
        fetching: false,
        error: null,
    },
};

const usersSlice = createSlice({
    name: 'users',
    initialState,
    reducers: {
        cleanError: (state) => ({ ...state, error: null }),
        cleanMessage: (state) => ({ ...state, message: null }),
    },
    extraReducers: (builder) => {
        builder
            .addCase(getData.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(getData.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(getData.fulfilled, (state, _action) => { state.data = _action.payload; state.fetching = state.fetching - 1; state.fetched = true; })

            .addCase(updateUser.fulfilled, (state, action) => {
                const updated = action.payload;
                const index = state.data.users.findIndex(p => p.id === updated.id);
                if (index >= 0) state.data.users[index] = updated;
            })

            .addCase(createUser.fulfilled, (state, action) => {
                state.data.users.push(action.payload);
            })

            .addCase(deleteUser.fulfilled, (state, action) => {
                const deleted = action.payload;
                const index = state.data.users.findIndex(p => p.id === deleted.id);
                if (index >= 0) state.data.users.splice(index, 1);
            })

            .addCase(getUserDetails.pending, (state, _action) => { 
                state.userDetails.fetching = true;
                state.userDetails.error = null;
            })
            .addCase(getUserDetails.rejected, (state, action) => { 
                state.userDetails.error = action.error.message ?? null; 
                state.userDetails.fetching = false;
            })
            .addCase(getUserDetails.fulfilled, (state, action) => { 
                state.userDetails.data = action.payload; 
                state.userDetails.fetching = false;
                state.userDetails.error = null;
            })

            .addCase(fetchUserHistory.pending, (state, _action) => { 
                state.userHistory.fetching = true;
                state.userHistory.error = null;
            })
            .addCase(fetchUserHistory.rejected, (state, action) => { 
                state.userHistory.error = action.payload as string ?? null; 
                state.userHistory.fetching = false;
            })
            .addCase(fetchUserHistory.fulfilled, (state, action) => { 
                state.userHistory.data = action.payload; 
                state.userHistory.fetching = false;
                state.userHistory.error = null;
            })
    },
})

export const { cleanError, cleanMessage } = usersSlice.actions;
export default usersSlice.reducer;