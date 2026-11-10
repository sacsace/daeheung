import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NoticeViewAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  notice_id: number;
  user_id: number;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<NoticeViewAttributes, 'id' | 'created_at' | 'updated_at'>;

class NoticeView extends Model<NoticeViewAttributes, Creation> implements NoticeViewAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public notice_id!: number;
  public user_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NoticeView.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    notice_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    tableName: 'notice_views',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default NoticeView;
