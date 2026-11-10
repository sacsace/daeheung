import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CompanyCalendarScheduleAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  schedule_date: string;
  title: string;
  is_holiday: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

type CompanyCalendarScheduleCreation = Optional<
  CompanyCalendarScheduleAttributes,
  'id' | 'is_holiday' | 'created_by' | 'updated_by' | 'is_active' | 'created_at' | 'updated_at'
>;

class CompanyCalendarSchedule
  extends Model<CompanyCalendarScheduleAttributes, CompanyCalendarScheduleCreation>
  implements CompanyCalendarScheduleAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public schedule_date!: string;
  public title!: string;
  public is_holiday!: boolean;
  public created_by?: number | null;
  public updated_by?: number | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CompanyCalendarSchedule.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    schedule_date: { type: DataTypes.DATEONLY, allowNull: false },
    title: { type: DataTypes.STRING(255), allowNull: false },
    is_holiday: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'company_calendar_schedules',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default CompanyCalendarSchedule;
