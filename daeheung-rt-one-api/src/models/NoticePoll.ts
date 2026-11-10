import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NoticePollAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  notice_id: number;
  question: string;
  opens_at?: Date | null;
  closes_at?: Date | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<
  NoticePollAttributes,
  'id' | 'opens_at' | 'closes_at' | 'is_active' | 'created_at' | 'updated_at'
>;

class NoticePoll extends Model<NoticePollAttributes, Creation> implements NoticePollAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public notice_id!: number;
  public question!: string;
  public opens_at?: Date | null;
  public closes_at?: Date | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NoticePoll.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    notice_id: { type: DataTypes.INTEGER, allowNull: false },
    question: { type: DataTypes.STRING(500), allowNull: false },
    opens_at: { type: DataTypes.DATE, allowNull: true },
    closes_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'notice_polls',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default NoticePoll;
