import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectActivityAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  project_id: number;
  task_id?: number | null;
  actor_id?: number | null;
  event_type: string;
  metadata?: Record<string, unknown> | null;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<
  ProjectActivityAttributes,
  'id' | 'task_id' | 'actor_id' | 'metadata' | 'created_at' | 'updated_at'
>;

class ProjectActivity extends Model<ProjectActivityAttributes, Creation> implements ProjectActivityAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public project_id!: number;
  public task_id?: number | null;
  public actor_id?: number | null;
  public event_type!: string;
  public metadata?: Record<string, unknown> | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

ProjectActivity.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    task_id: { type: DataTypes.INTEGER, allowNull: true },
    actor_id: { type: DataTypes.INTEGER, allowNull: true },
    event_type: { type: DataTypes.STRING(50), allowNull: false },
    metadata: { type: DataTypes.JSONB, allowNull: true },
  },
  { sequelize, tableName: 'project_activities', timestamps: true, underscored: true, updatedAt: 'updated_at', createdAt: 'created_at' }
);

export default ProjectActivity;
