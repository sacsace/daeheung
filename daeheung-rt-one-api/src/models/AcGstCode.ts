import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcGstCodeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  code: string;
  name: string;
  rate: number;
  tax_type: string;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  cess_rate: number;
  io_type: string;
  input_account_id?: number | null;
  output_account_id?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AcGstCodeCreationAttributes
  extends Optional<
    AcGstCodeAttributes,
    | 'id'
    | 'rate'
    | 'tax_type'
    | 'cgst_rate'
    | 'sgst_rate'
    | 'igst_rate'
    | 'cess_rate'
    | 'io_type'
    | 'input_account_id'
    | 'output_account_id'
    | 'effective_from'
    | 'effective_to'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AcGstCode extends Model<AcGstCodeAttributes, AcGstCodeCreationAttributes> implements AcGstCodeAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public code!: string;
  public name!: string;
  public rate!: number;
  public tax_type!: string;
  public cgst_rate!: number;
  public sgst_rate!: number;
  public igst_rate!: number;
  public cess_rate!: number;
  public io_type!: string;
  public input_account_id?: number | null;
  public output_account_id?: number | null;
  public effective_from?: string | null;
  public effective_to?: string | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AcGstCode.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(30), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false },
    rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    tax_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'cgst_sgst' },
    cgst_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    sgst_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    igst_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    cess_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    io_type: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'input' },
    input_account_id: { type: DataTypes.INTEGER, allowNull: true },
    output_account_id: { type: DataTypes.INTEGER, allowNull: true },
    effective_from: { type: DataTypes.DATEONLY, allowNull: true },
    effective_to: { type: DataTypes.DATEONLY, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'ac_gst_codes', underscored: true, timestamps: true }
);

export default AcGstCode;
