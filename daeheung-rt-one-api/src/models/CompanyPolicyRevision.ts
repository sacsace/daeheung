import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface CompanyPolicyRevisionAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  policy_id: number;
  policy_key: string;
  version: number;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
  change_summary?: string | null;
  changed_by?: number | null;
  created_at?: Date;
  updated_at?: Date;
}

type CompanyPolicyRevisionCreation = Optional<
  CompanyPolicyRevisionAttributes,
  'id' | 'change_summary' | 'changed_by' | 'created_at' | 'updated_at'
>;

class CompanyPolicyRevision
  extends Model<CompanyPolicyRevisionAttributes, CompanyPolicyRevisionCreation>
  implements CompanyPolicyRevisionAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public policy_id!: number;
  public policy_key!: string;
  public version!: number;
  public title_ko!: string;
  public title_en!: string;
  public content_ko!: string;
  public content_en!: string;
  public change_summary?: string | null;
  public changed_by!: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

CompanyPolicyRevision.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    policy_id: { type: DataTypes.INTEGER, allowNull: false },
    policy_key: { type: DataTypes.STRING(64), allowNull: false },
    version: { type: DataTypes.INTEGER, allowNull: false },
    title_ko: { type: DataTypes.STRING(200), allowNull: false },
    title_en: { type: DataTypes.STRING(200), allowNull: false },
    content_ko: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    content_en: { type: DataTypes.TEXT, allowNull: false, defaultValue: '' },
    change_summary: { type: DataTypes.STRING(500), allowNull: true },
    changed_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  {
    sequelize,
    tableName: 'company_policy_revisions',
    timestamps: true,
    underscored: true,
    updatedAt: false,
    indexes: [
      {
        fields: ['policy_id', 'version'],
        name: 'company_policy_revisions_policy_version_idx',
      },
      {
        fields: ['tenant_id', 'company_id', 'policy_key'],
        name: 'company_policy_revisions_scope_key_idx',
      },
    ],
  }
);

export default CompanyPolicyRevision;
