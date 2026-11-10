import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectTaskAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  project_id: number;
  title: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  status: string;
  priority: string;
  created_by?: number | null;
  completed_at?: Date | null;
  completed_by?: number | null;
  is_active: boolean;
  progress_note?: string | null;
  attachments?: any;
  color?: string | null;
  sort_order: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type ProjectTaskCreation = Optional<
  ProjectTaskAttributes,
  | 'id'
  | 'description'
  | 'start_date'
  | 'due_date'
  | 'status'
  | 'priority'
  | 'created_by'
  | 'completed_at'
  | 'completed_by'
  | 'is_active'
  | 'progress_note'
  | 'attachments'
  | 'color'
  | 'sort_order'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
>;

class ProjectTask extends Model<ProjectTaskAttributes, ProjectTaskCreation> implements ProjectTaskAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public project_id!: number;
  public title!: string;
  public description?: string | null;
  public start_date?: string | null;
  public due_date?: string | null;
  public status!: string;
  public priority!: string;
  public created_by?: number | null;
  public completed_at?: Date | null;
  public completed_by?: number | null;
  public is_active!: boolean;
  public progress_note?: string | null;
  public attachments?: any;
  public color?: string | null;
  public sort_order!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

ProjectTask.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(300), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: true },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'todo' },
    priority: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'medium' },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    completed_by: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    progress_note: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    color: { type: DataTypes.STRING(7), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'project_tasks', timestamps: true, underscored: true, paranoid: true }
);

export default ProjectTask;
