import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProductCategoryAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<ProductCategoryAttributes, 'id' | 'created_at' | 'updated_at'>;

class ProductCategory extends Model<ProductCategoryAttributes, Creation> implements ProductCategoryAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
}

ProductCategory.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false }
  },
  { sequelize, tableName: 'product_categories', timestamps: true, underscored: true }
);

export default ProductCategory;
