import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcVoucherTypeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  code: string;
  name_ko: string;
  name_en?: string | null;
  prefix: string;
  category: string;
  icon?: string | null;
  legacy_type?: string | null;
  requires_party: boolean;
  requires_attachment: boolean;
  requires_narration: boolean;
  approval_required: boolean;
  sort_order: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AcVoucherTypeCreationAttributes
  extends Optional<
    AcVoucherTypeAttributes,
    | 'id'
    | 'name_en'
    | 'icon'
    | 'legacy_type'
    | 'requires_party'
    | 'requires_attachment'
    | 'requires_narration'
    | 'approval_required'
    | 'sort_order'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AcVoucherType extends Model<AcVoucherTypeAttributes, AcVoucherTypeCreationAttributes> implements AcVoucherTypeAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public code!: string;
  public name_ko!: string;
  public name_en?: string | null;
  public prefix!: string;
  public category!: string;
  public icon?: string | null;
  public legacy_type?: string | null;
  public requires_party!: boolean;
  public requires_attachment!: boolean;
  public requires_narration!: boolean;
  public approval_required!: boolean;
  public sort_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AcVoucherType.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    code: { type: DataTypes.STRING(20), allowNull: false },
    name_ko: { type: DataTypes.STRING(100), allowNull: false },
    name_en: { type: DataTypes.STRING(100), allowNull: true },
    prefix: { type: DataTypes.STRING(20), allowNull: false },
    category: { type: DataTypes.STRING(30), allowNull: false },
    icon: { type: DataTypes.STRING(50), allowNull: true },
    legacy_type: { type: DataTypes.STRING(20), allowNull: true },
    requires_party: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    requires_attachment: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    requires_narration: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    approval_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  { sequelize, tableName: 'ac_voucher_types', underscored: true, timestamps: true }
);

export default AcVoucherType;
