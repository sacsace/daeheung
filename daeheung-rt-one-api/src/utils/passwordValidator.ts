import { Company } from '../models';

// 비밀번호 검증 함수
export const validatePassword = async (
  password: string,
  tenantId: number,
  companyId?: number
): Promise<{ valid: boolean; message?: string }> => {
  // 시스템 설정에서 비밀번호 정책 가져오기
  let passwordMinLength: number | undefined = undefined;
  let requireSpecialChars: boolean | undefined = undefined;

  try {
    // 회사 설정에서 비밀번호 정책 가져오기
    if (companyId) {
      const company = await (Company as any).findOne({
        where: { id: companyId, tenant_id: tenantId },
        attributes: ['settings']
      });

      if (company && company.settings && company.settings.security) {
        // 명시적으로 설정된 값만 사용 (undefined가 아닌 경우만)
        if (company.settings.security.passwordMinLength !== undefined) {
          passwordMinLength = company.settings.security.passwordMinLength;
        }
        if (company.settings.security.requireSpecialChars !== undefined) {
          requireSpecialChars = company.settings.security.requireSpecialChars;
        }
      }
    }
  } catch (error) {
    console.error('비밀번호 정책 로드 오류:', error);
    // 설정을 읽을 수 없으면 검증하지 않음
  }

  // 최소 길이 검증 (설정이 있는 경우에만)
  if (passwordMinLength !== undefined && password.length < passwordMinLength) {
    return {
      valid: false,
      message: `비밀번호는 최소 ${passwordMinLength}자 이상이어야 합니다.`
    };
  }

  // 특수문자 요구사항 검증 (설정이 true인 경우에만)
  if (requireSpecialChars === true) {
    const specialCharRegex = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;
    if (!specialCharRegex.test(password)) {
      return {
        valid: false,
        message: '비밀번호에 최소 하나의 특수문자가 포함되어야 합니다.'
      };
    }
  }

  return { valid: true };
};

