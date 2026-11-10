import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProductAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  product_code: string;
  name: string;
  description?: string;
  image_url?: string;
  supplier?: string;
  partner_id?: number | null;
  location?: string;
  category: string;
  unit_price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock_level: number;
  max_stock_level: number;
  unit: string;
  tax_rate: number;
  status: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public product_code!: string;
  public name!: string;
  public description?: string;
  public image_url?: string;
  public supplier?: string;
  public partner_id?: number | null;
  public location?: string;
  public category!: string;
  public unit_price!: number;
  public cost_price!: number;
  public stock_quantity!: number;
  public min_stock_level!: number;
  public max_stock_level!: number;
  public unit!: string;
  public tax_rate!: number;
  public status!: string;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Product.init(
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
    product_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    image_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    supplier: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    partner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'partners',
        key: 'id'
      }
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    cost_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    stock_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    min_stock_level: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    max_stock_level: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1000,
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: '개',
    },
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
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
    tableName: 'products',
    timestamps: true,
    underscored: true,
  }
);

export default Product;
