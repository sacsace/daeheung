import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectScheduleAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  project_id: number;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  all_day: boolean;
  type: string;
  created_by?: number | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type ProjectScheduleCreation = Optional<
  ProjectScheduleAttributes,
  'id' | 'description' | 'end_date' | 'start_time' | 'end_time' | 'all_day' | 'type' | 'created_by' | 'is_active' | 'created_at' | 'updated_at' | 'deleted_at'
>;

class ProjectSchedule extends Model<ProjectScheduleAttributes, ProjectScheduleCreation> implements ProjectScheduleAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public project_id!: number;
  public title!: string;
  public description?: string | null;
  public start_date!: string;
  public end_date?: string | null;
  public start_time?: string | null;
  public end_time?: string | null;
  public all_day!: boolean;
  public type!: string;
  public created_by?: number | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

ProjectSchedule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    title: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: true },
    start_time: { type: DataTypes.STRING(8), allowNull: true },
    end_time: { type: DataTypes.STRING(8), allowNull: true },
    all_day: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'work' },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'project_schedules', timestamps: true, underscored: true, paranoid: true }
);

export default ProjectSchedule;
