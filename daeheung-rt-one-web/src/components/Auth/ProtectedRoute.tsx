import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStore } from '../../store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated } = useStore();
  const location = useLocation();

  if (!isAuthenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    const redirect =
      returnTo && returnTo !== '/'
        ? `?redirect=${encodeURIComponent(returnTo)}`
        : '';
    return <Navigate to={`/login${redirect}`} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
