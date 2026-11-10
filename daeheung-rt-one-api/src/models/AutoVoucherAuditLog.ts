import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AutoVoucherAuditLogAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  auto_voucher_id: number;
  action: string;
  actor_id?: number;
  before_data?: Record<string, any>;
  after_data?: Record<string, any>;
  metadata?: Record<string, any>;
  created_at?: Date;
  updated_at?: Date;
}

interface AutoVoucherAuditLogCreationAttributes
  extends Optional<
    AutoVoucherAuditLogAttributes,
    'id' | 'actor_id' | 'before_data' | 'after_data' | 'metadata' | 'created_at' | 'updated_at'
  > {}

class AutoVoucherAuditLog
  extends Model<AutoVoucherAuditLogAttributes, AutoVoucherAuditLogCreationAttributes>
  implements AutoVoucherAuditLogAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public auto_voucher_id!: number;
  public action!: string;
  public actor_id?: number;
  public before_data?: Record<string, any>;
  public after_data?: Record<string, any>;
  public metadata?: Record<string, any>;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AutoVoucherAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    auto_voucher_id: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(80), allowNull: false },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    before_data: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    after_data: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    metadata: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
  },
  {
    sequelize,
    tableName: 'auto_voucher_audit_logs',
    underscored: true,
    timestamps: true,
  }
);

export default AutoVoucherAuditLog;
