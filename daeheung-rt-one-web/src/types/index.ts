// MVS 타입 정의

// 사용자 관련 타입
export interface User {
  id: number;
  tenant_id: number;
  company_id: number;
  userid: string;
  username: string;
  email: string;
  role: 'root' | 'audit' | 'admin' | 'user';
  department: string;
  position: string;
  status: 'active' | 'inactive';
  mfa_enabled: boolean;
  preferences: any;
  // 개인 상세 정보
  first_name: string;
  last_name: string;
  middle_name?: string;
  date_of_birth?: string;
  gender: 'Male' | 'Female' | 'Other';
  nationality?: string;
  marital_status: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  emergency_contact_relationship?: string;
  personal_email?: string;
  personal_phone?: string;
  personal_address?: string;
  profile_picture?: string;
  bio?: string;
  skills?: string[];
  languages?: string[];
  social_media?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    github?: string;
  };
  // 은행 정보
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  created_at: string;
  updated_at: string;
}

// 테넌트 타입
export interface Tenant {
  id: number;
  tenant_code: string;
  name: string;
  domain?: string;
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'suspended' | 'deleted';
  settings: any;
  created_at: string;
  updated_at: string;
}

// 회사 타입
export interface Company {
  id: number;
  tenant_id: number;
  name: string;
  business_number: string;
  ceo_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  employee_count: number;
  subscription_plan: string;
  subscription_status: string;
  company_logo?: string; // Base64 인코딩된 이미지 데이터
  company_seal?: string; // Base64 인코딩된 이미지 데이터
  ceo_signature?: string; // Base64 인코딩된 이미지 데이터
  account_holder_name?: string;
  bank_name?: string;
  account_number?: string;
  ifsc_code?: string;
  login_period_start?: string;
  login_period_end?: string;
  login_time_start: string;
  login_time_end: string;
  timezone: string;
  settings: any;
  created_at: string;
  updated_at: string;
}

// 메뉴 타입
export interface Menu {
  id: number;
  tenant_id: number;
  parent_id?: number;
  name: string;
  name_en: string;
  description?: string;
  icon?: string;
  path?: string;
  component?: string;
  order: number;
  level: number;
  is_active: boolean;
  is_visible: boolean;
  permissions: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  children?: Menu[];
  created_at: string;
  updated_at: string;
}

// 사용자 메뉴 권한 타입
export interface UserMenuPermission {
  id: number;
  user_id: number;
  menu_id: number;
  read: boolean;
  create: boolean;
  update: boolean;
  delete: boolean;
  created_at: string;
  updated_at: string;
}

// 알림 타입
export interface Notification {
  id: number;
  tenant_id: number;
  user_id: number;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  data?: any;
  created_at: string;
  updated_at: string;
}

// 채팅방 타입
export interface ChatRoom {
  id: number;
  tenant_id: number;
  name: string;
  description?: string;
  type: 'direct' | 'group' | 'channel';
  created_by: number;
  is_active: boolean;
  settings: any;
  created_at: string;
  updated_at: string;
}

// 채팅 메시지 타입
export interface ChatMessage {
  id: number;
  tenant_id: number;
  room_id: number;
  user_id: number;
  message: string;
  message_type: 'text' | 'image' | 'file' | 'system';
  is_edited: boolean;
  is_deleted: boolean;
  reply_to?: number;
  created_at: string;
  updated_at: string;
}

// API 응답 타입
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}

// 로그인 요청 타입
export interface LoginRequest {
  userid: string;
  password: string;
  remember?: boolean;
}

// 로그인 응답 타입
export interface LoginResponse {
  user: User;
  token: string;
  refresh_token: string;
  expires_in: number;
}

// 사용자 폼 데이터 타입
export interface UserFormData {
  userid: string;
  username: string;
  email: string;
  password: string;
  role: 'root' | 'audit' | 'admin' | 'user';
  department: string;
  position: string;
  status: 'active' | 'inactive';
  mfa_enabled: boolean;
  preferences: any;
  // 개인 상세 정보
  first_name: string;
  last_name: string;
  middle_name: string;
  date_of_birth: string;
  gender: 'Male' | 'Female' | 'Other';
  nationality: string;
  marital_status: 'Single' | 'Married' | 'Divorced' | 'Widowed';
  blood_type: 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  personal_email: string;
  personal_phone: string;
  personal_address: string;
  profile_picture: string;
  bio: string;
  skills: string[];
  languages: string[];
  social_media: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
    instagram?: string;
    github?: string;
  };
  // 은행 정보
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
}

// 테마 타입
export interface Theme {
  mode: 'light' | 'dark';
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  text: string;
}

// 언어 타입
export type Language = 'ko' | 'en';

// 사이드바 상태 타입
export interface SidebarState {
  isOpen: boolean;
  isCollapsed: boolean;
}

// 글로벌 상태 타입
export interface GlobalState {
  user: User | null;
  tenant: Tenant | null;
  company: Company | null;
  theme: Theme;
  language: Language;
  sidebar: SidebarState;
  notifications: Notification[];
  isAuthenticated: boolean;
  isLoading: boolean;
}
