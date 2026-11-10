// MVS 샘플 데이터 정의
import { APP_CONSTANTS, SAMPLE_DATA } from './index';

// 인보이스 샘플 데이터
export const SAMPLE_INVOICES = [
  {
    id: 1,
    invoiceNumber: 'INV-2024-001',
    customerId: 1001,
    customerName: SAMPLE_DATA.COMPANIES.ABC,
    customerEmail: 'finance@abc.com',
    customerPhone: '02-1234-5678',
    customerAddress: '서울시 강남구 테헤란로 123',
    companyName: SAMPLE_DATA.COMPANIES.MVS,
    companyAddress: '서울시 서초구 서초대로 456',
    companyPhone: '02-9876-5432',
    companyEmail: 'info@mvs3.com',
    invoiceDate: '2024-01-01',
    dueDate: '2024-01-31',
    items: [
      {
        id: 1,
        itemName: '개발 서비스',
        description: '웹 애플리케이션 개발',
        quantity: 1,
        unitPrice: 5000000,
        totalPrice: 5000000,
        taxRate: APP_CONSTANTS.DEFAULT_TAX_RATE,
        taxAmount: 500000
      }
    ],
    subtotal: 5000000,
    totalTax: 500000,
    totalAmount: 5500000,
    status: 'paid' as const,
    notes: '월간 개발 서비스 비용',
    createdAt: '2024-01-01 09:00:00',
    updatedAt: '2024-01-01 09:00:00',
    createdBy: SAMPLE_DATA.USERS.BACKEND
  },
  {
    id: 2,
    invoiceNumber: 'INV-2024-002',
    customerId: 1002,
    customerName: SAMPLE_DATA.COMPANIES.XYZ,
    customerEmail: 'accounting@xyz.com',
    customerPhone: '031-9876-5432',
    customerAddress: '경기도 성남시 분당구 판교로 456',
    companyName: SAMPLE_DATA.COMPANIES.MVS,
    companyAddress: '서울시 서초구 서초대로 456',
    companyPhone: '02-9876-5432',
    companyEmail: 'info@mvs3.com',
    invoiceDate: '2024-01-10',
    dueDate: '2024-02-09',
    items: [
      {
        id: 2,
        itemName: '컨설팅 서비스',
        description: 'IT 컨설팅 및 기획',
        quantity: 1,
        unitPrice: 3000000,
        totalPrice: 3000000,
        taxRate: APP_CONSTANTS.DEFAULT_TAX_RATE,
        taxAmount: 300000
      }
    ],
    subtotal: 3000000,
    totalTax: 300000,
    totalAmount: 3300000,
    status: 'sent' as const,
    notes: '프로젝트 컨설팅 비용',
    createdAt: '2024-01-10 10:00:00',
    updatedAt: '2024-01-10 10:00:00',
    createdBy: SAMPLE_DATA.USERS.MARKETING
  },
  {
    id: 3,
    invoiceNumber: 'INV-2024-003',
    customerId: 1003,
    customerName: SAMPLE_DATA.COMPANIES.DEF,
    customerEmail: 'finance@def.com',
    customerPhone: '051-3333-4444',
    customerAddress: '부산시 해운대구 센텀중앙로 101',
    companyName: SAMPLE_DATA.COMPANIES.MVS,
    companyAddress: '서울시 서초구 서초대로 456',
    companyPhone: '02-9876-5432',
    companyEmail: 'info@mvs3.com',
    invoiceDate: '2024-01-15',
    dueDate: '2024-02-14',
    items: [
      {
        id: 3,
        itemName: '라이선스 비용',
        description: '소프트웨어 라이선스',
        quantity: 1,
        unitPrice: 2000000,
        totalPrice: 2000000,
        taxRate: APP_CONSTANTS.DEFAULT_TAX_RATE,
        taxAmount: 200000
      }
    ],
    subtotal: 2000000,
    totalTax: 200000,
    totalAmount: 2200000,
    status: 'overdue' as const,
    notes: '연간 라이선스 비용',
    createdAt: '2024-01-15 09:00:00',
    updatedAt: '2024-01-15 09:00:00',
    createdBy: SAMPLE_DATA.USERS.BACKEND
  }
];

// 급여 샘플 데이터
export const SAMPLE_PAYROLLS = [
  {
    id: 1,
    employeeId: 1001,
    employeeName: SAMPLE_DATA.USERS.DEVELOPER,
    department: SAMPLE_DATA.DEPARTMENTS.DEVELOPMENT,
    position: SAMPLE_DATA.POSITIONS.TEAM_LEAD,
    basicSalary: 5000000,
    overtimePay: 200000,
    bonus: 500000,
    allowances: 300000,
    deductions: 400000,
    grossSalary: 6000000,
    tax: 600000,
    netSalary: 5000000,
    payPeriod: '2024-01',
    status: 'paid' as const,
    paymentDate: '2024-01-25',
    createdAt: '2024-01-20',
    createdBy: SAMPLE_DATA.USERS.HR
  },
  {
    id: 2,
    employeeId: 1002,
    employeeName: SAMPLE_DATA.USERS.FRONTEND,
    department: SAMPLE_DATA.DEPARTMENTS.DEVELOPMENT,
    position: SAMPLE_DATA.POSITIONS.DEVELOPER,
    basicSalary: 4000000,
    overtimePay: 150000,
    bonus: 300000,
    allowances: 200000,
    deductions: 320000,
    grossSalary: 4650000,
    tax: 465000,
    netSalary: 3785000,
    payPeriod: '2024-01',
    status: 'paid' as const,
    paymentDate: '2024-01-25',
    createdAt: '2024-01-20',
    createdBy: SAMPLE_DATA.USERS.HR
  },
  {
    id: 3,
    employeeId: 1003,
    employeeName: SAMPLE_DATA.USERS.BACKEND,
    department: SAMPLE_DATA.DEPARTMENTS.DEVELOPMENT,
    position: SAMPLE_DATA.POSITIONS.DEVELOPER,
    basicSalary: 4200000,
    overtimePay: 180000,
    bonus: 350000,
    allowances: 250000,
    deductions: 336000,
    grossSalary: 4980000,
    tax: 498000,
    netSalary: 4146000,
    payPeriod: '2024-01',
    status: 'approved' as const,
    createdAt: '2024-01-20',
    createdBy: SAMPLE_DATA.USERS.HR
  }
];

// 객실 샘플 데이터
export const SAMPLE_ROOMS = [
  {
    id: 1,
    roomNumber: '101',
    roomType: APP_CONSTANTS.ROOM_TYPES.STANDARD,
    floor: 1,
    capacity: 2,
    amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'],
    status: APP_CONSTANTS.ROOM_STATUS.AVAILABLE,
    description: '스탠다드 객실 - 기본적인 편의시설을 갖춘 깔끔한 객실',
    pricePerNight: 80000,
    imageUrl: '/images/room-101.jpg'
  },
  {
    id: 2,
    roomNumber: '201',
    roomType: APP_CONSTANTS.ROOM_TYPES.DELUXE,
    floor: 2,
    capacity: 3,
    amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Coffee Machine'],
    status: APP_CONSTANTS.ROOM_STATUS.OCCUPIED,
    description: '델럭스 객실 - 넓은 공간과 추가 편의시설을 제공하는 객실',
    pricePerNight: 120000,
    imageUrl: '/images/room-201.jpg'
  },
  {
    id: 3,
    roomNumber: '301',
    roomType: APP_CONSTANTS.ROOM_TYPES.SUITE,
    floor: 3,
    capacity: 4,
    amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Coffee Machine', 'Jacuzzi', 'Living Room'],
    status: APP_CONSTANTS.ROOM_STATUS.RESERVED,
    description: '스위트 객실 - 최고급 편의시설과 넓은 공간을 제공하는 프리미엄 객실',
    pricePerNight: 200000,
    imageUrl: '/images/room-301.jpg'
  },
  {
    id: 4,
    roomNumber: '401',
    roomType: APP_CONSTANTS.ROOM_TYPES.PRESIDENTIAL,
    floor: 4,
    capacity: 6,
    amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar', 'Balcony', 'Coffee Machine', 'Jacuzzi', 'Living Room', 'Kitchen', 'Butler Service'],
    status: APP_CONSTANTS.ROOM_STATUS.MAINTENANCE,
    description: '프레지덴셜 스위트 - 최고급 서비스와 모든 편의시설을 제공하는 VIP 객실',
    pricePerNight: 500000,
    imageUrl: '/images/room-401.jpg'
  }
];

// 재고 샘플 데이터
export const SAMPLE_INVENTORY_ITEMS = [
  {
    id: 1,
    productCode: 'PRD-001',
    productName: '노트북',
    category: SAMPLE_DATA.PRODUCTS.HARDWARE,
    currentStock: 15,
    minStock: 5,
    maxStock: 50,
    unitPrice: 1500000,
    totalValue: 22500000,
    status: APP_CONSTANTS.INVENTORY_STATUS.IN_STOCK,
    location: SAMPLE_DATA.LOCATIONS.SEOUL,
    lastUpdated: '2024-01-15'
  },
  {
    id: 2,
    productCode: 'PRD-002',
    productName: '모니터',
    category: SAMPLE_DATA.PRODUCTS.HARDWARE,
    currentStock: 3,
    minStock: 10,
    maxStock: 30,
    unitPrice: 300000,
    totalValue: 900000,
    status: APP_CONSTANTS.INVENTORY_STATUS.LOW_STOCK,
    location: SAMPLE_DATA.LOCATIONS.SEOUL,
    lastUpdated: '2024-01-14'
  },
  {
    id: 3,
    productCode: 'PRD-003',
    productName: '키보드',
    category: SAMPLE_DATA.PRODUCTS.HARDWARE,
    currentStock: 0,
    minStock: 20,
    maxStock: 100,
    unitPrice: 80000,
    totalValue: 0,
    status: APP_CONSTANTS.INVENTORY_STATUS.OUT_OF_STOCK,
    location: SAMPLE_DATA.LOCATIONS.SEOUL,
    lastUpdated: '2024-01-13'
  },
  {
    id: 4,
    productCode: 'PRD-004',
    productName: '마우스',
    category: SAMPLE_DATA.PRODUCTS.HARDWARE,
    currentStock: 150,
    minStock: 30,
    maxStock: 100,
    unitPrice: 50000,
    totalValue: 7500000,
    status: APP_CONSTANTS.INVENTORY_STATUS.OVERSTOCK,
    location: SAMPLE_DATA.LOCATIONS.SEOUL,
    lastUpdated: '2024-01-12'
  },
  {
    id: 5,
    productCode: 'PRD-005',
    productName: '책상',
    category: SAMPLE_DATA.PRODUCTS.HARDWARE,
    currentStock: 8,
    minStock: 5,
    maxStock: 20,
    unitPrice: 200000,
    totalValue: 1600000,
    status: APP_CONSTANTS.INVENTORY_STATUS.IN_STOCK,
    location: SAMPLE_DATA.LOCATIONS.SEOUL,
    lastUpdated: '2024-01-11'
  }
];
