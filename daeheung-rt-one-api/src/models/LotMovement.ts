import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type LotMovementType = 'receive' | 'produce' | 'consume' | 'ship';

interface LotMovementAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  lot_id: number;
  movement_type: LotMovementType;
  quantity: number;
  related_lot_id?: number | null;
  notes?: string | null;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type LotMovementCreation = Optional<
  LotMovementAttributes,
  'id' | 'related_lot_id' | 'notes' | 'created_by' | 'created_at' | 'updated_at' | 'deleted_at'
>;

class LotMovement extends Model<LotMovementAttributes, LotMovementCreation> implements LotMovementAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public lot_id!: number;
  public movement_type!: LotMovementType;
  public quantity!: number;
  public related_lot_id?: number | null;
  public notes?: string | null;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

LotMovement.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    lot_id: { type: DataTypes.INTEGER, allowNull: false },
    movement_type: { type: DataTypes.STRING(20), allowNull: false },
    quantity: { type: DataTypes.DECIMAL(14, 3), allowNull: false },
    related_lot_id: { type: DataTypes.INTEGER, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'lot_movements',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default LotMovement;
