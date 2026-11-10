import { useState, useCallback, useRef } from 'react';

/**
 * 문자 입력 모달 훅. UI는 `components/Common/PromptDialog` + `daeheungDialogShell` 기본 스타일을 사용합니다.
 */
export interface PromptDialogOptions {
  title?: string;
  titleKey?: string;
  message?: string;
  messageKey?: string;
  label?: string;
  labelKey?: string;
  defaultValue?: string;
  placeholder?: string;
  placeholderKey?: string;
  multiline?: boolean;
  minRows?: number;
  confirmText?: string;
  confirmTextKey?: string;
  cancelText?: string;
  cancelTextKey?: string;
  /** false면 빈 문자열도 확인 가능 */
  required?: boolean;
}

interface PromptDialogState extends PromptDialogOptions {
  open: boolean;
}

const initialState: PromptDialogState = {
  open: false,
  message: ''
};

/**
 * window.prompt 대체 — ConfirmDialog와 동일한 MVS 셸 스타일
 */
export const usePromptDialog = () => {
  const [dialogState, setDialogState] = useState<PromptDialogState>(initialState);
  const onConfirmRef = useRef<((value: string) => void) | null>(null);

  const showPrompt = useCallback(
    (message: string, onConfirm: (value: string) => void, options?: Omit<PromptDialogOptions, 'message'>) => {
      onConfirmRef.current = onConfirm;
      setDialogState({
        ...initialState,
        open: true,
        message,
        ...options
      });
    },
    []
  );

  const handleConfirm = useCallback((value: string) => {
    onConfirmRef.current?.(value);
    onConfirmRef.current = null;
    setDialogState(initialState);
  }, []);

  const handleCancel = useCallback(() => {
    onConfirmRef.current = null;
    setDialogState(initialState);
  }, []);

  return {
    dialogState,
    showPrompt,
    handleConfirm,
    handleCancel
  };
};
