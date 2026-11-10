import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcBankAccountAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  bank_name: string;
  account_name: string;
  account_number?: string | null;
  ifsc?: string | null;
  branch_name?: string | null;
  currency: string;
  ledger_account_id?: number | null;
  opening_balance: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AcBankAccountCreationAttributes
  extends Optional<
    AcBankAccountAttributes,
    | 'id'
    | 'account_number'
    | 'ifsc'
    | 'branch_name'
    | 'currency'
    | 'ledger_account_id'
    | 'opening_balance'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AcBankAccount extends Model<AcBankAccountAttributes, AcBankAccountCreationAttributes> implements AcBankAccountAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public bank_name!: string;
  public account_name!: string;
  public account_number?: string | null;
  public ifsc?: string | null;
  public branch_name?: string | null;
  public currency!: string;
  public ledger_account_id?: number | null;
  public opening_balance!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AcBankAccount.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    bank_name: { type: DataTypes.STRING(100), allowNull: false },
    account_name: { type: DataTypes.STRING(100), allowNull: false },
    account_number: { type: DataTypes.STRING(50), allowNull: true },
    ifsc: { type: DataTypes.STRING(20), allowNull: true },
    branch_name: { type: DataTypes.STRING(100), allowNull: true },
    currency: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'INR' },
    ledger_account_id: { type: DataTypes.INTEGER, allowNull: true },
    opening_balance: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'ac_bank_accounts', underscored: true, timestamps: true }
);

export default AcBankAccount;
