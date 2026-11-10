import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ExpenseReportAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  expense_id: string;
  title: string;
  requester_id: number;
  requester_name: string;
  requester_department?: string;
  requester_position?: string;
  total_amount: number;
  currency: string;
  purpose: string;
  items?: any;
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'paid';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  current_approver_id?: number;
  approval_flow?: any;
  submitted_at?: Date;
  due_date?: Date;
  notes?: string;
  attachments?: any;
  comments?: any;
  comment_reads?: any;
  approval_id?: number;
  payment_request_status?: string;
  payment_requested_at?: Date;
  payment_requested_by?: number;
  payment_completed_at?: Date;
  payment_completed_by?: number;
  paid_amount?: number;
  payment_approved_reason?: string;
  payment_approved_at?: Date;
  payment_approved_by?: number;
  payment_rejected_reason?: string;
  payment_rejected_at?: Date;
  payment_rejected_by?: number;
  bank_transfer_provider?: string;
  bank_transfer_status?: string;
  bank_transfer_reference?: string;
  bank_transfer_error?: string;
  bank_transfer_payload?: any;
  bank_transfer_logs?: any;
  cc_user_ids?: number[] | null;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface ExpenseReportCreationAttributes extends Optional<
  ExpenseReportAttributes,
  | 'id'
  | 'requester_department'
  | 'requester_position'
  | 'items'
  | 'current_approver_id'
  | 'approval_flow'
  | 'submitted_at'
  | 'due_date'
  | 'notes'
  | 'attachments'
  | 'comments'
  | 'comment_reads'
  | 'cc_user_ids'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
> {}

class ExpenseReport extends Model<ExpenseReportAttributes, ExpenseReportCreationAttributes> implements ExpenseReportAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public expense_id!: string;
  public title!: string;
  public requester_id!: number;
  public requester_name!: string;
  public requester_department?: string;
  public requester_position?: string;
  public total_amount!: number;
  public currency!: string;
  public purpose!: string;
  public items?: any;
  public status!: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'paid';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public current_approver_id?: number;
  public approval_flow?: any;
  public submitted_at?: Date;
  public due_date?: Date;
  public notes?: string;
  public attachments?: any;
  public comments?: any;
  public comment_reads?: any;
  public approval_id?: number;
  public payment_request_status?: string;
  public payment_requested_at?: Date;
  public payment_requested_by?: number;
  public payment_completed_at?: Date;
  public payment_completed_by?: number;
  public paid_amount?: number;
  public payment_approved_reason?: string;
  public payment_approved_at?: Date;
  public payment_approved_by?: number;
  public payment_rejected_reason?: string;
  public payment_rejected_at?: Date;
  public payment_rejected_by?: number;
  public bank_transfer_provider?: string;
  public bank_transfer_status?: string;
  public bank_transfer_reference?: string;
  public bank_transfer_error?: string;
  public bank_transfer_payload?: any;
  public bank_transfer_logs?: any;
  public cc_user_ids?: number[] | null;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ExpenseReport.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    expense_id: { type: DataTypes.STRING(100), allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    requester_id: { type: DataTypes.INTEGER, allowNull: false },
    requester_name: { type: DataTypes.STRING(100), allowNull: false },
    requester_department: { type: DataTypes.STRING(100), allowNull: true },
    requester_position: { type: DataTypes.STRING(100), allowNull: true },
    total_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'INR' },
    purpose: { type: DataTypes.TEXT, allowNull: false },
    items: { type: DataTypes.JSONB, allowNull: true, defaultValue: '[]' },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'paid'),
      allowNull: false,
      defaultValue: 'draft'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    current_approver_id: { type: DataTypes.INTEGER, allowNull: true },
    approval_flow: { type: DataTypes.JSONB, allowNull: true, defaultValue: '[]' },
    submitted_at: { type: DataTypes.DATE, allowNull: true },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSONB, allowNull: true, defaultValue: '[]' },
    comments: { type: DataTypes.JSONB, allowNull: true, defaultValue: '[]' },
    comment_reads: { type: DataTypes.JSONB, allowNull: true, defaultValue: '{}' },
    approval_id: { type: DataTypes.INTEGER, allowNull: true },
    payment_request_status: { type: DataTypes.STRING(30), allowNull: true, defaultValue: 'not_requested' },
    payment_requested_at: { type: DataTypes.DATE, allowNull: true },
    payment_requested_by: { type: DataTypes.INTEGER, allowNull: true },
    payment_completed_at: { type: DataTypes.DATE, allowNull: true },
    payment_completed_by: { type: DataTypes.INTEGER, allowNull: true },
    paid_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    payment_approved_reason: { type: DataTypes.TEXT, allowNull: true },
    payment_approved_at: { type: DataTypes.DATE, allowNull: true },
    payment_approved_by: { type: DataTypes.INTEGER, allowNull: true },
    payment_rejected_reason: { type: DataTypes.TEXT, allowNull: true },
    payment_rejected_at: { type: DataTypes.DATE, allowNull: true },
    payment_rejected_by: { type: DataTypes.INTEGER, allowNull: true },
    bank_transfer_provider: { type: DataTypes.STRING(20), allowNull: true },
    bank_transfer_status: { type: DataTypes.STRING(30), allowNull: true },
    bank_transfer_reference: { type: DataTypes.STRING(100), allowNull: true },
    bank_transfer_error: { type: DataTypes.TEXT, allowNull: true },
    bank_transfer_payload: { type: DataTypes.JSONB, allowNull: true },
    bank_transfer_logs: { type: DataTypes.JSONB, allowNull: true, defaultValue: '[]' },
    cc_user_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  {
    sequelize,
    tableName: 'expense_reports',
    indexes: [
      { fields: ['tenant_id', 'company_id'] },
      {
        unique: true,
        fields: ['tenant_id', 'company_id', 'expense_id'],
        name: 'expense_reports_tenant_company_expense_id_uk',
      },
      { fields: ['status'] }
    ]
  }
);

export default ExpenseReport;
