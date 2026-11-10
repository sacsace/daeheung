import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectTaskAssigneeAttributes {
  id: number;
  task_id: number;
  user_id: number;
  assigned_by?: number | null;
  assigned_at: Date;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type Creation = Optional<
  ProjectTaskAssigneeAttributes,
  'id' | 'assigned_by' | 'assigned_at' | 'created_at' | 'updated_at' | 'deleted_at'
>;

class ProjectTaskAssignee extends Model<ProjectTaskAssigneeAttributes, Creation> implements ProjectTaskAssigneeAttributes {
  public id!: number;
  public task_id!: number;
  public user_id!: number;
  public assigned_by?: number | null;
  public assigned_at!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

ProjectTaskAssignee.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    task_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    assigned_by: { type: DataTypes.INTEGER, allowNull: true },
    assigned_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'project_task_assignees', timestamps: true, underscored: true, paranoid: true }
);

export default ProjectTaskAssignee;
