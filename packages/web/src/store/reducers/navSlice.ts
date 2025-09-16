import { createSlice,  PayloadAction } from "@reduxjs/toolkit";

const MAX_HISTORY_LENGTH = 100;

interface NavState {
    path: string[];
    history: string[][];
    drawerOpen: boolean
}

const initialState: NavState = {
    path: window.location.pathname.split('/').filter(x => x !== ''),
    history: [],
    drawerOpen: true,
};

const navSlice = createSlice({
    name: 'nav',
    initialState,
    reducers: {
        setPath: (state, action) => {
            state.path = action.payload.filter((x: string) => x !== '');
            state.history.push(state.path);
            state.history = state.history.slice(-MAX_HISTORY_LENGTH);
        },
        pushPath: (state, action) => {
            state.path = Array.isArray(action) ? [...state.path, ...action.payload] : [...state.path, action.payload];
            state.history.push(state.path);
            state.history = state.history.slice(-MAX_HISTORY_LENGTH);
        },
        slicePath: (state, action) => {
            state.path = state.path.slice(0, action.payload);
            state.history.push(state.path);
            state.history = state.history.slice(-MAX_HISTORY_LENGTH);
        },
        goBack: (state, action) => {
            let postfix = action.payload || 1;
            if (state.history.length > postfix) {
                state.history = state.history.slice(0, -postfix);
                state.path = state.history[state.history.length - 1] || initialState.path;
            } else {
                state.path = initialState.path;
            }
        },
    setDrawerOpen(state, action: PayloadAction<boolean>) {
      state.drawerOpen = action.payload;
    },
    toggleDrawer(state, action) {
      state.drawerOpen = action.payload;
    }
    },
});

export const { setPath, pushPath, slicePath, goBack, setDrawerOpen, toggleDrawer } = navSlice.actions;
export default navSlice.reducer;
