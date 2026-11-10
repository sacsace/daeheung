import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type AutoVoucherStatus =
  | 'uploaded'
  | 'ocr_completed'
  | 'ai_classified'
  | 'draft'
  | 'review_required'
  | 'approved'
  | 'posted'
  | 'rejected'
  | 'cancelled';

interface AutoVoucherAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  voucher_code: string;
  source_doc_type: string;
  source_file_name: string;
  source_file_path?: string;
  source_file_mime?: string;
  ocr_data?: Record<string, any>;
  ai_analysis?: Record<string, any>;
  duplicate_check?: Record<string, any>;
  suggested_lines?: any[];
  final_lines?: any[];
  transaction_date?: string;
  invoice_number?: string;
  counterparty_name?: string;
  narration?: string;
  currency: string;
  total_debit: number;
  total_credit: number;
  confidence_score: number;
  status: AutoVoucherStatus;
  review_notes?: string;
  approved_by?: number;
  approved_at?: Date;
  posted_by?: number;
  posted_at?: Date;
  rejected_by?: number;
  rejected_at?: Date;
  rejection_reason?: string;
  created_by?: number;
  updated_by?: number;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AutoVoucherCreationAttributes
  extends Optional<
    AutoVoucherAttributes,
    | 'id'
    | 'source_file_path'
    | 'source_file_mime'
    | 'ocr_data'
    | 'ai_analysis'
    | 'duplicate_check'
    | 'suggested_lines'
    | 'final_lines'
    | 'transaction_date'
    | 'invoice_number'
    | 'counterparty_name'
    | 'narration'
    | 'review_notes'
    | 'approved_by'
    | 'approved_at'
    | 'posted_by'
    | 'posted_at'
    | 'rejected_by'
    | 'rejected_at'
    | 'rejection_reason'
    | 'created_by'
    | 'updated_by'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AutoVoucher extends Model<AutoVoucherAttributes, AutoVoucherCreationAttributes> implements AutoVoucherAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public voucher_code!: string;
  public source_doc_type!: string;
  public source_file_name!: string;
  public source_file_path?: string;
  public source_file_mime?: string;
  public ocr_data?: Record<string, any>;
  public ai_analysis?: Record<string, any>;
  public duplicate_check?: Record<string, any>;
  public suggested_lines?: any[];
  public final_lines?: any[];
  public transaction_date?: string;
  public invoice_number?: string;
  public counterparty_name?: string;
  public narration?: string;
  public currency!: string;
  public total_debit!: number;
  public total_credit!: number;
  public confidence_score!: number;
  public status!: AutoVoucherStatus;
  public review_notes?: string;
  public approved_by?: number;
  public approved_at?: Date;
  public posted_by?: number;
  public posted_at?: Date;
  public rejected_by?: number;
  public rejected_at?: Date;
  public rejection_reason?: string;
  public created_by?: number;
  public updated_by?: number;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AutoVoucher.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    voucher_code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    source_doc_type: { type: DataTypes.STRING(60), allowNull: false },
    source_file_name: { type: DataTypes.STRING(255), allowNull: false },
    source_file_path: { type: DataTypes.STRING(500), allowNull: true },
    source_file_mime: { type: DataTypes.STRING(120), allowNull: true },
    ocr_data: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    ai_analysis: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    duplicate_check: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    suggested_lines: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    final_lines: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    transaction_date: { type: DataTypes.DATEONLY, allowNull: true },
    invoice_number: { type: DataTypes.STRING(120), allowNull: true },
    counterparty_name: { type: DataTypes.STRING(255), allowNull: true },
    narration: { type: DataTypes.TEXT, allowNull: true },
    currency: { type: DataTypes.STRING(12), allowNull: false, defaultValue: 'INR' },
    total_debit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total_credit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    confidence_score: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM(
        'uploaded',
        'ocr_completed',
        'ai_classified',
        'draft',
        'review_required',
        'approved',
        'posted',
        'rejected',
        'cancelled'
      ),
      allowNull: false,
      defaultValue: 'uploaded',
    },
    review_notes: { type: DataTypes.TEXT, allowNull: true },
    approved_by: { type: DataTypes.INTEGER, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    posted_by: { type: DataTypes.INTEGER, allowNull: true },
    posted_at: { type: DataTypes.DATE, allowNull: true },
    rejected_by: { type: DataTypes.INTEGER, allowNull: true },
    rejected_at: { type: DataTypes.DATE, allowNull: true },
    rejection_reason: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'auto_vouchers',
    underscored: true,
    timestamps: true,
  }
);

export default AutoVoucher;
