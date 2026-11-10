import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcTransactionItemAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  code: string;
  name_ko: string;
  name_en?: string | null;
  keywords?: string | null;
  voucher_type_id?: number | null;
  debit_account_id?: number | null;
  credit_account_id?: number | null;
  default_gst_code_id?: number | null;
  default_tds_code_id?: number | null;
  party_required: boolean;
  attachment_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AcTransactionItemCreationAttributes
  extends Optional<
    AcTransactionItemAttributes,
    | 'id'
    | 'name_en'
    | 'keywords'
    | 'voucher_type_id'
    | 'debit_account_id'
    | 'credit_account_id'
    | 'default_gst_code_id'
    | 'default_tds_code_id'
    | 'party_required'
    | 'attachment_required'
    | 'sort_order'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AcTransactionItem
  extends Model<AcTransactionItemAttributes, AcTransactionItemCreationAttributes>
  implements AcTransactionItemAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public code!: string;
  public name_ko!: string;
  public name_en?: string | null;
  public keywords?: string | null;
  public voucher_type_id?: number | null;
  public debit_account_id?: number | null;
  public credit_account_id?: number | null;
  public default_gst_code_id?: number | null;
  public default_tds_code_id?: number | null;
  public party_required!: boolean;
  public attachment_required!: boolean;
  public sort_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AcTransactionItem.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(30), allowNull: false },
    name_ko: { type: DataTypes.STRING(100), allowNull: false },
    name_en: { type: DataTypes.STRING(100), allowNull: true },
    keywords: { type: DataTypes.TEXT, allowNull: true },
    voucher_type_id: { type: DataTypes.INTEGER, allowNull: true },
    debit_account_id: { type: DataTypes.INTEGER, allowNull: true },
    credit_account_id: { type: DataTypes.INTEGER, allowNull: true },
    default_gst_code_id: { type: DataTypes.INTEGER, allowNull: true },
    default_tds_code_id: { type: DataTypes.INTEGER, allowNull: true },
    party_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    attachment_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'ac_transaction_items', underscored: true, timestamps: true }
);

export default AcTransactionItem;
