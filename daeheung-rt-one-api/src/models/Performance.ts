import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PerformanceAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id: number;
  review_period: string;
  overall_rating: number;
  goals: any; // JSON
  competencies: any; // JSON
  strengths: any; // JSON array
  improvements: any; // JSON array
  manager_comment: string;
  employee_comment?: string;
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'finalized';
  reviewed_by?: number;
  created_at?: Date;
  updated_at?: Date;
}

interface PerformanceCreationAttributes extends Optional<PerformanceAttributes, 'id' | 'employee_comment' | 'reviewed_by' | 'created_at' | 'updated_at'> {}

class Performance extends Model<PerformanceAttributes, PerformanceCreationAttributes> implements PerformanceAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id!: number;
  public review_period!: string;
  public overall_rating!: number;
  public goals!: any;
  public competencies!: any;
  public strengths!: any;
  public improvements!: any;
  public manager_comment!: string;
  public employee_comment?: string;
  public status!: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'finalized';
  public reviewed_by?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Performance.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    review_period: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    overall_rating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      defaultValue: 0
    },
    goals: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    competencies: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    strengths: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    improvements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    manager_comment: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    employee_comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'approved', 'finalized'),
      allowNull: false,
      defaultValue: 'draft'
    },
    reviewed_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'performances',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['review_period']
      }
    ]
  }
);

export default Performance;







