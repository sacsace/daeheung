import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PayrollBonusAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  employee_id: number;
  fiscal_year: string;
  installments_per_year: number;
  installment: number;
  months_worked: number;
  monthly_salary: number;
  rate_percent: number;
  amount: number;
  status: 'registered' | 'paid';
  paid_at?: Date | null;
  excluded_at?: Date | null;
  created_by?: number | null;
  created_at: Date;
  updated_at: Date;
}

interface PayrollBonusCreationAttributes
  extends Optional<
    PayrollBonusAttributes,
    'id' | 'status' | 'paid_at' | 'excluded_at' | 'created_by' | 'created_at' | 'updated_at'
  > {}

class PayrollBonus
  extends Model<PayrollBonusAttributes, PayrollBonusCreationAttributes>
  implements PayrollBonusAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public employee_id!: number;
  public fiscal_year!: string;
  public installments_per_year!: number;
  public installment!: number;
  public months_worked!: number;
  public monthly_salary!: number;
  public rate_percent!: number;
  public amount!: number;
  public status!: 'registered' | 'paid';
  public paid_at?: Date | null;
  public excluded_at?: Date | null;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PayrollBonus.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    fiscal_year: { type: DataTypes.STRING(9), allowNull: false },
    installments_per_year: { type: DataTypes.INTEGER, allowNull: false },
    installment: { type: DataTypes.INTEGER, allowNull: false },
    months_worked: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    monthly_salary: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    rate_percent: { type: DataTypes.DECIMAL(6, 2), allowNull: false, defaultValue: 0 },
    amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('registered', 'paid'),
      allowNull: false,
      defaultValue: 'registered',
    },
    paid_at: { type: DataTypes.DATE, allowNull: true },
    excluded_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'payroll_bonuses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default PayrollBonus;
