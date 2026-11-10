import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AccountingBrainAuditLogAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  financial_year_id?: number | null;
  user_id?: number | null;
  request_id: string;
  action: string;
  source?: string | null;
  prompt?: string | null;
  retrieved_context: Record<string, unknown>;
  applied_rules: unknown[];
  recommendation: Record<string, unknown>;
  confidence_score?: number | null;
  validation_result: Record<string, unknown>;
  user_changes: Record<string, unknown>;
  approval: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at?: Date;
  updated_at?: Date;
}

interface AccountingBrainAuditLogCreationAttributes
  extends Optional<
    AccountingBrainAuditLogAttributes,
    | 'id'
    | 'financial_year_id'
    | 'user_id'
    | 'source'
    | 'prompt'
    | 'retrieved_context'
    | 'applied_rules'
    | 'recommendation'
    | 'validation_result'
    | 'user_changes'
    | 'approval'
    | 'metadata'
    | 'confidence_score'
    | 'created_at'
    | 'updated_at'
  > {}

class AccountingBrainAuditLog
  extends Model<AccountingBrainAuditLogAttributes, AccountingBrainAuditLogCreationAttributes>
  implements AccountingBrainAuditLogAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public financial_year_id?: number | null;
  public user_id?: number | null;
  public request_id!: string;
  public action!: string;
  public source?: string | null;
  public prompt?: string | null;
  public retrieved_context!: Record<string, unknown>;
  public applied_rules!: unknown[];
  public recommendation!: Record<string, unknown>;
  public confidence_score?: number | null;
  public validation_result!: Record<string, unknown>;
  public user_changes!: Record<string, unknown>;
  public approval!: Record<string, unknown>;
  public metadata!: Record<string, unknown>;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AccountingBrainAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    financial_year_id: { type: DataTypes.INTEGER, allowNull: true },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    request_id: { type: DataTypes.STRING(64), allowNull: false },
    action: { type: DataTypes.STRING(40), allowNull: false },
    source: { type: DataTypes.STRING(40), allowNull: true },
    prompt: { type: DataTypes.TEXT, allowNull: true },
    retrieved_context: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    applied_rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    recommendation: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    confidence_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    validation_result: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    user_changes: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    approval: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  {
    sequelize,
    tableName: 'accounting_brain_audit_logs',
    underscored: true,
    timestamps: true,
  }
);

export default AccountingBrainAuditLog;
