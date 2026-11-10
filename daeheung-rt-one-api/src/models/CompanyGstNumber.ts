import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CompanyGstNumberAttributes {
  id: number;
  company_id: number;
  gst_number: string;
  state_code?: string;
  registration_date?: Date;
  status: string;
  created_at?: Date;
  updated_at?: Date;
}

interface CompanyGstNumberCreationAttributes extends Optional<CompanyGstNumberAttributes, 'id' | 'created_at' | 'updated_at'> {}

class CompanyGstNumber extends Model<CompanyGstNumberAttributes, CompanyGstNumberCreationAttributes> implements CompanyGstNumberAttributes {
  public id!: number;
  public company_id!: number;
  public gst_number!: string;
  public state_code?: string;
  public registration_date?: Date;
  public status!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CompanyGstNumber.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    gst_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    state_code: {
      type: DataTypes.STRING(10),
      allowNull: true
    },
    registration_date: {
      type: DataTypes.DATE,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active'
    }
  },
  {
    sequelize,
    tableName: 'company_gst_numbers',
    indexes: [
      {
        name: 'idx_company_gst_numbers_company_id',
        fields: ['company_id']
      },
      {
        name: 'idx_company_gst_numbers_gst_number',
        fields: ['gst_number']
      },
      {
        name: 'idx_company_gst_numbers_status',
        fields: ['status']
      },
      {
        name: 'idx_company_gst_numbers_company_status',
        fields: ['company_id', 'status']
      },
      {
        name: 'idx_company_gst_numbers_gst_number_unique',
        unique: true,
        fields: ['gst_number']
      }
    ]
  }
);

export default CompanyGstNumber;

