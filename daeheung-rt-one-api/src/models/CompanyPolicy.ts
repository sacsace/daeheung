import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface CompanyPolicyAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  policy_key: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  version: number;
  updated_by?: number | null;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

type CompanyPolicyCreation = Optional<
  CompanyPolicyAttributes,
  'id' | 'version' | 'updated_by' | 'is_active' | 'created_at' | 'updated_at'
>;

class CompanyPolicy
  extends Model<CompanyPolicyAttributes, CompanyPolicyCreation>
  implements CompanyPolicyAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public policy_key!: string;
  public title_ko!: string;
  public title_en!: string;
  public content_ko!: string;
  public content_en!: string;
  public version!: number;
  public updated_by?: number | null;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CompanyPolicy.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    policy_key: { type: DataTypes.STRING(64), allowNull: false },
    title_ko: { type: DataTypes.STRING(200), allowNull: false },
    title_en: { type: DataTypes.STRING(200), allowNull: false },
    content_ko: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    content_en: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'company_policies',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['tenant_id', 'company_id', 'policy_key'],
        name: 'company_policies_tenant_company_key_uk',
      },
    ],
  }
);

export default CompanyPolicy;
