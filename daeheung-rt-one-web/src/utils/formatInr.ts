/** 인도식 숫자 형식 (₹1,25,000.00) */
export const formatInr = (value: number | string | null | undefined): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '₹0.00';
  const [intPart, decPart = '00'] = Math.abs(n).toFixed(2).split('.');
  const lastThree = intPart.slice(-3);
  const rest = intPart.slice(0, -3);
  const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${lastThree}` : lastThree;
  return `${n < 0 ? '-' : ''}₹${grouped}.${decPart}`;
};

export const parseInrInput = (value: string): number => {
  const cleaned = String(value || '').replace(/[₹,\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};
