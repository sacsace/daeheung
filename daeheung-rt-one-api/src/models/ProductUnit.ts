import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProductUnitAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<ProductUnitAttributes, 'id' | 'created_at' | 'updated_at'>;

class ProductUnit extends Model<ProductUnitAttributes, Creation> implements ProductUnitAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
}

ProductUnit.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(50), allowNull: false }
  },
  { sequelize, tableName: 'product_units', timestamps: true, underscored: true }
);

export default ProductUnit;
