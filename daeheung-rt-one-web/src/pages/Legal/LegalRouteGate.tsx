import React from 'react';
import { useStore } from '../../store';
import ProtectedRoute from '../../components/Auth/ProtectedRoute';
import AppLayout from '../../components/Layout/AppLayout';

/**
 * 로그인 상태면 AppLayout(body) 안에, 아니면 공개 페이지로 표시.
 * /legal/* 는 AppLayout Outlet 밖에 정의되어 있어도 본문 영역에 넣을 수 있게 함.
 */
const LegalRouteGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    return (
      <ProtectedRoute>
        <AppLayout>{children}</AppLayout>
      </ProtectedRoute>
    );
  }

  return <>{children}</>;
};

export default LegalRouteGate;
