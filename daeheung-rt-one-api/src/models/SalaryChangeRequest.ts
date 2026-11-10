import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type SalaryChangeStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

interface SalaryChangeRequestAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id: number;
  previous_salary?: number | null;
  requested_salary?: number | null;
  status: SalaryChangeStatus;
  requested_by: number;
  approver_id?: number | null;
  decided_by?: number | null;
  decided_at?: Date | null;
  rejection_reason?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface SalaryChangeRequestCreationAttributes
  extends Optional<
    SalaryChangeRequestAttributes,
    | 'id'
    | 'previous_salary'
    | 'requested_salary'
    | 'status'
    | 'approver_id'
    | 'decided_by'
    | 'decided_at'
    | 'rejection_reason'
    | 'created_at'
    | 'updated_at'
  > {}

class SalaryChangeRequest
  extends Model<SalaryChangeRequestAttributes, SalaryChangeRequestCreationAttributes>
  implements SalaryChangeRequestAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id!: number;
  public previous_salary?: number | null;
  public requested_salary?: number | null;
  public status!: SalaryChangeStatus;
  public requested_by!: number;
  public approver_id?: number | null;
  public decided_by?: number | null;
  public decided_at?: Date | null;
  public rejection_reason?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

SalaryChangeRequest.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    previous_salary: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    requested_salary: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    requested_by: { type: DataTypes.INTEGER, allowNull: false },
    approver_id: { type: DataTypes.INTEGER, allowNull: true },
    decided_by: { type: DataTypes.INTEGER, allowNull: true },
    decided_at: { type: DataTypes.DATE, allowNull: true },
    rejection_reason: { type: DataTypes.STRING(500), allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'salary_change_requests',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default SalaryChangeRequest;
