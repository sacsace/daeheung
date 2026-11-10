import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface BudgetAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  budget_id: string;
  name: string;
  type: 'annual' | 'quarterly' | 'monthly' | 'project';
  period: string;
  start_date: string;
  end_date: string;
  total_planned: number;
  total_actual: number;
  total_variance: number;
  variance_percentage: number;
  status: 'draft' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
  items?: any;
  created_by?: string;
  notes?: string;
  approved_by?: string;
  approved_at?: Date;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface BudgetCreationAttributes extends Optional<
  BudgetAttributes,
  | 'id'
  | 'items'
  | 'created_by'
  | 'notes'
  | 'approved_by'
  | 'approved_at'
  | 'is_active'
  | 'created_at'
  | 'updated_at'
> {}

class Budget extends Model<BudgetAttributes, BudgetCreationAttributes> implements BudgetAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public budget_id!: string;
  public name!: string;
  public type!: 'annual' | 'quarterly' | 'monthly' | 'project';
  public period!: string;
  public start_date!: string;
  public end_date!: string;
  public total_planned!: number;
  public total_actual!: number;
  public total_variance!: number;
  public variance_percentage!: number;
  public status!: 'draft' | 'pending' | 'approved' | 'active' | 'completed' | 'cancelled';
  public items?: any;
  public created_by?: string;
  public notes?: string;
  public approved_by?: string;
  public approved_at?: Date;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Budget.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    budget_id: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    name: { type: DataTypes.STRING(255), allowNull: false },
    type: { type: DataTypes.ENUM('annual', 'quarterly', 'monthly', 'project'), allowNull: false },
    period: { type: DataTypes.STRING(20), allowNull: false },
    start_date: { type: DataTypes.DATEONLY, allowNull: false },
    end_date: { type: DataTypes.DATEONLY, allowNull: false },
    total_planned: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total_actual: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    total_variance: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
    variance_percentage: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    status: {
      type: DataTypes.ENUM('draft', 'pending', 'approved', 'active', 'completed', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft'
    },
    items: { type: DataTypes.JSONB, allowNull: true, defaultValue: '[]' },
    created_by: { type: DataTypes.STRING(100), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    approved_by: { type: DataTypes.STRING(100), allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
  },
  {
    sequelize,
    tableName: 'budgets',
    indexes: [
      { fields: ['tenant_id', 'company_id'] },
      { fields: ['budget_id'] },
      { fields: ['status'] }
    ]
  }
);

export default Budget;
