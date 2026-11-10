// MVS Frontend 공통 상수 정의
export const APP_CONSTANTS = {
  // API 관련
  API_TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
  
  // 페이지네이션
  DEFAULT_PAGE_SIZE: 15,
  PAGE_SIZE_OPTIONS: [15, 25, 50, 100],
  
  // 지연 시간 (ms)
  LOADING_DELAY: 1000,
  DEBOUNCE_DELAY: 300,
  
  // 날짜 형식
  DATE_FORMAT: 'YYYY-MM-DD',
  DATETIME_FORMAT: 'YYYY-MM-DD HH:mm:ss',
  
  // 상태 값들
  STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
    DRAFT: 'draft',
    PUBLISHED: 'published',
    ARCHIVED: 'archived',
    PAID: 'paid',
    OVERDUE: 'overdue'
  },
  
  // 우선순위
  PRIORITY: {
    LOW: 'low',
    MEDIUM: 'medium',
    HIGH: 'high',
    URGENT: 'urgent'
  },
  
  // 결제 상태
  PAYMENT_STATUS: {
    PENDING: 'pending',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled'
  },
  
  // 인보이스 상태
  INVOICE_STATUS: {
    DRAFT: 'draft',
    SENT: 'sent',
    PAID: 'paid',
    OVERDUE: 'overdue',
    CANCELLED: 'cancelled'
  },
  
  // 프로젝트 상태
  PROJECT_STATUS: {
    PLANNING: 'planning',
    IN_PROGRESS: 'in_progress',
    ON_HOLD: 'on_hold',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
  },
  
  // 재고 상태
  INVENTORY_STATUS: {
    IN_STOCK: 'in_stock',
    LOW_STOCK: 'low_stock',
    OUT_OF_STOCK: 'out_of_stock',
    OVERSTOCK: 'overstock'
  },
  
  // 객실 타입
  ROOM_TYPES: {
    STANDARD: 'standard',
    DELUXE: 'deluxe',
    SUITE: 'suite',
    PRESIDENTIAL: 'presidential'
  },
  
  // 객실 상태
  ROOM_STATUS: {
    AVAILABLE: 'available',
    OCCUPIED: 'occupied',
    RESERVED: 'reserved',
    MAINTENANCE: 'maintenance'
  },
  
  // 사용자 역할
  USER_ROLES: {
    ROOT: 'Root',
    ADMIN: 'admin',
    MANAGER: 'manager',
    EMPLOYEE: 'employee',
    HR: 'hr',
    FINANCE: 'finance'
  },
  
  /** MVS 표시 통화: Rs. / ISO INR */
  CURRENCIES: {
    INR: 'INR',
    USD: 'USD'
  },
  DEFAULT_CURRENCY: 'INR' as const,
  
  // 세율 (기본값)
  DEFAULT_TAX_RATE: 10,
  
  // 파일 크기 제한 (MB)
  MAX_FILE_SIZE: 10,
  
  // 검색 결과 제한
  MAX_SEARCH_RESULTS: 100,
  
  // 차트 색상
  CHART_COLORS: [
    '#1976d2', '#dc004e', '#9c27b0', '#673ab7',
    '#3f51b5', '#2196f3', '#03a9f4', '#00bcd4',
    '#009688', '#4caf50', '#8bc34a', '#cddc39',
    '#ffeb3b', '#ffc107', '#ff9800', '#ff5722'
  ]
};

// 샘플 데이터 상수
export const SAMPLE_DATA = {
  USERS: {
    DEVELOPER: '김개발',
    FRONTEND: '이프론트',
    BACKEND: '박백엔드',
    MARKETING: '최마케팅',
    HR: 'HR팀',
    ADMIN: '관리자'
  },
  
  COMPANIES: {
    ABC: 'ABC 회사',
    XYZ: 'XYZ 기업',
    DEF: 'DEF 주식회사',
    MVS: 'MVS Solutions'
  },
  
  DEPARTMENTS: {
    DEVELOPMENT: '개발팀',
    MARKETING: '마케팅팀',
    SALES: '영업팀',
    HR: '인사팀',
    FINANCE: '재무팀',
    DESIGN: '디자인팀'
  },
  
  POSITIONS: {
    TEAM_LEAD: '팀장',
    DEVELOPER: '개발자',
    MANAGER: '매니저',
    DIRECTOR: '이사',
    SENIOR: '시니어',
    JUNIOR: '주니어'
  },
  
  PRODUCTS: {
    SOFTWARE: '소프트웨어',
    HARDWARE: '하드웨어',
    SERVICE: '서비스',
    CONSULTING: '컨설팅'
  },
  
  LOCATIONS: {
    SEOUL: '서울',
    BUSAN: '부산',
    DAEGU: '대구',
    INCHEON: '인천',
    GWANGJU: '광주'
  }
};

// 메시지 상수
export const MESSAGES = {
  SUCCESS: {
    SAVE: '저장되었습니다.',
    DELETE: '삭제되었습니다.',
    UPDATE: '수정되었습니다.',
    CREATE: '생성되었습니다.',
    SEND: '전송되었습니다.',
    APPROVE: '승인되었습니다.',
    REJECT: '거부되었습니다.'
  },
  
  ERROR: {
    LOAD: '데이터를 불러오는데 실패했습니다.',
    SAVE: '저장에 실패했습니다.',
    DELETE: '삭제에 실패했습니다.',
    UPDATE: '수정에 실패했습니다.',
    CREATE: '생성에 실패했습니다.',
    NETWORK: '네트워크 오류가 발생했습니다.',
    UNAUTHORIZED: '권한이 없습니다.',
    VALIDATION: '입력값을 확인해주세요.'
  },
  
  CONFIRM: {
    DELETE: '정말 삭제하시겠습니까?',
    CANCEL: '작업을 취소하시겠습니까?',
    LOGOUT: '로그아웃하시겠습니까?',
    RESET: '초기화하시겠습니까?'
  }
};

// 유틸리티 함수들
export const UTILS = {
  // 숫자 포맷팅 (MVS 공통: Rs. · INR)
  formatCurrency: (amount: number, _currencyCode: string = APP_CONSTANTS.CURRENCIES.INR): string => {
    const n = Number(amount) || 0;
    return `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  },
  
  // 날짜 포맷팅
  formatDate: (date: string | Date, format: string = APP_CONSTANTS.DATE_FORMAT): string => {
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR');
  },
  
  // 상태별 색상 반환
  getStatusColor: (status: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
    switch (status) {
      case APP_CONSTANTS.STATUS.ACTIVE:
      case APP_CONSTANTS.STATUS.APPROVED:
      case APP_CONSTANTS.STATUS.PAID:
        return 'success';
      case APP_CONSTANTS.STATUS.PENDING:
        return 'warning';
      case APP_CONSTANTS.STATUS.REJECTED:
      case APP_CONSTANTS.STATUS.OVERDUE:
        return 'error';
      case APP_CONSTANTS.STATUS.DRAFT:
        return 'info';
      default:
        return 'default';
    }
  },
  
  // 지연 함수
  delay: (ms: number = APP_CONSTANTS.LOADING_DELAY): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  // 디바운스 함수
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number = APP_CONSTANTS.DEBOUNCE_DELAY
  ): ((...args: Parameters<T>) => void) => {
    let timeout: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
};
