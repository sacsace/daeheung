import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ContractTypeAttributes {
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

interface ContractTypeCreationAttributes
  extends Optional<
    ContractTypeAttributes,
    'id' | 'sort_order' | 'is_system' | 'is_active' | 'created_at' | 'updated_at'
  > {}

class ContractType
  extends Model<ContractTypeAttributes, ContractTypeCreationAttributes>
  implements ContractTypeAttributes
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

ContractType.init(
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
    tableName: 'contract_types',
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

export default ContractType;

/** 회사별 기본 계약 구분 */
export const DEFAULT_CONTRACT_TYPES: { code: string; name: string; sort_order: number }[] = [
  { code: 'sales', name: '매출 계약', sort_order: 0 },
  { code: 'purchase_lease', name: '매입(구매/임대)', sort_order: 1 },
];
