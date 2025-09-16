import { configureStore } from '@reduxjs/toolkit';
import { persistReducer, persistStore } from 'redux-persist';

import authReducer from './reducers/authSlice';
import navReducer from './reducers/navSlice';
import usersSlice from '../pages/dashboard/users/UsersSlice';
import filesSlice from '../pages/dashboard/files/FilesSlices';
import { authPersistConfig } from './persistConfig';
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

// Mueve esta línea después de todos los imports

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    nav: navReducer,
    users: usersSlice,
    files: filesSlice,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware({
    serializableCheck: false // Desactivar temporalmente para pruebas
    })
});

export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;