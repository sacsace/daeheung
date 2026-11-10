import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface GlVoucherAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  voucher_no: string;
  voucher_type: 'journal' | 'payment' | 'receipt' | 'contra' | 'sales' | 'purchase';
  voucher_date: string;
  narration?: string | null;
  status: 'draft' | 'posted' | 'cancelled' | 'review_required' | 'approved' | 'rejected' | 'reversed';
  source_type?: 'manual' | 'auto_voucher' | 'sap_import' | 'tally_import' | 'bank_import' | 'ocr' | 'api' | null;
  source_id?: number | null;
  source_correlation_id?: string | null;
  total_debit: number;
  total_credit: number;
  party_id?: number | null;
  voucher_type_id?: number | null;
  financial_year_id?: number | null;
  posting_date?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  input_mode?: string | null;
  currency_code?: string | null;
  exchange_rate?: number | null;
  amount_details?: object | null;
  posted_by?: number | null;
  posted_at?: Date | null;
  created_by?: number | null;
  updated_by?: number | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface GlVoucherCreationAttributes
  extends Optional<
    GlVoucherAttributes,
    | 'id'
    | 'narration'
    | 'status'
    | 'source_type'
    | 'source_id'
    | 'source_correlation_id'
    | 'total_debit'
    | 'total_credit'
    | 'party_id'
    | 'voucher_type_id'
    | 'financial_year_id'
    | 'posting_date'
    | 'invoice_number'
    | 'invoice_date'
    | 'input_mode'
    | 'currency_code'
    | 'exchange_rate'
    | 'amount_details'
    | 'posted_by'
    | 'posted_at'
    | 'created_by'
    | 'updated_by'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class GlVoucher extends Model<GlVoucherAttributes, GlVoucherCreationAttributes> implements GlVoucherAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public voucher_no!: string;
  public voucher_type!: 'journal' | 'payment' | 'receipt' | 'contra' | 'sales' | 'purchase';
  public voucher_date!: string;
  public narration?: string | null;
  public status!: 'draft' | 'posted' | 'cancelled' | 'review_required' | 'approved' | 'rejected' | 'reversed';
  public source_type?: 'manual' | 'auto_voucher' | 'sap_import' | 'tally_import' | 'bank_import' | 'ocr' | 'api' | null;
  public source_id?: number | null;
  public source_correlation_id?: string | null;
  public total_debit!: number;
  public total_credit!: number;
  public party_id?: number | null;
  public voucher_type_id?: number | null;
  public financial_year_id?: number | null;
  public posting_date?: string | null;
  public invoice_number?: string | null;
  public invoice_date?: string | null;
  public input_mode?: string | null;
  public currency_code?: string | null;
  public exchange_rate?: number | null;
  public amount_details?: object | null;
  public posted_by?: number | null;
  public posted_at?: Date | null;
  public created_by?: number | null;
  public updated_by?: number | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

GlVoucher.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    voucher_no: { type: DataTypes.STRING(50), allowNull: false },
    voucher_type: {
      type: DataTypes.ENUM('journal', 'payment', 'receipt', 'contra', 'sales', 'purchase'),
      allowNull: false,
      defaultValue: 'journal',
    },
    voucher_date: { type: DataTypes.DATEONLY, allowNull: false },
    narration: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'draft',
    },
    source_type: {
      type: DataTypes.ENUM('manual', 'auto_voucher', 'sap_import', 'tally_import', 'bank_import', 'ocr', 'api'),
      allowNull: true,
    },
    source_id: { type: DataTypes.INTEGER, allowNull: true },
    source_correlation_id: { type: DataTypes.STRING(80), allowNull: true },
    total_debit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total_credit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    party_id: { type: DataTypes.INTEGER, allowNull: true },
    voucher_type_id: { type: DataTypes.INTEGER, allowNull: true },
    financial_year_id: { type: DataTypes.INTEGER, allowNull: true },
    posting_date: { type: DataTypes.DATEONLY, allowNull: true },
    invoice_number: { type: DataTypes.STRING(50), allowNull: true },
    invoice_date: { type: DataTypes.DATEONLY, allowNull: true },
    input_mode: { type: DataTypes.STRING(20), allowNull: true, defaultValue: 'simple' },
    currency_code: { type: DataTypes.STRING(10), allowNull: true, defaultValue: 'INR' },
    exchange_rate: { type: DataTypes.DECIMAL(15, 6), allowNull: true, defaultValue: 1 },
    amount_details: { type: DataTypes.JSONB, allowNull: true },
    posted_by: { type: DataTypes.INTEGER, allowNull: true },
    posted_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'gl_vouchers',
    underscored: true,
    timestamps: true,
  }
);

export default GlVoucher;
