import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from "react";
import { useDispatch, useSelector } from 'react-redux';
import { me } from "./store/reducers/authSlice";
import { AppDispatch, RootState } from './store';
import SignIn from './pages/signIn/SignIn';

import Landing from './pages/landing/Landing';
import Dashboard from './pages/dashboard/Dashboard';
import AuthWrapper from './pages/dashboard/AuthWrapper';
import Users from './pages/dashboard/users/Users';
import Roles from './pages/dashboard/roles/Roles';
import Files from './pages/dashboard/files/Files';
import Error from './pages/placeholders/Error';
import './App.css';

const App = () => {
  const dispatch: AppDispatch = useDispatch();
  const { data } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    // Solo verifica autenticación si no hay datos de usuario
    if (!data.user) {
      dispatch(me());
    }
  }, [dispatch, data.user]);


  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/dashboard" element={<AuthWrapper><Dashboard /></AuthWrapper>}>
        <Route index element={<Users />} />
        <Route path="usuarios/*" element={<Users />} />
        <Route path="roles/*" element={<Roles />} />
        <Route path="files/*" element={<Files />} />
        <Route path="*" element={<Users />} />
      </Route>
      <Route path="*" element={<Error />} />
    </Routes>
  );
};

export default App;
