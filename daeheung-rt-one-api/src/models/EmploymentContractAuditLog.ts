import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EmploymentContractAuditLogAttributes {
  id: number;
  contract_id?: number | null;
  tenant_id: number;
  company_id?: number | null;
  actor_id?: number | null;
  actor_role?: string | null;
  action: string;
  details?: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

interface EmploymentContractAuditLogCreationAttributes
  extends Optional<
    EmploymentContractAuditLogAttributes,
    'id' | 'contract_id' | 'company_id' | 'actor_id' | 'actor_role' | 'details' | 'created_at' | 'updated_at'
  > {}

class EmploymentContractAuditLog
  extends Model<EmploymentContractAuditLogAttributes, EmploymentContractAuditLogCreationAttributes>
  implements EmploymentContractAuditLogAttributes
{
  public id!: number;
  public contract_id?: number | null;
  public tenant_id!: number;
  public company_id?: number | null;
  public actor_id?: number | null;
  public actor_role?: string | null;
  public action!: string;
  public details?: Record<string, any> | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmploymentContractAuditLog.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    contract_id: { type: DataTypes.INTEGER, allowNull: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_role: { type: DataTypes.STRING(30), allowNull: true },
    action: { type: DataTypes.STRING(100), allowNull: false },
    details: { type: DataTypes.JSONB, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: 'employment_contract_audit_logs',
    timestamps: true,
    underscored: true
  }
);

export default EmploymentContractAuditLog;

