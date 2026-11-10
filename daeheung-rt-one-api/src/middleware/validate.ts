import { Request, Response, NextFunction } from 'express';

type FieldType = 'string' | 'number' | 'boolean' | 'array';

type FieldRule = {
  required?: boolean;
  type?: FieldType;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  oneOf?: Array<string | number | boolean>;
};

type Schema = Record<string, FieldRule>;

const isTypeValid = (value: unknown, type?: FieldType) => {
  if (!type) return true;
  if (type === 'string') return typeof value === 'string';
  if (type === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'array') return Array.isArray(value);
  return true;
};

/** DECIMAL 값이 "1.00" 처럼 문자열로 오가는 경우가 있어 숫자 필드는 정규화 후 검증한다. */
const coerceNumericField = (payload: Record<string, unknown>, field: string, rule: FieldRule) => {
  if (rule.type !== 'number') return;
  const value = payload[field];
  if (typeof value !== 'string') return;
  const trimmed = value.trim();
  if (trimmed === '') return;
  const parsed = Number(trimmed);
  if (Number.isFinite(parsed)) payload[field] = parsed;
};

export const validateBody = (schema: Schema) => (req: Request, res: Response, next: NextFunction) => {
  const errors: string[] = [];
  const payload = req.body || {};

  for (const [field, rule] of Object.entries(schema)) {
    coerceNumericField(payload, field, rule);
    const value = payload[field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field}는 필수입니다.`);
      continue;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (!isTypeValid(value, rule.type)) {
      errors.push(`${field}의 타입이 올바르지 않습니다.`);
      continue;
    }

    if (typeof value === 'string') {
      if (rule.minLength && value.trim().length < rule.minLength) {
        errors.push(`${field}는 최소 ${rule.minLength}자 이상이어야 합니다.`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${field}는 ${rule.maxLength}자 이하로 입력해주세요.`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${field} 형식이 올바르지 않습니다.`);
      }
    }

    if (rule.oneOf && !rule.oneOf.includes(value)) {
      errors.push(`${field} 값이 올바르지 않습니다.`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0]
    });
  }

  next();
};
