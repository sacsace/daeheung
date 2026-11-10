import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface MenuAttributes {
  id: number;
  tenant_id: number;
  parent_id?: number;
  name_ko: string;
  name_en: string;
  route: string;
  icon: string;
  order: number;
  level: number;
  is_active: boolean;
  description?: string;
  created_at?: Date;
  updated_at?: Date;
}

interface MenuCreationAttributes extends Optional<MenuAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Menu extends Model<MenuAttributes, MenuCreationAttributes> implements MenuAttributes {
  public id!: number;
  public tenant_id!: number;
  public parent_id?: number;
  public name_ko!: string;
  public name_en!: string;
  public route!: string;
  public icon!: string;
  public order!: number;
  public level!: number;
  public is_active!: boolean;
  public description?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Menu.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    parent_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'menus',
        key: 'id'
      }
    },
    name_ko: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    name_en: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    route: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    icon: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'menus',
    indexes: [
      {
        fields: ['tenant_id']
      },
      {
        fields: ['parent_id']
      },
      {
        fields: ['route']
      }
    ]
  }
);

export default Menu;
