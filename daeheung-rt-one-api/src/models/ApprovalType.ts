import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ApprovalTypeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  code: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface ApprovalTypeCreationAttributes
  extends Optional<
    ApprovalTypeAttributes,
    'id' | 'sort_order' | 'is_system' | 'is_active' | 'created_at' | 'updated_at'
  > {}

class ApprovalType
  extends Model<ApprovalTypeAttributes, ApprovalTypeCreationAttributes>
  implements ApprovalTypeAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public code!: string;
  public name!: string;
  public sort_order!: number;
  public is_system!: boolean;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ApprovalType.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'approval_types',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['tenant_id', 'company_id', 'is_active'] },
      { unique: true, fields: ['tenant_id', 'company_id', 'code'] },
    ],
  }
);

export default ApprovalType;

/** 회사별 기본 결재 유형 */
export const DEFAULT_APPROVAL_TYPES: { code: string; name: string; sort_order: number }[] = [
  { code: 'expense', name: '지출신청', sort_order: 0 },
  { code: 'purchase', name: '구매신청', sort_order: 1 },
  { code: 'contract', name: '계약신청', sort_order: 2 },
  { code: 'business_trip', name: '출장신청', sort_order: 3 },
  { code: 'payroll', name: '급여확정', sort_order: 4 },
  { code: 'other', name: '기타', sort_order: 5 },
];

/** 기본에서 제외된 구 코드 (휴가신청 → 기타로 대체) */
export const RETIRED_DEFAULT_APPROVAL_CODES = ['vacation'] as const;
