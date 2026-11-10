import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface GlAccountAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  parent_id?: number | null;
  code: string;
  name: string;
  name_en?: string | null;
  account_type: 'group' | 'ledger';
  nature: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
  opening_balance: number;
  current_balance: number;
  is_system: boolean;
  is_active: boolean;
  search_aliases?: string | null;
  account_group?: string | null;
  is_cash_or_bank?: boolean;
  is_ar_ap?: boolean;
  party_required?: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

interface GlAccountCreationAttributes
  extends Optional<
    GlAccountAttributes,
    | 'id'
    | 'parent_id'
    | 'name_en'
    | 'opening_balance'
    | 'current_balance'
    | 'is_system'
    | 'is_active'
    | 'search_aliases'
    | 'account_group'
    | 'is_cash_or_bank'
    | 'is_ar_ap'
    | 'party_required'
    | 'created_by'
    | 'updated_by'
    | 'created_at'
    | 'updated_at'
  > {}

class GlAccount extends Model<GlAccountAttributes, GlAccountCreationAttributes> implements GlAccountAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public parent_id?: number | null;
  public code!: string;
  public name!: string;
  public name_en?: string | null;
  public account_type!: 'group' | 'ledger';
  public nature!: 'asset' | 'liability' | 'income' | 'expense' | 'equity';
  public opening_balance!: number;
  public current_balance!: number;
  public is_system!: boolean;
  public is_active!: boolean;
  public search_aliases?: string | null;
  public account_group?: string | null;
  public is_cash_or_bank?: boolean;
  public is_ar_ap?: boolean;
  public party_required?: boolean;
  public created_by?: number | null;
  public updated_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

GlAccount.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    parent_id: { type: DataTypes.INTEGER, allowNull: true },
    code: { type: DataTypes.STRING(30), allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    name_en: { type: DataTypes.STRING(255), allowNull: true },
    account_type: { type: DataTypes.ENUM('group', 'ledger'), allowNull: false, defaultValue: 'ledger' },
    nature: {
      type: DataTypes.ENUM('asset', 'liability', 'income', 'expense', 'equity'),
      allowNull: false,
    },
    opening_balance: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    current_balance: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    is_system: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    search_aliases: { type: DataTypes.TEXT, allowNull: true },
    account_group: { type: DataTypes.STRING(100), allowNull: true },
    is_cash_or_bank: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    is_ar_ap: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    party_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'gl_accounts',
    underscored: true,
    timestamps: true,
  }
);

export default GlAccount;
