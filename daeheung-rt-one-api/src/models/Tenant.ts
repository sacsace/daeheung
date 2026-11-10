import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TenantAttributes {
  id: number;
  name: string;
  domain: string;
  subdomain: string;
  plan: 'basic' | 'standard' | 'premium' | 'enterprise';
  max_users: number;
  max_companies: number;
  features: string[]; // JSON array of enabled features
  status: 'active' | 'inactive' | 'suspended' | 'trial';
  trial_ends_at?: Date;
  subscription_id?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface TenantCreationAttributes extends Optional<TenantAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Tenant extends Model<TenantAttributes, TenantCreationAttributes> implements TenantAttributes {
  public id!: number;
  public name!: string;
  public domain!: string;
  public subdomain!: string;
  public plan!: 'basic' | 'standard' | 'premium' | 'enterprise';
  public max_users!: number;
  public max_companies!: number;
  public features!: string[];
  public status!: 'active' | 'inactive' | 'suspended' | 'trial';
  public trial_ends_at?: Date;
  public subscription_id?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Tenant.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    domain: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    subdomain: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    plan: {
      type: DataTypes.ENUM('basic', 'standard', 'premium', 'enterprise'),
      allowNull: false,
      defaultValue: 'basic'
    },
    max_users: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    max_companies: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    features: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended', 'trial'),
      allowNull: false,
      defaultValue: 'trial'
    },
    trial_ends_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    subscription_id: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'tenants',
    indexes: [
      {
        fields: ['domain']
      },
      {
        fields: ['subdomain']
      },
      {
        fields: ['status']
      }
    ]
  }
);

export default Tenant;
