import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CompanyAttributes {
  id: number;
  tenant_id: number;
  name: string;
  business_number: string;
  ceo_name: string;
  address: string;
  phone: string;
  email: string;
  website?: string;
  industry?: string;
  employee_count: number;
  subscription_plan: string;
  subscription_status: string;
  status: 'active' | 'inactive' | 'suspended';
  company_logo?: Buffer;
  company_seal?: Buffer;
  ceo_signature?: Buffer;
  account_holder_name?: string;
  bank_name?: string;
  bank_address?: string;
  account_number?: string;
  ifsc_code?: string;
  swift_code?: string;
  msme_number?: string;
  iec_number?: string;
  pan_number?: string;
  login_period_start?: Date;
  login_period_end?: Date;
  login_time_start: string;
  login_time_end: string;
  timezone: string;
  settings: any;
  created_at?: Date;
  updated_at?: Date;
}

interface CompanyCreationAttributes extends Optional<CompanyAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Company extends Model<CompanyAttributes, CompanyCreationAttributes> implements CompanyAttributes {
  public id!: number;
  public tenant_id!: number;
  public name!: string;
  public business_number!: string;
  public ceo_name!: string;
  public address!: string;
  public phone!: string;
  public email!: string;
  public website?: string;
  public industry?: string;
  public employee_count!: number;
  public subscription_plan!: string;
  public subscription_status!: string;
  public status!: 'active' | 'inactive' | 'suspended';
  public company_logo?: Buffer;
  public company_seal?: Buffer;
  public ceo_signature?: Buffer;
  public account_holder_name?: string;
  public bank_name?: string;
  public bank_address?: string;
  public account_number?: string;
  public ifsc_code?: string;
  public swift_code?: string;
  public msme_number?: string;
  public iec_number?: string;
  public pan_number?: string;
  public login_period_start?: Date;
  public login_period_end?: Date;
  public login_time_start!: string;
  public login_time_end!: string;
  public timezone!: string;
  public settings!: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Company.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    business_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    ceo_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    website: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    industry: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    employee_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    subscription_plan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'basic'
    },
    subscription_status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'active'
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'suspended'),
      allowNull: false,
      defaultValue: 'active'
    },
    company_logo: {
      type: DataTypes.BLOB('long'),
      allowNull: true
    },
    company_seal: {
      type: DataTypes.BLOB('long'),
      allowNull: true
    },
    ceo_signature: {
      type: DataTypes.BLOB('long'),
      allowNull: true
    },
    account_holder_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    bank_name: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    bank_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    account_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    ifsc_code: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    swift_code: {
      type: DataTypes.STRING(11),
      allowNull: true
    },
    msme_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    iec_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    pan_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    login_period_start: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    login_period_end: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    login_time_start: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: '09:00:00'
    },
    login_time_end: {
      type: DataTypes.STRING(8),
      allowNull: false,
      defaultValue: '18:00:00'
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'Asia/Kolkata'
    },
    settings: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}
    }
  },
  {
    sequelize,
    tableName: 'companies',
    indexes: [
      {
        fields: ['tenant_id']
      },
      {
        fields: ['business_number']
      },
      {
        fields: ['name']
      }
    ]
  }
);

export default Company;
