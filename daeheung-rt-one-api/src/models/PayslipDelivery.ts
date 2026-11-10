import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PayslipDeliveryAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id: number | null;
  payroll_period: string;
  employee_name?: string | null;
  recipient_email: string;
  emp_id?: string | null;
  net_salary?: number | null;
  pdf_path: string;
  pdf_url: string;
  sent_by?: number | null;
  sent_at: Date;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

type PayslipDeliveryCreation = Optional<
  PayslipDeliveryAttributes,
  | 'id'
  | 'user_id'
  | 'employee_name'
  | 'emp_id'
  | 'net_salary'
  | 'sent_by'
  | 'sent_at'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
>;

class PayslipDelivery
  extends Model<PayslipDeliveryAttributes, PayslipDeliveryCreation>
  implements PayslipDeliveryAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id!: number | null;
  public payroll_period!: string;
  public employee_name?: string | null;
  public recipient_email!: string;
  public emp_id?: string | null;
  public net_salary?: number | null;
  public pdf_path!: string;
  public pdf_url!: string;
  public sent_by?: number | null;
  public sent_at!: Date;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PayslipDelivery.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    payroll_period: { type: DataTypes.STRING(30), allowNull: false, defaultValue: '' },
    employee_name: { type: DataTypes.STRING(120), allowNull: true },
    recipient_email: { type: DataTypes.STRING(254), allowNull: false },
    emp_id: { type: DataTypes.STRING(50), allowNull: true },
    net_salary: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    pdf_path: { type: DataTypes.STRING(500), allowNull: false },
    pdf_url: { type: DataTypes.STRING(500), allowNull: false },
    sent_by: { type: DataTypes.INTEGER, allowNull: true },
    sent_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'payslip_deliveries',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default PayslipDelivery;
