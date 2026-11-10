import { useEffect } from 'react';
import {
  setNativeInputValue,
  shouldApplyProperCaseToInput,
  toProperCaseInput,
} from '../../utils/textCase';

/**
 * 모든 text/textarea 입력 blur 시 단어별 첫 글자 대문자·나머지 소문자로 정규화.
 * (email/password/숫자/코드성 필드·댓글 입력 제외)
 */
export default function InputProperCaseListener() {
  useEffect(() => {
    const onFocusOut = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) {
        return;
      }
      if (!shouldApplyProperCaseToInput(target)) return;
      const next = toProperCaseInput(target.value);
      if (next === target.value) return;
      setNativeInputValue(target, next);
    };

    document.addEventListener('focusout', onFocusOut, true);
    return () => document.removeEventListener('focusout', onFocusOut, true);
  }, []);

  return null;
}
