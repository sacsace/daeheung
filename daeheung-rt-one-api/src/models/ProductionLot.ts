import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type LotKind = 'material' | 'finished';
export type LotStatus = 'open' | 'in_process' | 'hold' | 'released' | 'shipped' | 'scrapped';

interface ProductionLotAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  lot_no: string;
  product_id: number;
  lot_kind: LotKind;
  status: LotStatus;
  quantity_on_hand: number;
  location?: string | null;
  produced_on?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

type ProductionLotCreation = Optional<
  ProductionLotAttributes,
  'id' | 'status' | 'quantity_on_hand' | 'location' | 'produced_on' | 'notes' | 'created_by' | 'created_at' | 'updated_at' | 'deleted_at'
>;

class ProductionLot extends Model<ProductionLotAttributes, ProductionLotCreation> implements ProductionLotAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public lot_no!: string;
  public product_id!: number;
  public lot_kind!: LotKind;
  public status!: LotStatus;
  public quantity_on_hand!: number;
  public location?: string | null;
  public produced_on?: string | null;
  public notes?: string | null;
  public created_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

ProductionLot.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    lot_no: { type: DataTypes.STRING(40), allowNull: false },
    product_id: { type: DataTypes.INTEGER, allowNull: false },
    lot_kind: { type: DataTypes.STRING(20), allowNull: false },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'open' },
    quantity_on_hand: { type: DataTypes.DECIMAL(14, 3), allowNull: false, defaultValue: 0 },
    location: { type: DataTypes.STRING(120), allowNull: true },
    produced_on: { type: DataTypes.DATEONLY, allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    sequelize,
    tableName: 'production_lots',
    timestamps: true,
    underscored: true,
    paranoid: true,
  }
);

export default ProductionLot;
