import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ProjectMemberRole = 'owner' | 'manager' | 'member' | 'viewer';
export type ProjectMemberStatus = 'active' | 'invited' | 'removed';

interface ProjectMemberAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  project_id: number;
  user_id: number;
  role: ProjectMemberRole;
  status: ProjectMemberStatus;
  invited_by?: number | null;
  invited_at: Date;
  joined_at?: Date | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface ProjectMemberCreationAttributes
  extends Optional<
    ProjectMemberAttributes,
    | 'id'
    | 'role'
    | 'status'
    | 'invited_by'
    | 'invited_at'
    | 'joined_at'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
    | 'deleted_at'
  > {}

class ProjectMember
  extends Model<ProjectMemberAttributes, ProjectMemberCreationAttributes>
  implements ProjectMemberAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public project_id!: number;
  public user_id!: number;
  public role!: ProjectMemberRole;
  public status!: ProjectMemberStatus;
  public invited_by?: number | null;
  public invited_at!: Date;
  public joined_at?: Date | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

ProjectMember.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    project_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
    role: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'member',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
    invited_by: { type: DataTypes.INTEGER, allowNull: true },
    invited_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    joined_at: { type: DataTypes.DATE, allowNull: true },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'project_members',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default ProjectMember;
