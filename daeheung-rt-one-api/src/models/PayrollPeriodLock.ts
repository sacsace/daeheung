import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PayrollPeriodLockAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  payroll_period: string;
  locked_at: Date;
  locked_by?: number | null;
  created_at: Date;
  updated_at: Date;
}

interface PayrollPeriodLockCreationAttributes
  extends Optional<PayrollPeriodLockAttributes, 'id' | 'locked_by' | 'created_at' | 'updated_at'> {}

class PayrollPeriodLock
  extends Model<PayrollPeriodLockAttributes, PayrollPeriodLockCreationAttributes>
  implements PayrollPeriodLockAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public payroll_period!: string;
  public locked_at!: Date;
  public locked_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PayrollPeriodLock.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    payroll_period: { type: DataTypes.STRING(20), allowNull: false },
    locked_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    locked_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: 'payroll_period_locks',
    timestamps: true,
    underscored: true
  }
);

export default PayrollPeriodLock;
