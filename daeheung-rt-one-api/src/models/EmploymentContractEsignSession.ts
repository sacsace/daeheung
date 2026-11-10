import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type EsignSessionStatus =
  | 'initiated'
  | 'pending'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

interface EmploymentContractEsignSessionAttributes {
  id: number;
  contract_id: number;
  tenant_id?: number | null;
  company_id?: number | null;
  signer_type: 'company' | 'employee';
  signer_id: number;
  provider: string;
  mode: string;
  session_token: string;
  asp_txn_id?: string | null;
  status: EsignSessionStatus | string;
  document_hash?: string | null;
  aadhaar_last4?: string | null;
  consent_at?: Date | null;
  redirect_url?: string | null;
  return_url?: string | null;
  callback_payload?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  expires_at?: Date | null;
  completed_at?: Date | null;
  created_by?: number | null;
  created_at: Date;
  updated_at: Date;
}

type Creation = Optional<
  EmploymentContractEsignSessionAttributes,
  | 'id'
  | 'tenant_id'
  | 'company_id'
  | 'asp_txn_id'
  | 'document_hash'
  | 'aadhaar_last4'
  | 'consent_at'
  | 'redirect_url'
  | 'return_url'
  | 'callback_payload'
  | 'error_code'
  | 'error_message'
  | 'expires_at'
  | 'completed_at'
  | 'created_by'
  | 'created_at'
  | 'updated_at'
  | 'provider'
  | 'mode'
  | 'status'
>;

class EmploymentContractEsignSession
  extends Model<EmploymentContractEsignSessionAttributes, Creation>
  implements EmploymentContractEsignSessionAttributes
{
  public id!: number;
  public contract_id!: number;
  public tenant_id?: number | null;
  public company_id?: number | null;
  public signer_type!: 'company' | 'employee';
  public signer_id!: number;
  public provider!: string;
  public mode!: string;
  public session_token!: string;
  public asp_txn_id?: string | null;
  public status!: EsignSessionStatus | string;
  public document_hash?: string | null;
  public aadhaar_last4?: string | null;
  public consent_at?: Date | null;
  public redirect_url?: string | null;
  public return_url?: string | null;
  public callback_payload?: string | null;
  public error_code?: string | null;
  public error_message?: string | null;
  public expires_at?: Date | null;
  public completed_at?: Date | null;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmploymentContractEsignSession.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    contract_id: { type: DataTypes.INTEGER, allowNull: false },
    tenant_id: { type: DataTypes.INTEGER, allowNull: true },
    company_id: { type: DataTypes.INTEGER, allowNull: true },
    signer_type: { type: DataTypes.STRING(20), allowNull: false },
    signer_id: { type: DataTypes.INTEGER, allowNull: false },
    provider: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'mock' },
    mode: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'mock' },
    session_token: { type: DataTypes.STRING(64), allowNull: false, unique: true },
    asp_txn_id: { type: DataTypes.STRING(120), allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'initiated' },
    document_hash: { type: DataTypes.STRING(128), allowNull: true },
    aadhaar_last4: { type: DataTypes.STRING(4), allowNull: true },
    consent_at: { type: DataTypes.DATE, allowNull: true },
    redirect_url: { type: DataTypes.TEXT, allowNull: true },
    return_url: { type: DataTypes.TEXT, allowNull: true },
    callback_payload: { type: DataTypes.TEXT, allowNull: true },
    error_code: { type: DataTypes.STRING(80), allowNull: true },
    error_message: { type: DataTypes.STRING(500), allowNull: true },
    expires_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    sequelize,
    tableName: 'employment_contract_esign_sessions',
    timestamps: true,
    underscored: true,
  }
);

export default EmploymentContractEsignSession;
