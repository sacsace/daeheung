import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SupportResponseAttributes {
  id: number;
  ticket_id: number;
  user_id: number;
  response: string;
  created_at: Date;
  updated_at: Date;
}

interface SupportResponseCreationAttributes extends Optional<SupportResponseAttributes, 'id' | 'created_at' | 'updated_at'> {}

class SupportResponse extends Model<SupportResponseAttributes, SupportResponseCreationAttributes> implements SupportResponseAttributes {
  public id!: number;
  public ticket_id!: number;
  public user_id!: number;
  public response!: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

SupportResponse.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    ticket_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'support_tickets',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    response: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'support_responses',
    timestamps: true,
    underscored: true,
  }
);

export default SupportResponse;
