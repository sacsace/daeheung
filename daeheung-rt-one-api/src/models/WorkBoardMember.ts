import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkBoardMemberAttributes {
  id: number;
  board_id: number;
  user_id: number;
  role: 'owner' | 'member';
  invited_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface WorkBoardMemberCreationAttributes
  extends Optional<
    WorkBoardMemberAttributes,
    'id' | 'created_at' | 'updated_at' | 'invited_by' | 'role' | 'deleted_at'
  > {}

class WorkBoardMember
  extends Model<WorkBoardMemberAttributes, WorkBoardMemberCreationAttributes>
  implements WorkBoardMemberAttributes
{
  public id!: number;
  public board_id!: number;
  public user_id!: number;
  public role!: 'owner' | 'member';
  public invited_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

WorkBoardMember.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    board_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'member'
    },
    invited_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  },
  {
    sequelize,
    tableName: 'work_board_members',
    timestamps: true,
    underscored: true,
    paranoid: true
  }
);

export default WorkBoardMember;
