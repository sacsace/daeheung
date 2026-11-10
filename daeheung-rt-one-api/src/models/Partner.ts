import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PartnerAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  company_name: string;
  business_number: string;
  pan_number?: string;
  representative?: string;
  business_type: 'partner' | 'customer' | 'customer_partner' | 'other';
  industry?: string;
  address?: string;
  phone?: string;
  email: string;
  website?: string;
  bank_name?: string;
  account_number?: string;
  bank_ifsc?: string;
  account_holder?: string;
  contract_start_date?: Date;
  contract_end_date?: Date;
  status: 'active' | 'inactive' | 'suspended';
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface PartnerCreationAttributes extends Optional<PartnerAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Partner extends Model<PartnerAttributes, PartnerCreationAttributes> implements PartnerAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public company_name!: string;
  public business_number!: string;
  public pan_number?: string;
  public representative?: string;
  public business_type!: 'partner' | 'customer' | 'customer_partner' | 'other';
  public industry?: string;
  public address?: string;
  public phone?: string;
  public email!: string;
  public website?: string;
  public bank_name?: string;
  public account_number?: string;
  public bank_ifsc?: string;
  public account_holder?: string;
  public contract_start_date?: Date;
  public contract_end_date?: Date;
  public status!: 'active' | 'inactive' | 'suspended';
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Partner.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    company_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    business_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    pan_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    representative: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    business_type: {
      type: DataTypes.ENUM('partner', 'customer', 'customer_partner', 'other'),
      allowNull: false,
      defaultValue: 'partner',
    },
    industry: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    website: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    account_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    bank_ifsc: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    account_holder: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    contract_start_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contract_end_date: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'partners',
    timestamps: true,
    underscored: true,
  }
);

export default Partner;

