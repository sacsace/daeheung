import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RecurringBoardClientAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  board_id: number;
  customer_id: number;
  is_active: boolean;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type Creation = Optional<
  RecurringBoardClientAttributes,
  'id' | 'is_active' | 'created_by' | 'created_at' | 'updated_at' | 'deleted_at'
>;

class RecurringBoardClient
  extends Model<RecurringBoardClientAttributes, Creation>
  implements RecurringBoardClientAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public board_id!: number;
  public customer_id!: number;
  public is_active!: boolean;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

RecurringBoardClient.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    board_id: { type: DataTypes.INTEGER, allowNull: false },
    customer_id: { type: DataTypes.INTEGER, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'recurring_board_clients',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default RecurringBoardClient;
