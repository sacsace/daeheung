import { useEffect } from 'react';

type UseDialogKeyboardOptions = {
  open: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmEnabled?: boolean;
  /** textarea에서 Enter는 줄바꿈 유지 */
  allowEnterInTextarea?: boolean;
};

/** 다이얼로그 — Enter 확인, Esc 취소 (전역 친화 UX) */
export function useDialogKeyboard({
  open,
  onConfirm,
  onCancel,
  confirmEnabled = true,
  allowEnterInTextarea = false,
}: UseDialogKeyboardOptions) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        return;
      }

      if (event.key !== 'Enter' || event.shiftKey || !confirmEnabled) return;

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toUpperCase();
      if (tag === 'TEXTAREA' && allowEnterInTextarea) return;
      if (tag === 'BUTTON') return;

      event.preventDefault();
      onConfirm?.();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onConfirm, onCancel, confirmEnabled, allowEnterInTextarea]);
}
