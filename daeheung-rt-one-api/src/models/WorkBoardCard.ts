import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkBoardCardAttributes {
  id: number;
  list_id: number;
  title: string;
  description?: string;
  color?: string | null;
  position: number;
  assignee_user_id?: number | null;
  reference_user_ids?: number[];
  due_date?: string | null;
  created_by?: number | null;
  completed_at?: Date | null;
  attachments?: any;
  comment_reads?: any;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface WorkBoardCardCreationAttributes
  extends Optional<
    WorkBoardCardAttributes,
    | 'id'
    | 'created_at'
    | 'updated_at'
    | 'description'
    | 'color'
    | 'assignee_user_id'
    | 'reference_user_ids'
    | 'due_date'
    | 'created_by'
    | 'completed_at'
    | 'position'
    | 'deleted_at'
  > {}

class WorkBoardCard
  extends Model<WorkBoardCardAttributes, WorkBoardCardCreationAttributes>
  implements WorkBoardCardAttributes
{
  public id!: number;
  public list_id!: number;
  public title!: string;
  public description?: string;
  public color?: string | null;
  public position!: number;
  public assignee_user_id?: number | null;
  public reference_user_ids?: number[];
  public due_date?: string | null;
  public created_by?: number | null;
  public completed_at?: Date | null;
  public attachments?: any;
  public comment_reads?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

WorkBoardCard.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    list_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    color: { type: DataTypes.STRING(7), allowNull: true },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    assignee_user_id: { type: DataTypes.INTEGER, allowNull: true },
    reference_user_ids: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    attachments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    comment_reads: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  },
  {
    sequelize,
    tableName: 'work_board_cards',
    timestamps: true,
    underscored: true,
    paranoid: true
  }
);

export default WorkBoardCard;
