import { useErrorStore } from '../store/errorStore';

/**
 * 에러를 팝업으로 표시하는 유틸리티 함수
 * @param error - 에러 객체 또는 에러 메시지
 * @param title - 팝업 제목 (선택사항)
 * @param type - 에러 타입 (선택사항)
 */
export const showErrorPopup = (
  error: any,
  title?: string,
  type: 'error' | 'warning' | 'info' = 'error'
) => {
  const errorStore = useErrorStore.getState();
  
  let message = '알 수 없는 오류가 발생했습니다.';
  let details: string | undefined;

  if (typeof error === 'string') {
    message = error;
  } else if (error?.response?.data?.message) {
    message = error.response.data.message;
  } else if (error?.message) {
    message = error.message;
  }

  // 개발 환경에서만 상세 정보 포함
  if (process.env.NODE_ENV === 'development' && error) {
    const detailParts: string[] = [];
    
    if (error.config) {
      detailParts.push(`URL: ${error.config.method?.toUpperCase()} ${error.config.url}`);
    }
    
    if (error.response) {
      detailParts.push(`Status: ${error.response.status}`);
      if (error.response.data && typeof error.response.data === 'object') {
        detailParts.push(`Response: ${JSON.stringify(error.response.data, null, 2)}`);
      }
    }
    
    if (error.stack) {
      detailParts.push(`Stack: ${error.stack}`);
    }
    
    if (detailParts.length > 0) {
      details = detailParts.join('\n\n');
    }
  }

  errorStore.showError(
    title || '오류 발생',
    message,
    details,
    type
  );
};

/**
 * 성공 메시지를 팝업으로 표시하는 유틸리티 함수
 * @param message - 성공 메시지
 * @param title - 팝업 제목 (선택사항)
 */
export const showSuccessPopup = (message: string, title: string = '성공') => {
  const errorStore = useErrorStore.getState();
  errorStore.showError(title, message, undefined, 'info');
};

/**
 * 성공 메시지를 상단 토스트로 표시하는 유틸리티 함수
 * @param message - 성공 메시지
 */
export const showSuccessToast = (message: string) => {
  const errorStore = useErrorStore.getState();
  errorStore.showNotification(message, 'success');
};

/**
 * 경고 메시지를 팝업으로 표시하는 유틸리티 함수
 * @param message - 경고 메시지
 * @param title - 팝업 제목 (선택사항)
 */
export const showWarningPopup = (message: string, title: string = '경고') => {
  const errorStore = useErrorStore.getState();
  errorStore.showError(title, message, undefined, 'warning');
};





