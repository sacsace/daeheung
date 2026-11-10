import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NoticePollOptionAttributes {
  id: number;
  poll_id: number;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<NoticePollOptionAttributes, 'id' | 'sort_order' | 'is_active' | 'created_at' | 'updated_at'>;

class NoticePollOption
  extends Model<NoticePollOptionAttributes, Creation>
  implements NoticePollOptionAttributes
{
  public id!: number;
  public poll_id!: number;
  public label!: string;
  public sort_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NoticePollOption.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    poll_id: { type: DataTypes.INTEGER, allowNull: false },
    label: { type: DataTypes.STRING(300), allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'notice_poll_options',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default NoticePollOption;
