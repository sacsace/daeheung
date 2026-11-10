import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type RecurringInstanceStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'NOT_APPLICABLE';

interface RecurringTaskInstanceAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  board_id: number;
  template_id: number;
  customer_id: number;
  period: string;
  period_start: string;
  period_end: string;
  due_date?: string | null;
  status: RecurringInstanceStatus;
  assigned_user_id?: number | null;
  reviewer_user_id?: number | null;
  completed_by?: number | null;
  completed_at?: Date | null;
  verified_by?: number | null;
  verified_at?: Date | null;
  notes?: string | null;
  attachments?: any;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type Creation = Optional<
  RecurringTaskInstanceAttributes,
  | 'id'
  | 'due_date'
  | 'status'
  | 'assigned_user_id'
  | 'reviewer_user_id'
  | 'completed_by'
  | 'completed_at'
  | 'verified_by'
  | 'verified_at'
  | 'notes'
  | 'attachments'
  | 'created_by'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
>;

class RecurringTaskInstance
  extends Model<RecurringTaskInstanceAttributes, Creation>
  implements RecurringTaskInstanceAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public board_id!: number;
  public template_id!: number;
  public customer_id!: number;
  public period!: string;
  public period_start!: string;
  public period_end!: string;
  public due_date?: string | null;
  public status!: RecurringInstanceStatus;
  public assigned_user_id?: number | null;
  public reviewer_user_id?: number | null;
  public completed_by?: number | null;
  public completed_at?: Date | null;
  public verified_by?: number | null;
  public verified_at?: Date | null;
  public notes?: string | null;
  public attachments?: any;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

RecurringTaskInstance.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    board_id: { type: DataTypes.INTEGER, allowNull: false },
    template_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    period: { type: DataTypes.STRING(7), allowNull: false },
    period_start: { type: DataTypes.DATEONLY, allowNull: false },
    period_end: { type: DataTypes.DATEONLY, allowNull: false },
    due_date: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'PENDING' },
    assigned_user_id: { type: DataTypes.INTEGER, allowNull: true },
    reviewer_user_id: { type: DataTypes.INTEGER, allowNull: true },
    completed_by: { type: DataTypes.INTEGER, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    verified_by: { type: DataTypes.INTEGER, allowNull: true },
    verified_at: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    attachments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'recurring_task_instances',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default RecurringTaskInstance;
