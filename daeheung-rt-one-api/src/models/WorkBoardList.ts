import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkBoardListAttributes {
  id: number;
  board_id: number;
  title: string;
  description?: string | null;
  assignee_user_id?: number | null;
  position: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface WorkBoardListCreationAttributes
  extends Optional<
    WorkBoardListAttributes,
    'id' | 'created_at' | 'updated_at' | 'position' | 'description' | 'assignee_user_id' | 'deleted_at'
  > {}

class WorkBoardList
  extends Model<WorkBoardListAttributes, WorkBoardListCreationAttributes>
  implements WorkBoardListAttributes
{
  public id!: number;
  public board_id!: number;
  public title!: string;
  public description!: string | null;
  public assignee_user_id!: number | null;
  public position!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

WorkBoardList.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    board_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(120), allowNull: false },
    description: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    assignee_user_id: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'work_board_lists',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default WorkBoardList;
