import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserPermissionAttributes {
  id: number;
  user_id: number;
  menu_id: number;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface UserPermissionCreationAttributes extends Optional<UserPermissionAttributes, 'id' | 'created_at' | 'updated_at'> {}

class UserPermission extends Model<UserPermissionAttributes, UserPermissionCreationAttributes> implements UserPermissionAttributes {
  public id!: number;
  public user_id!: number;
  public menu_id!: number;
  public can_view!: boolean;
  public can_create!: boolean;
  public can_edit!: boolean;
  public can_delete!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

UserPermission.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    menu_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'menus',
        key: 'id'
      }
    },
    can_view: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    can_create: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    can_edit: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    can_delete: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    }
  },
  {
    sequelize,
    tableName: 'user_permissions',
    indexes: [
      {
        fields: ['user_id']
      },
      {
        fields: ['menu_id']
      },
      {
        fields: ['user_id', 'menu_id'],
        unique: true
      }
    ]
  }
);

export default UserPermission;
