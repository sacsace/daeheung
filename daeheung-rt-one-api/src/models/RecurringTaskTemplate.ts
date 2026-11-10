import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type RecurringFrequency =
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'HALF_YEARLY'
  | 'ANNUALLY'
  | 'CUSTOM';

interface RecurringTaskTemplateAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  board_id: number;
  name: string;
  code?: string | null;
  description?: string | null;
  category?: string | null;
  frequency: RecurringFrequency;
  default_priority: string;
  default_due_day?: number | null;
  requires_attachment: boolean;
  requires_verification: boolean;
  sort_order: number;
  is_active: boolean;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type Creation = Optional<
  RecurringTaskTemplateAttributes,
  | 'id'
  | 'code'
  | 'description'
  | 'category'
  | 'frequency'
  | 'default_priority'
  | 'default_due_day'
  | 'requires_attachment'
  | 'requires_verification'
  | 'sort_order'
  | 'is_active'
  | 'created_by'
  | 'created_at'
  | 'updated_at'
  | 'deleted_at'
>;

class RecurringTaskTemplate
  extends Model<RecurringTaskTemplateAttributes, Creation>
  implements RecurringTaskTemplateAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public board_id!: number;
  public name!: string;
  public code?: string | null;
  public description?: string | null;
  public category?: string | null;
  public frequency!: RecurringFrequency;
  public default_priority!: string;
  public default_due_day?: number | null;
  public requires_attachment!: boolean;
  public requires_verification!: boolean;
  public sort_order!: number;
  public is_active!: boolean;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

RecurringTaskTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    board_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    code: { type: DataTypes.STRING(50), allowNull: true },
    description: { type: DataTypes.TEXT, allowNull: true },
    category: { type: DataTypes.STRING(100), allowNull: true },
    frequency: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'MONTHLY' },
    default_priority: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'medium' },
    default_due_day: { type: DataTypes.INTEGER, allowNull: true },
    requires_attachment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    requires_verification: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'recurring_task_templates',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default RecurringTaskTemplate;
