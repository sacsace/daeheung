import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EWayBillAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  eway_bill_number: string; // E-Way Bill 번호 (자동 생성)
  invoice_id?: number; // 관련 Invoice ID
  invoice_number: string;
  invoice_date: Date;
  supply_type: 'outward' | 'inward'; // 공급 유형
  sub_supply_type?: string; // 세부 공급 유형
  document_type: 'invoice' | 'credit_note' | 'debit_note' | 'bill_of_supply'; // 문서 유형
  document_number: string;
  document_date: Date;
  
  // From (공급자) 정보
  from_gstin: string; // 공급자 GSTIN
  from_name: string;
  from_address: string;
  from_pincode: string;
  from_state: string;
  from_state_code: number;
  
  // To (수령자) 정보
  to_gstin?: string; // 수령자 GSTIN (B2B인 경우)
  to_name: string;
  to_address: string;
  to_pincode: string;
  to_state: string;
  to_state_code: number;
  
  // 운송 정보
  transport_mode: 'road' | 'rail' | 'air' | 'ship'; // 운송 수단
  vehicle_number?: string; // 차량 번호
  vehicle_type?: string; // 차량 유형
  transporter_id?: string; // 운송업체 ID
  transporter_name?: string; // 운송업체명
  transporter_gstin?: string; // 운송업체 GSTIN
  transporter_doc_number?: string; // 운송 문서 번호
  transporter_doc_date?: Date; // 운송 문서 날짜
  distance?: number; // 거리 (km)
  
  // 금액 정보
  total_value: number; // 총 상품 가치
  total_tax_amount: number; // 총 세금
  total_amount: number; // 총 금액
  
  // 상태 및 유효기간
  status: 'draft' | 'generated' | 'active' | 'expired' | 'cancelled' | 'rejected';
  generated_at?: Date; // 생성 일시
  valid_until?: Date; // 유효기간
  cancelled_at?: Date; // 취소 일시
  cancellation_reason?: string; // 취소 사유
  
  // 기타
  generated_by: number; // 생성자 ID
  notes?: string; // 비고
  qr_code?: string; // QR 코드 데이터(GSTN 서명 QR 또는 mock)
  /** 인도 GSTN에서 발급한 E-Way Bill 번호(live 성공 시) */
  gstn_eway_bill_no?: string | null;
  /** GSTN 기준 유효 만료 시각 */
  gstn_valid_upto?: Date | null;
  /** live 발급 실패 시 마지막 오류 메시지 */
  gstn_last_error?: string | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface EWayBillCreationAttributes extends Optional<EWayBillAttributes, 'id' | 'eway_bill_number' | 'sub_supply_type' | 'to_gstin' | 'vehicle_number' | 'vehicle_type' | 'transporter_id' | 'transporter_name' | 'transporter_gstin' | 'transporter_doc_number' | 'transporter_doc_date' | 'distance' | 'generated_at' | 'valid_until' | 'cancelled_at' | 'cancellation_reason' | 'notes' | 'qr_code' | 'gstn_eway_bill_no' | 'gstn_valid_upto' | 'gstn_last_error' | 'is_active' | 'created_at' | 'updated_at'> {}

class EWayBill extends Model<EWayBillAttributes, EWayBillCreationAttributes> implements EWayBillAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public eway_bill_number!: string;
  public invoice_id?: number;
  public invoice_number!: string;
  public invoice_date!: Date;
  public supply_type!: 'outward' | 'inward';
  public sub_supply_type?: string;
  public document_type!: 'invoice' | 'credit_note' | 'debit_note' | 'bill_of_supply';
  public document_number!: string;
  public document_date!: Date;
  
  public from_gstin!: string;
  public from_name!: string;
  public from_address!: string;
  public from_pincode!: string;
  public from_state!: string;
  public from_state_code!: number;
  
  public to_gstin?: string;
  public to_name!: string;
  public to_address!: string;
  public to_pincode!: string;
  public to_state!: string;
  public to_state_code!: number;
  
  public transport_mode!: 'road' | 'rail' | 'air' | 'ship';
  public vehicle_number?: string;
  public vehicle_type?: string;
  public transporter_id?: string;
  public transporter_name?: string;
  public transporter_gstin?: string;
  public transporter_doc_number?: string;
  public transporter_doc_date?: Date;
  public distance?: number;
  
  public total_value!: number;
  public total_tax_amount!: number;
  public total_amount!: number;
  
  public status!: 'draft' | 'generated' | 'active' | 'expired' | 'cancelled' | 'rejected';
  public generated_at?: Date;
  public valid_until?: Date;
  public cancelled_at?: Date;
  public cancellation_reason?: string;
  
  public generated_by!: number;
  public notes?: string;
  public qr_code?: string;
  public gstn_eway_bill_no?: string | null;
  public gstn_valid_upto?: Date | null;
  public gstn_last_error?: string | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EWayBill.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    eway_bill_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    invoice_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    invoice_number: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    invoice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    supply_type: {
      type: DataTypes.ENUM('outward', 'inward'),
      allowNull: false
    },
    sub_supply_type: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    document_type: {
      type: DataTypes.ENUM('invoice', 'credit_note', 'debit_note', 'bill_of_supply'),
      allowNull: false,
      defaultValue: 'invoice'
    },
    document_number: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    document_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    from_gstin: {
      type: DataTypes.STRING(15),
      allowNull: false
    },
    from_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    from_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    from_pincode: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    from_state: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    from_state_code: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    to_gstin: {
      type: DataTypes.STRING(15),
      allowNull: true
    },
    to_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    to_address: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    to_pincode: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    to_state: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    to_state_code: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    transport_mode: {
      type: DataTypes.ENUM('road', 'rail', 'air', 'ship'),
      allowNull: false,
      defaultValue: 'road'
    },
    vehicle_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    vehicle_type: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    transporter_id: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    transporter_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    transporter_gstin: {
      type: DataTypes.STRING(15),
      allowNull: true
    },
    transporter_doc_number: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    transporter_doc_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    distance: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    total_value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('draft', 'generated', 'active', 'expired', 'cancelled', 'rejected'),
      allowNull: false,
      defaultValue: 'draft'
    },
    generated_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancellation_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    generated_by: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    qr_code: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    gstn_eway_bill_no: {
      type: DataTypes.STRING(32),
      allowNull: true
    },
    gstn_valid_upto: {
      type: DataTypes.DATE,
      allowNull: true
    },
    gstn_last_error: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: 'eway_bills',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['eway_bill_number'],
        unique: true
      },
      {
        fields: ['invoice_id']
      },
      {
        fields: ['invoice_number']
      },
      {
        fields: ['status']
      },
      {
        fields: ['generated_at']
      }
    ]
  }
);

export default EWayBill;



