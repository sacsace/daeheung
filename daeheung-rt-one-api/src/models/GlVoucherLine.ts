import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface GlVoucherLineAttributes {
  id: number;
  voucher_id: number;
  account_id: number;
  line_no: number;
  account_name: string;
  debit: number;
  credit: number;
  narration?: string | null;
  party_id?: number | null;
  gst_code_id?: number | null;
  tds_code_id?: number | null;
  transaction_item_id?: number | null;
  taxable_amount?: number;
  tax_amount?: number;
  line_category?: string | null;
  created_at?: Date;
  updated_at?: Date;
}

interface GlVoucherLineCreationAttributes
  extends Optional<
    GlVoucherLineAttributes,
    | 'id'
    | 'narration'
    | 'party_id'
    | 'gst_code_id'
    | 'tds_code_id'
    | 'transaction_item_id'
    | 'taxable_amount'
    | 'tax_amount'
    | 'line_category'
    | 'created_at'
    | 'updated_at'
  > {}

class GlVoucherLine
  extends Model<GlVoucherLineAttributes, GlVoucherLineCreationAttributes>
  implements GlVoucherLineAttributes
{
  public id!: number;
  public voucher_id!: number;
  public account_id!: number;
  public line_no!: number;
  public account_name!: string;
  public debit!: number;
  public credit!: number;
  public narration?: string | null;
  public party_id?: number | null;
  public gst_code_id?: number | null;
  public tds_code_id?: number | null;
  public transaction_item_id?: number | null;
  public taxable_amount?: number;
  public tax_amount?: number;
  public line_category?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

GlVoucherLine.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    voucher_id: { type: DataTypes.INTEGER, allowNull: false },
    account_id: { type: DataTypes.INTEGER, allowNull: false },
    line_no: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    account_name: { type: DataTypes.STRING(255), allowNull: false },
    debit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    credit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    narration: { type: DataTypes.TEXT, allowNull: true },
    party_id: { type: DataTypes.INTEGER, allowNull: true },
    gst_code_id: { type: DataTypes.INTEGER, allowNull: true },
    tds_code_id: { type: DataTypes.INTEGER, allowNull: true },
    transaction_item_id: { type: DataTypes.INTEGER, allowNull: true },
    taxable_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    tax_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    line_category: { type: DataTypes.STRING(30), allowNull: true },
  },
  {
    sequelize,
    tableName: 'gl_voucher_lines',
    underscored: true,
    timestamps: true,
  }
);

export default GlVoucherLine;
