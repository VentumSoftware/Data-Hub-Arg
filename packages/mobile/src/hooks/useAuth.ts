import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../store';
import { loadStoredAuth } from '../store/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated, isLoading, error } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    // Load stored authentication on mount
    dispatch(loadStoredAuth());
  }, [dispatch]);

  return {
    user,
    isAuthenticated,
    isLoading,
    error,
  };
};