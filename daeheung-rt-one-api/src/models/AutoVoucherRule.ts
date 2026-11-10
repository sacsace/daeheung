import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AutoVoucherRuleAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  keyword: string;
  doc_type?: string;
  transaction_type: string;
  debit_account: string;
  credit_account: string;
  tax_account?: string;
  confidence_boost: number;
  reason_template?: string;
  priority: number;
  is_active: boolean;
  created_by?: number;
  updated_by?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface AutoVoucherRuleCreationAttributes
  extends Optional<
    AutoVoucherRuleAttributes,
    | 'id'
    | 'doc_type'
    | 'tax_account'
    | 'reason_template'
    | 'confidence_boost'
    | 'priority'
    | 'is_active'
    | 'created_by'
    | 'updated_by'
    | 'created_at'
    | 'updated_at'
  > {}

class AutoVoucherRule
  extends Model<AutoVoucherRuleAttributes, AutoVoucherRuleCreationAttributes>
  implements AutoVoucherRuleAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public keyword!: string;
  public doc_type?: string;
  public transaction_type!: string;
  public debit_account!: string;
  public credit_account!: string;
  public tax_account?: string;
  public confidence_boost!: number;
  public reason_template?: string;
  public priority!: number;
  public is_active!: boolean;
  public created_by?: number;
  public updated_by?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AutoVoucherRule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    keyword: { type: DataTypes.STRING(120), allowNull: false },
    doc_type: { type: DataTypes.STRING(60), allowNull: true },
    transaction_type: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'expense' },
    debit_account: { type: DataTypes.STRING(120), allowNull: false },
    credit_account: { type: DataTypes.STRING(120), allowNull: false },
    tax_account: { type: DataTypes.STRING(120), allowNull: true },
    confidence_boost: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 10 },
    reason_template: { type: DataTypes.STRING(255), allowNull: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 100 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'auto_voucher_rules',
    underscored: true,
    timestamps: true,
  }
);

export default AutoVoucherRule;
