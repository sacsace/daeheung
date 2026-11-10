import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkStatisticAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id: number;
  period: string;
  total_hours: number;
  productive_hours: number;
  tasks_completed: number;
  tasks_assigned: number;
  efficiency: number;
  productivity: number;
  attendance_rate: number;
  overtime_hours: number;
  break_time: number;
  focus_time: number;
  meeting_time: number;
  code_review_time: number;
  testing_time: number;
  documentation_time: number;
  created_at?: Date;
  updated_at?: Date;
}

interface WorkStatisticCreationAttributes extends Optional<WorkStatisticAttributes, 'id' | 'created_at' | 'updated_at'> {}

class WorkStatistic extends Model<WorkStatisticAttributes, WorkStatisticCreationAttributes> implements WorkStatisticAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id!: number;
  public period!: string;
  public total_hours!: number;
  public productive_hours!: number;
  public tasks_completed!: number;
  public tasks_assigned!: number;
  public efficiency!: number;
  public productivity!: number;
  public attendance_rate!: number;
  public overtime_hours!: number;
  public break_time!: number;
  public focus_time!: number;
  public meeting_time!: number;
  public code_review_time!: number;
  public testing_time!: number;
  public documentation_time!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

WorkStatistic.init(
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
    period: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    total_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    productive_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    tasks_completed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    tasks_assigned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    efficiency: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    productivity: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    attendance_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    overtime_hours: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    break_time: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    focus_time: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    meeting_time: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    code_review_time: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    testing_time: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    documentation_time: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    sequelize,
    tableName: 'work_statistics',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['period']
      },
      {
        unique: true,
        fields: ['user_id', 'period']
      }
    ]
  }
);

export default WorkStatistic;







