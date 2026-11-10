import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcFinancialYearAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  start_date: string;
  end_date: string;
  is_open: boolean;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AcFinancialYearCreationAttributes
  extends Optional<AcFinancialYearAttributes, 'id' | 'is_open' | 'is_active' | 'created_at' | 'updated_at'> {}

class AcFinancialYear extends Model<AcFinancialYearAttributes, AcFinancialYearCreationAttributes> implements AcFinancialYearAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
  public start_date!: string;
  public end_date!: string;
  public is_open!: boolean;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AcFinancialYear.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(50), allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    is_open: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'ac_financial_years', underscored: true, timestamps: true }
);

export default AcFinancialYear;
