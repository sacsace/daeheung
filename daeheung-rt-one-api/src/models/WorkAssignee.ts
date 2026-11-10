import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkAssigneeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id?: number | null;
  name: string;
  title?: string | null;
  email?: string | null;
  sort_order: number;
  is_active: boolean;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

interface WorkAssigneeCreationAttributes
  extends Optional<
    WorkAssigneeAttributes,
    | 'id'
    | 'user_id'
    | 'title'
    | 'email'
    | 'sort_order'
    | 'is_active'
    | 'created_by'
    | 'created_at'
    | 'updated_at'
  > {}

class WorkAssignee
  extends Model<WorkAssigneeAttributes, WorkAssigneeCreationAttributes>
  implements WorkAssigneeAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id?: number | null;
  public name!: string;
  public title?: string | null;
  public email?: string | null;
  public sort_order!: number;
  public is_active!: boolean;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

WorkAssignee.init(
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(200),
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
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'work_assignees',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['tenant_id', 'company_id'] },
      { fields: ['tenant_id', 'company_id', 'sort_order'] },
      { fields: ['tenant_id', 'company_id', 'user_id'] },
    ],
  }
);

export default WorkAssignee;
