import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcVoucherAuditLogAttributes {
  id: number;
  voucher_id: number;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  meta?: Record<string, unknown> | null;
  created_by?: number | null;
  created_at?: Date;
}

interface AcVoucherAuditLogCreationAttributes
  extends Optional<AcVoucherAuditLogAttributes, 'id' | 'field_name' | 'old_value' | 'new_value' | 'meta' | 'created_by' | 'created_at'> {}

class AcVoucherAuditLog
  extends Model<AcVoucherAuditLogAttributes, AcVoucherAuditLogCreationAttributes>
  implements AcVoucherAuditLogAttributes
{
  public id!: number;
  public voucher_id!: number;
  public action!: string;
  public field_name?: string | null;
  public old_value?: string | null;
  public new_value?: string | null;
  public meta?: Record<string, unknown> | null;
  public created_by?: number | null;
  public readonly created_at!: Date;
}

AcVoucherAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    voucher_id: { type: DataTypes.INTEGER, allowNull: false },
    action: { type: DataTypes.STRING(50), allowNull: false },
    field_name: { type: DataTypes.STRING(100), allowNull: true },
    old_value: { type: DataTypes.TEXT, allowNull: true },
    new_value: { type: DataTypes.TEXT, allowNull: true },
    meta: { type: DataTypes.JSONB, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  { sequelize, tableName: 'ac_voucher_audit_logs', underscored: true, timestamps: false, updatedAt: false }
);

export default AcVoucherAuditLog;
