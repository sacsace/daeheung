import { useState, useCallback, useRef } from 'react';
import { holdScrollPosition } from '../utils/preserveScroll';

/**
 * 확인 모달 상태 훅. UI는 반드시 `components/Common/ConfirmDialog` 를 렌더링하고
 * 스타일은 `daeheungDialogShell.ts` 기본값을 따릅니다.
 */
interface ConfirmDialogOptions {
  title?: string;
  titleKey?: string;
  message?: string;
  messageKey?: string;
  confirmText?: string;
  confirmTextKey?: string;
  cancelText?: string;
  cancelTextKey?: string;
  confirmColor?: 'primary' | 'error' | 'warning';
  /** danger: 본문 빨간 굵은 경고 문구 */
  messageTone?: 'default' | 'danger';
}

export interface ConfirmDialogState {
  open: boolean;
  message?: string;
  messageKey?: string;
  title?: string;
  titleKey?: string;
  confirmText?: string;
  confirmTextKey?: string;
  cancelText?: string;
  cancelTextKey?: string;
  confirmColor?: 'primary' | 'error' | 'warning';
  messageTone?: 'default' | 'danger';
}

const closedState: ConfirmDialogState = {
  open: false,
};

export const useConfirmDialog = () => {
  const [dialogState, setDialogState] = useState<ConfirmDialogState>(closedState);
  const onConfirmRef = useRef<(() => void) | null>(null);

  const showConfirm = useCallback(
    (message: string, onConfirm: () => void, options?: ConfirmDialogOptions) => {
      onConfirmRef.current = onConfirm;
      setDialogState({
        open: true,
        message: message || options?.message,
        messageKey: options?.messageKey,
        title: options?.title,
        titleKey: options?.titleKey,
        confirmText: options?.confirmText,
        confirmTextKey: options?.confirmTextKey,
        cancelText: options?.cancelText,
        cancelTextKey: options?.cancelTextKey,
        confirmColor: options?.confirmColor,
        messageTone: options?.messageTone,
      });
    },
    []
  );

  const handleConfirm = useCallback(() => {
    holdScrollPosition(1200);
    onConfirmRef.current?.();
    onConfirmRef.current = null;
    setDialogState(closedState);
  }, []);

  const handleCancel = useCallback(() => {
    onConfirmRef.current = null;
    setDialogState(closedState);
  }, []);

  return {
    dialogState,
    showConfirm,
    handleConfirm,
    handleCancel
  };
};





