import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NoticePollVoteAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  poll_id: number;
  option_id: number;
  user_id: number;
  created_at?: Date;
  updated_at?: Date;
}

type Creation = Optional<NoticePollVoteAttributes, 'id' | 'created_at' | 'updated_at'>;

class NoticePollVote extends Model<NoticePollVoteAttributes, Creation> implements NoticePollVoteAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public poll_id!: number;
  public option_id!: number;
  public user_id!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NoticePollVote.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    poll_id: { type: DataTypes.INTEGER, allowNull: false },
    option_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    sequelize,
    tableName: 'notice_poll_votes',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default NoticePollVote;
