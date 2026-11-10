import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkBoardCardCommentAttributes {
  id: number;
  card_id: number;
  user_id?: number | null;
  parent_id?: number | null;
  content: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface WorkBoardCardCommentCreationAttributes
  extends Optional<
    WorkBoardCardCommentAttributes,
    'id' | 'user_id' | 'parent_id' | 'created_at' | 'updated_at' | 'deleted_at'
  > {}

class WorkBoardCardComment
  extends Model<WorkBoardCardCommentAttributes, WorkBoardCardCommentCreationAttributes>
  implements WorkBoardCardCommentAttributes
{
  public id!: number;
  public card_id!: number;
  public user_id?: number | null;
  public parent_id?: number | null;
  public content!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

WorkBoardCardComment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    card_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    parent_id: { type: DataTypes.INTEGER, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  },
  {
    sequelize,
    tableName: 'work_board_card_comments',
    timestamps: true,
    underscored: true,
    paranoid: true
  }
);

export default WorkBoardCardComment;
