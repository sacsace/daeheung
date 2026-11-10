import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface InventoryTransactionAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  product_id: number;
  transaction_type: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  reference_type: string;
  reference_id?: number;
  notes?: string;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface InventoryTransactionCreationAttributes extends Optional<InventoryTransactionAttributes, 'id' | 'created_at' | 'updated_at'> {}

class InventoryTransaction extends Model<InventoryTransactionAttributes, InventoryTransactionCreationAttributes> implements InventoryTransactionAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public product_id!: number;
  public transaction_type!: string;
  public quantity!: number;
  public unit_price!: number;
  public total_amount!: number;
  public reference_type!: string;
  public reference_id?: number;
  public notes?: string;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

InventoryTransaction.init(
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
    product_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'products',
        key: 'id',
      },
    },
    transaction_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    reference_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    reference_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
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
    tableName: 'inventory_transactions',
    timestamps: true,
    underscored: true,
  }
);

export default InventoryTransaction;
