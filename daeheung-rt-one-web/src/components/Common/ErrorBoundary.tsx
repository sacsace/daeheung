import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import i18n from '../../locales/i18n';
import { useErrorStore } from '../../store/errorStore';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  /** 경로가 바뀌면 막혀 있던 오류 화면을 걷어 다음 페이지를 연다 */
  resetKey?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  resetKey?: string;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      resetKey: props.resetKey
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    };
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey !== state.resetKey) {
      return { hasError: false, error: null, resetKey: props.resetKey };
    }
    return null;
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('❌ [Error Boundary] 컴포넌트 오류:', error, errorInfo);

    const errorStore = useErrorStore.getState();
    const errorMessage = this.getUserFriendlyMessage(error);
    const errorDetails = process.env.NODE_ENV === 'development'
      ? `컴포넌트: ${errorInfo.componentStack}\n\n에러: ${error.stack}`
      : undefined;

    errorStore.showError(
      i18n.t('common.pageError'),
      errorMessage,
      errorDetails,
      'error'
    );
  }

  getUserFriendlyMessage(error: Error): string {
    const errorMessage = error.message || error.toString();
    if (errorMessage.includes('Cannot read property') || errorMessage.includes('Cannot read')) {
      return i18n.t('common.loadDataError');
    }
    if (errorMessage.includes('Network') || errorMessage.includes('fetch')) {
      return i18n.t('common.networkErrorMsg');
    }
    if (errorMessage.includes('TypeError')) {
      return i18n.t('common.unexpectedError');
    }
    if (errorMessage.includes('ReferenceError')) {
      return i18n.t('common.pageLoadError');
    }
    return i18n.t('common.displayError');
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <Box sx={{ py: 6, px: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">{this.getUserFriendlyMessage(this.state.error ?? new Error())}</Typography>
          </Box>
        )
      );
    }

    return this.props.children;
  }
}

// 함수형 컴포넌트로 래핑하여 사용하기 쉽게 만듦
const ErrorBoundary: React.FC<Props> = ({ children, fallback, resetKey }) => {
  return (
    <ErrorBoundaryClass fallback={fallback} resetKey={resetKey}>
      {children}
    </ErrorBoundaryClass>
  );
};

export default ErrorBoundary;





