import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EmploymentContractTemplateAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  contract_type: string;
  language: 'ko' | 'en';
  version: number;
  content_html: string;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
  created_at: Date;
  updated_at: Date;
}

interface EmploymentContractTemplateCreationAttributes
  extends Optional<
    EmploymentContractTemplateAttributes,
    'id' | 'version' | 'language' | 'is_active' | 'created_at' | 'updated_at'
  > {}

class EmploymentContractTemplate
  extends Model<EmploymentContractTemplateAttributes, EmploymentContractTemplateCreationAttributes>
  implements EmploymentContractTemplateAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
  public contract_type!: string;
  public language!: 'ko' | 'en';
  public version!: number;
  public content_html!: string;
  public is_active!: boolean;
  public created_by?: number | null;
  public updated_by?: number | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EmploymentContractTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(150), allowNull: false },
    contract_type: { type: DataTypes.STRING(50), allowNull: false, defaultValue: 'regular' },
    language: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'ko' },
    version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    content_html: { type: DataTypes.TEXT, allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    updated_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW }
  },
  {
    sequelize,
    tableName: 'employment_contract_templates',
    timestamps: true,
    underscored: true
  }
);

export default EmploymentContractTemplate;

