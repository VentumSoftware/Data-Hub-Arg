import { createSlice } from '@reduxjs/toolkit';

interface ApiState {
  isOnline: boolean;
  baseUrl: string;
}

const initialState: ApiState = {
  isOnline: true,
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',
};

const apiSlice = createSlice({
  name: 'api',
  initialState,
  reducers: {
    setOnlineStatus: (state, action) => {
      state.isOnline = action.payload;
    },
    setBaseUrl: (state, action) => {
      state.baseUrl = action.payload;
    },
  },
});

export const { setOnlineStatus, setBaseUrl } = apiSlice.actions;
export default apiSlice.reducer;