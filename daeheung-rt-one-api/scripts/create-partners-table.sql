-- 파트너 테이블 생성
CREATE TABLE IF NOT EXISTS partners (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  company_name VARCHAR(200) NOT NULL,
  business_number VARCHAR(50) NOT NULL,
  pan_number VARCHAR(50),
  representative VARCHAR(100),
  business_type VARCHAR(20) NOT NULL DEFAULT 'partner',
  industry VARCHAR(100),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255) NOT NULL,
  website VARCHAR(255),
  bank_name VARCHAR(100),
  account_number VARCHAR(50),
  contract_start_date DATE,
  contract_end_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 파트너 GST 번호 테이블 생성
CREATE TABLE IF NOT EXISTS partner_gst_numbers (
  id SERIAL PRIMARY KEY,
  partner_id INTEGER NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  gst_number VARCHAR(50) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_partner_gst_numbers_partner_id ON partner_gst_numbers(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_gst_numbers_gst_number ON partner_gst_numbers(gst_number);
CREATE INDEX IF NOT EXISTS idx_partners_tenant_id ON partners(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partners_company_id ON partners(company_id);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);

-- 기존 partners 테이블에 pan_number 컬럼이 없으면 추가
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'partners' 
    AND column_name = 'pan_number'
  ) THEN
    ALTER TABLE partners ADD COLUMN pan_number VARCHAR(50);
    RAISE NOTICE 'pan_number 컬럼이 추가되었습니다.';
  ELSE
    RAISE NOTICE 'pan_number 컬럼이 이미 존재합니다.';
  END IF;
END $$;




















