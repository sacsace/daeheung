import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface InventoryLocationAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<InventoryLocationAttributes, 'id' | 'created_at' | 'updated_at'>;

class InventoryLocation extends Model<InventoryLocationAttributes, Creation> implements InventoryLocationAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
}

InventoryLocation.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false }
  },
  { sequelize, tableName: 'inventory_locations', timestamps: true, underscored: true }
);

export default InventoryLocation;
