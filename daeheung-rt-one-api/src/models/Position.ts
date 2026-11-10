import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PositionAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  code?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface PositionCreationAttributes
  extends Optional<PositionAttributes, 'id' | 'code' | 'sort_order' | 'is_active' | 'created_at' | 'updated_at'> {}

class Position extends Model<PositionAttributes, PositionCreationAttributes> implements PositionAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
  public code?: string | null;
  public sort_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Position.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'positions',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['tenant_id'] },
      { fields: ['tenant_id', 'company_id'] },
      { unique: true, fields: ['tenant_id', 'company_id', 'name'] },
    ],
  }
);

export default Position;
