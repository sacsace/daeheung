import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WebAuthnCredentialAttributes {
  id: number;
  user_id: number;
  tenant_id: number;
  company_id: number;
  credential_id: string;
  public_key: string;
  counter: number;
  transports?: string[] | null;
  device_name?: string | null;
  backed_up: boolean;
  last_used_at?: Date | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<
  WebAuthnCredentialAttributes,
  'id' | 'transports' | 'device_name' | 'backed_up' | 'last_used_at' | 'is_active' | 'counter' | 'created_at' | 'updated_at'
>;

class WebAuthnCredential
  extends Model<WebAuthnCredentialAttributes, Creation>
  implements WebAuthnCredentialAttributes
{
  public id!: number;
  public user_id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public credential_id!: string;
  public public_key!: string;
  public counter!: number;
  public transports?: string[] | null;
  public device_name?: string | null;
  public backed_up!: boolean;
  public last_used_at?: Date | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

WebAuthnCredential.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    credential_id: { type: DataTypes.STRING(512), allowNull: false },
    public_key: { type: DataTypes.TEXT, allowNull: false },
    counter: { type: (DataTypes as any).BIGINT, allowNull: false, defaultValue: 0 },
    transports: { type: (DataTypes as any).JSONB, allowNull: true },
    device_name: { type: DataTypes.STRING(120), allowNull: true },
    backed_up: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    last_used_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'webauthn_credentials',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default WebAuthnCredential;
