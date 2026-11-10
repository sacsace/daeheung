import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AssetAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  asset_code: string;
  name: string;
  category: string;
  subcategory?: string;
  purchase_date?: string;
  purchase_price?: number;
  salvage_value?: number;
  current_value?: number;
  depreciation_rate?: number;
  accumulated_depreciation?: number;
  location?: string;
  status: 'active' | 'maintenance' | 'disposed' | 'lost' | 'transferred';
  maintenance_date?: string;
  next_maintenance?: string;
  warranty_expiry?: string;
  description?: string;
  vendor?: string;
  serial_number?: string;
  assigned_to?: string;
  department?: string;
  useful_life?: number;
  depreciation_method?: 'straight_line' | 'declining_balance' | 'units_of_production';
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AssetCreationAttributes extends Optional<
  AssetAttributes,
  | 'id'
  | 'subcategory'
  | 'purchase_date'
  | 'purchase_price'
  | 'salvage_value'
  | 'current_value'
  | 'depreciation_rate'
  | 'accumulated_depreciation'
  | 'location'
  | 'maintenance_date'
  | 'next_maintenance'
  | 'warranty_expiry'
  | 'description'
  | 'vendor'
  | 'serial_number'
  | 'assigned_to'
  | 'department'
  | 'useful_life'
  | 'depreciation_method'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
> {}

class Asset extends Model<AssetAttributes, AssetCreationAttributes> implements AssetAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public asset_code!: string;
  public name!: string;
  public category!: string;
  public subcategory?: string;
  public purchase_date?: string;
  public purchase_price?: number;
  public salvage_value?: number;
  public current_value?: number;
  public depreciation_rate?: number;
  public accumulated_depreciation?: number;
  public location?: string;
  public status!: 'active' | 'maintenance' | 'disposed' | 'lost' | 'transferred';
  public maintenance_date?: string;
  public next_maintenance?: string;
  public warranty_expiry?: string;
  public description?: string;
  public vendor?: string;
  public serial_number?: string;
  public assigned_to?: string;
  public department?: string;
  public useful_life?: number;
  public depreciation_method?: 'straight_line' | 'declining_balance' | 'units_of_production';
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Asset.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    asset_code: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    category: { type: DataTypes.STRING(100), allowNull: false },
    subcategory: { type: DataTypes.STRING(100), allowNull: true },
    purchase_date: { type: DataTypes.DATEONLY, allowNull: true },
    purchase_price: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    salvage_value: { type: DataTypes.DECIMAL(15, 2), allowNull: true, defaultValue: 0 },
    current_value: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    depreciation_rate: { type: DataTypes.FLOAT, allowNull: true },
    accumulated_depreciation: { type: DataTypes.DECIMAL(15, 2), allowNull: true },
    location: { type: DataTypes.STRING(255), allowNull: true },
    status: {
      type: DataTypes.ENUM('active', 'maintenance', 'disposed', 'lost', 'transferred'),
      allowNull: false,
      defaultValue: 'active'
    },
    maintenance_date: { type: DataTypes.DATEONLY, allowNull: true },
    next_maintenance: { type: DataTypes.DATEONLY, allowNull: true },
    warranty_expiry: { type: DataTypes.DATEONLY, allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    vendor: { type: DataTypes.STRING(100), allowNull: true },
    serial_number: { type: DataTypes.STRING(100), allowNull: true },
    assigned_to: { type: DataTypes.STRING(100), allowNull: true },
    department: { type: DataTypes.STRING(100), allowNull: true },
    useful_life: { type: DataTypes.INTEGER, allowNull: true },
    depreciation_method: {
      type: DataTypes.ENUM('straight_line', 'declining_balance', 'units_of_production'),
      allowNull: true
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  {
    sequelize,
    tableName: 'assets',
    indexes: [
      { fields: ['tenant_id', 'company_id'] },
      { fields: ['asset_code'] },
      { fields: ['status'] }
    ]
  }
);

export default Asset;
