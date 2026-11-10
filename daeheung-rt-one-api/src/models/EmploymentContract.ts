import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EmploymentContractAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  employee_id: number;
  approver_id?: number | null;
  template_id?: number | null;
  title: string;
  contract_type: string;
  status: string;
  start_date: string;
  end_date: string;
  salary?: number | null;
  bonus_type?: string | null;
  bonus_value?: number | null;
  work_location?: string | null;
  working_days?: string | null;
  working_hours?: string | null;
  probation_months?: number | null;
  pdf_url?: string | null;
  hash_sha256?: string | null;
  company_signed_at?: Date | null;
  employee_signed_at?: Date | null;
  approved_at?: Date | null;
  rejection_reason?: string | null;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: Date;
  updated_at: Date;
}

interface EmploymentContractCreationAttributes
  extends Optional<
    EmploymentContractAttributes,
    | 'id'
    | 'approver_id'
    | 'template_id'
    | 'salary'
    | 'bonus_type'
    | 'bonus_value'
    | 'work_location'
    | 'working_days'
    | 'working_hours'
    | 'probation_months'
    | 'pdf_url'
    | 'hash_sha256'
    | 'company_signed_at'
    | 'employee_signed_at'
    | 'approved_at'
    | 'rejection_reason'
    | 'is_active'
    | 'created_by'
    | 'updated_by'
    | 'created_at'
    | 'updated_at'
  > {}

class EmploymentContract
  extends Model<EmploymentContractAttributes, EmploymentContractCreationAttributes>
  implements EmploymentContractAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public employee_id!: number;
  public approver_id?: number | null;
  public template_id?: number | null;
  public title!: string;
  public contract_type!: string;
  public status!: string;
  public start_date!: string;
  public end_date!: string;
  public salary?: number | null;
  public bonus_type?: string | null;
  public bonus_value?: number | null;
  public work_location?: string | null;
  public working_days?: string | null;
  public working_hours?: string | null;
  public probation_months?: number | null;
  public pdf_url?: string | null;
  public hash_sha256?: string | null;
  public company_signed_at?: Date | null;
  public employee_signed_at?: Date | null;
  public approved_at?: Date | null;
  public rejection_reason?: string | null;
  public is_active!: boolean;
  public created_by?: number | null;
  public updated_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmploymentContract.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    employee_id: { type: DataTypes.INTEGER, allowNull: false },
    approver_id: { type: DataTypes.INTEGER, allowNull: true },
    template_id: { type: DataTypes.INTEGER, allowNull: true },
    title: { type: DataTypes.STRING(200), allowNull: false },
    contract_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'regular' },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft' },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    salary: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    bonus_type: { type: DataTypes.STRING(20), allowNull: true },
    bonus_value: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    work_location: { type: DataTypes.STRING(200), allowNull: true },
    working_days: { type: DataTypes.STRING(120), allowNull: true },
    working_hours: { type: DataTypes.STRING(100), allowNull: true },
    probation_months: { type: DataTypes.INTEGER, allowNull: true },
    pdf_url: { type: DataTypes.TEXT, allowNull: true },
    hash_sha256: { type: DataTypes.STRING(128), allowNull: true },
    company_signed_at: { type: DataTypes.DATE, allowNull: true },
    employee_signed_at: { type: DataTypes.DATE, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    rejection_reason: { type: DataTypes.STRING(500), allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'employment_contracts',
    timestamps: true,
    underscored: true,
  }
);

export default EmploymentContract;
