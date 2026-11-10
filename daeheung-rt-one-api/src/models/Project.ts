import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ProjectAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  customer_id?: number;
  project_code: string;
  name: string;
  description?: string;
  status: string;
  priority: string;
  start_date: string;
  end_date?: string;
  budget: number;
  actual_cost: number;
  progress: number;
  project_manager: number;
  created_by: number;
  sort_order: number;
  is_active?: boolean;
  created_at: Date;
  updated_at: Date;
}

interface ProjectCreationAttributes extends Optional<ProjectAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Project extends Model<ProjectAttributes, ProjectCreationAttributes> implements ProjectAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public customer_id?: number;
  public project_code!: string;
  public name!: string;
  public description?: string;
  public status!: string;
  public priority!: string;
  public start_date!: string;
  public end_date?: string;
  public budget!: number;
  public actual_cost!: number;
  public progress!: number;
  public project_manager!: number;
  public created_by!: number;
  public sort_order!: number;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Project.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    project_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'planning',
    },
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'medium',
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    budget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    actual_cost: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    project_manager: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'projects',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'projects_tenant_company_code_uk',
        unique: true,
        fields: ['tenant_id', 'company_id', 'project_code'],
      },
      {
        name: 'projects_project_code_idx',
        fields: ['project_code'],
      },
    ],
  }
);

export default Project;
