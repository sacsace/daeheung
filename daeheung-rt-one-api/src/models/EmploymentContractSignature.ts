import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EmploymentContractSignatureAttributes {
  id: number;
  contract_id: number;
  signer_type: 'company' | 'employee';
  signer_id: number;
  signed_at: Date;
  sign_ip?: string | null;
  sign_method?: string | null;
  signature_data?: string | null;
  created_at: Date;
  updated_at: Date;
}

interface EmploymentContractSignatureCreationAttributes
  extends Optional<
    EmploymentContractSignatureAttributes,
    'id' | 'signed_at' | 'sign_ip' | 'sign_method' | 'signature_data' | 'created_at' | 'updated_at'
  > {}

class EmploymentContractSignature
  extends Model<EmploymentContractSignatureAttributes, EmploymentContractSignatureCreationAttributes>
  implements EmploymentContractSignatureAttributes
{
  public id!: number;
  public contract_id!: number;
  public signer_type!: 'company' | 'employee';
  public signer_id!: number;
  public signed_at!: Date;
  public sign_ip?: string | null;
  public sign_method?: string | null;
  public signature_data?: string | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmploymentContractSignature.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    contract_id: { type: DataTypes.INTEGER, allowNull: false },
    signer_type: { type: DataTypes.STRING(20), allowNull: false },
    signer_id: { type: DataTypes.INTEGER, allowNull: false },
    signed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    sign_ip: { type: DataTypes.STRING(64), allowNull: true },
    sign_method: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'internal_ack' },
    signature_data: { type: DataTypes.TEXT, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: 'employment_contract_signatures',
    timestamps: true,
    underscored: true
  }
);

export default EmploymentContractSignature;

