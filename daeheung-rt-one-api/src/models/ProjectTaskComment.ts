import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectTaskCommentAttributes {
  id: number;
  task_id: number;
  user_id?: number | null;
  parent_id?: number | null;
  content: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type Creation = Optional<
  ProjectTaskCommentAttributes,
  'id' | 'user_id' | 'parent_id' | 'created_at' | 'updated_at' | 'deleted_at'
>;

class ProjectTaskComment
  extends Model<ProjectTaskCommentAttributes, Creation>
  implements ProjectTaskCommentAttributes
{
  public id!: number;
  public task_id!: number;
  public user_id?: number | null;
  public parent_id?: number | null;
  public content!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

ProjectTaskComment.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    parent_id: { type: DataTypes.INTEGER, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'project_task_comments',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default ProjectTaskComment;
