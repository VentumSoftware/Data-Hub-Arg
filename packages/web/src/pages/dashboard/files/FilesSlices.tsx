import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { RootState } from '../../../store';
const { VITE_API_URL } = import.meta.env;

export interface FSNodeDTO {
    name: string;
    path: string;
    type: 'file' | 'dir' | 'up-dir';
    size?: number;
    lastAccess?: string;
    lastUpdate?: string;
    lastMod?: string;
    childs?: FSNodeDTO[];
};

export const getData = createAsyncThunk(
    'FILES_GET_DATA',
    async (_payload, _thunkAPI) => {
        const response = await fetch(`${VITE_API_URL}/api/fs/node/?recursive=true`, { method: 'GET', credentials: 'include' });
        const nodes = await response.json();
        return { nodes: nodes?.childs };
    },
);

export const createFolder = createAsyncThunk(
    'FILES_CREATE_FOLDER',
    async (_payload, _thunkAPI) => {
        const body = { path: _payload };
        const response = await fetch(`${VITE_API_URL}/api/fs/dir/`, { method: 'POST', credentials: 'include', body: JSON.stringify(body) });
        await response.json();
        await _thunkAPI.dispatch(getData()).unwrap();
    },
);

export const createFile = createAsyncThunk(
    'FILES_CREATE_FILE',
    async (_payload: { file: File, path: string, ensureParentDir?: boolean }, _thunkAPI) => {
        const formData = new FormData();
        formData.append('file', _payload.file);
        formData.append('path', _payload.path);
        if (_payload.ensureParentDir !== undefined) {
            formData.append('ensureParentDir', String(_payload.ensureParentDir));
        }

        const response = await fetch(`${VITE_API_URL}/api/fs/file/`, {
            method: 'POST',
            credentials: 'include',
            body: formData,
        });
        await response.json();
        await _thunkAPI.dispatch(getData()).unwrap();
    },
);

export const renameNode = createAsyncThunk(
    'FILES_RENAME_NODE',
    async (_payload: { path: string, newPath: string }, _thunkAPI) => {
        const body = { path: _payload.path, newPath: _payload.newPath };
        const response = await fetch(`${VITE_API_URL}/api/fs/node/rename/`, { method: 'PATCH', credentials: 'include', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' }   });
        await response.json();
    },
);

export const deleteNode = createAsyncThunk<void, string>(
    'FILES_DELETE_NODE',
    async (_payload, _thunkAPI) => {
       await fetch(`${VITE_API_URL}/api/fs/node/${_payload}?recursive=true`, { method: 'DELETE', credentials: 'include' });
    },
);

const initialState = {
    fetching: 0,
    error: null as string | null,
    message: null as string | null,
    data: {
        selectedFolder: '/',
        nodes: null as Array<any> | null,
    },
};

const filesSlice = createSlice({
    name: 'files',
    initialState,
    reducers: {
        cleanError: (state) => ({ ...state, error: null }),
        cleanMessage: (state) => ({ ...state, message: null }),
        selectFolder: (state, action) => { state.data.selectedFolder = action.payload },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getData.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(getData.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(getData.fulfilled, (state, _action) => { state.data.nodes = _action.payload.nodes; state.fetching = state.fetching - 1 })
            .addCase(createFolder.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(createFolder.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(createFolder.fulfilled, (state, _action) => { state.fetching = state.fetching - 1 })
            .addCase(createFile.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(createFile.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(createFile.fulfilled, (state, _action) => { state.fetching = state.fetching - 1 })
            .addCase(renameNode.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(renameNode.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(renameNode.fulfilled, (state, _action) => { state.fetching = state.fetching - 1 })
            .addCase(deleteNode.pending, (state, _action) => { state.fetching = state.fetching + 1 })
            .addCase(deleteNode.rejected, (state, action) => { state.error = action.error.message ?? null; state.fetching = state.fetching - 1; })
            .addCase(deleteNode.fulfilled, (state, _action) => { state.fetching = state.fetching - 1 })
    },
});

export const { cleanError, cleanMessage, selectFolder } = filesSlice.actions;
export default filesSlice.reducer;