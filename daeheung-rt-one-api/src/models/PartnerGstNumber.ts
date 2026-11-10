import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PartnerGstNumberAttributes {
  id: number;
  partner_id: number;
  gst_number: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface PartnerGstNumberCreationAttributes extends Optional<PartnerGstNumberAttributes, 'id' | 'is_active' | 'created_at' | 'updated_at'> {}

class PartnerGstNumber extends Model<PartnerGstNumberAttributes, PartnerGstNumberCreationAttributes> implements PartnerGstNumberAttributes {
  public id!: number;
  public partner_id!: number;
  public gst_number!: string;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

PartnerGstNumber.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    partner_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'partners',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    gst_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'partner_gst_numbers',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_partner_gst_numbers_partner_id',
        fields: ['partner_id']
      },
      {
        name: 'idx_partner_gst_numbers_gst_number',
        fields: ['gst_number']
      }
    ]
  }
);

export default PartnerGstNumber;




















