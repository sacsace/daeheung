import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkAssigneeItemAttributes {
  id: number;
  assignee_id: number;
  partner_id?: number | null;
  name: string;
  note?: string | null;
  is_highlighted: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface WorkAssigneeItemCreationAttributes
  extends Optional<
    WorkAssigneeItemAttributes,
    | 'id'
    | 'partner_id'
    | 'note'
    | 'is_highlighted'
    | 'sort_order'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class WorkAssigneeItem
  extends Model<WorkAssigneeItemAttributes, WorkAssigneeItemCreationAttributes>
  implements WorkAssigneeItemAttributes
{
  public id!: number;
  public assignee_id!: number;
  public partner_id?: number | null;
  public name!: string;
  public note?: string | null;
  public is_highlighted!: boolean;
  public sort_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

WorkAssigneeItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    assignee_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    partner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(300),
      allowNull: false,
    },
    note: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    is_highlighted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'work_assignee_items',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      { fields: ['assignee_id'] },
      { fields: ['assignee_id', 'sort_order'] },
      { fields: ['assignee_id', 'is_active'] },
      { fields: ['partner_id'] },
    ],
  }
);

export default WorkAssigneeItem;
