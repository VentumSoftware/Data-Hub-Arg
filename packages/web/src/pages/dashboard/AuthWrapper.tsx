import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate } from 'react-router-dom';
import { AppDispatch, RootState } from '../../store';
import { me } from '../../store/reducers/authSlice';

export default function AuthWrapper({ children }: { children: React.ReactElement }) {
  const dispatch: AppDispatch = useDispatch();
  const { data } = useSelector((state: RootState) => state.auth);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        await dispatch(me()).unwrap();
      } catch (error) {
        console.error('Auth verification failed:', error);
      } finally {
        setLoading(false);
      }
    };
    verifyAuth();
  }, [dispatch]);

  if (loading) {
    return <div>Loading...</div>; // O un spinner bonito
  }

  // Check if user is authenticated (email exists means they're logged in)
  const isAuthenticated = data.user || data.email;
  
  console.log('AuthWrapper: Auth data:', data);
  console.log('AuthWrapper: Is authenticated:', isAuthenticated);
  
  return isAuthenticated ? children : <Navigate to="/sign-in" replace />;
};

