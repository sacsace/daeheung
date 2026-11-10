import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcTdsCodeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  section: string;
  description?: string | null;
  description_en?: string | null;
  individual_rate: number;
  company_rate: number;
  no_pan_rate: number;
  threshold_amount: number;
  payable_account_id?: number | null;
  effective_from?: string | null;
  effective_to?: string | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AcTdsCodeCreationAttributes
  extends Optional<
    AcTdsCodeAttributes,
    | 'id'
    | 'description'
    | 'description_en'
    | 'individual_rate'
    | 'company_rate'
    | 'no_pan_rate'
    | 'threshold_amount'
    | 'payable_account_id'
    | 'effective_from'
    | 'effective_to'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AcTdsCode extends Model<AcTdsCodeAttributes, AcTdsCodeCreationAttributes> implements AcTdsCodeAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public section!: string;
  public description?: string | null;
  public description_en?: string | null;
  public individual_rate!: number;
  public company_rate!: number;
  public no_pan_rate!: number;
  public threshold_amount!: number;
  public payable_account_id?: number | null;
  public effective_from?: string | null;
  public effective_to?: string | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AcTdsCode.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    section: { type: DataTypes.STRING(20), allowNull: false },
    description: { type: DataTypes.STRING(255), allowNull: true },
    description_en: { type: DataTypes.STRING(255), allowNull: true },
    individual_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    company_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    no_pan_rate: { type: DataTypes.DECIMAL(8, 4), allowNull: false, defaultValue: 0 },
    threshold_amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    payable_account_id: { type: DataTypes.INTEGER, allowNull: true },
    effective_from: { type: DataTypes.DATEONLY, allowNull: true },
    effective_to: { type: DataTypes.DATEONLY, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'ac_tds_codes', underscored: true, timestamps: true }
);

export default AcTdsCode;
