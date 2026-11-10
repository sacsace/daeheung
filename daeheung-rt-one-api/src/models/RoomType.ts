import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomTypeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  room_count: number;
  nightly_rate: number;
  description?: string;
  is_active: boolean;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
}

interface RoomTypeCreationAttributes extends Optional<RoomTypeAttributes, 'id' | 'created_at' | 'updated_at'> {}

class RoomType extends Model<RoomTypeAttributes, RoomTypeCreationAttributes> implements RoomTypeAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
  public room_count!: number;
  public nightly_rate!: number;
  public description?: string;
  public is_active!: boolean;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

RoomType.init(
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
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    room_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    nightly_rate: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    tableName: 'room_types',
  }
);

export default RoomType;
