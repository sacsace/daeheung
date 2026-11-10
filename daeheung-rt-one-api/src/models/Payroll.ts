import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PayrollAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  employee_id: number;
  payroll_period: string;
  basic_salary: number;
  overtime_pay: number;
  bonus: number;
  allowances: number;
  deductions: number;
  gross_salary: number;
  net_salary: number;
  tax_amount: number;
  status: string;
  payment_date?: string;
  created_by: number;
  is_active?: boolean;
  extra_fields?: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

interface PayrollCreationAttributes extends Optional<PayrollAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Payroll extends Model<PayrollAttributes, PayrollCreationAttributes> implements PayrollAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public employee_id!: number;
  public payroll_period!: string;
  public basic_salary!: number;
  public overtime_pay!: number;
  public bonus!: number;
  public allowances!: number;
  public deductions!: number;
  public gross_salary!: number;
  public net_salary!: number;
  public tax_amount!: number;
  public status!: string;
  public payment_date?: string;
  public created_by!: number;
  public is_active!: boolean;
  public extra_fields?: Record<string, unknown> | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Payroll.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    employee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    payroll_period: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    basic_salary: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    overtime_pay: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    bonus: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    allowances: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    deductions: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    gross_salary: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    net_salary: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    extra_fields: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'payrolls',
    timestamps: true,
    underscored: true,
  }
);

export default Payroll;
