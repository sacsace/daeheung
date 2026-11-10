/**
 * window.confirm을 MVS 스타일의 확인 다이얼로그로 교체하기 위한 헬퍼 함수
 * 이 함수는 기존 window.confirm 호출을 쉽게 교체할 수 있도록 도와줍니다.
 */

export const createConfirmHandler = (
  showConfirm: (message: string, onConfirm: () => void, options?: any) => void,
  message: string,
  onConfirm: () => void,
  options?: { confirmColor?: 'primary' | 'error' | 'warning'; title?: string }
) => {
  return () => {
    showConfirm(message, onConfirm, options);
  };
};





