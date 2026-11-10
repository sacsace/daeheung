import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ImportAmountMode = 'separate_columns' | 'amount_indicator';

interface AcImportTemplateAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  source_system: string;
  name: string;
  file_format: string;
  sheet_name?: string | null;
  header_row_number: number;
  column_mapping: Record<string, unknown>;
  document_group_keys: string[];
  amount_mode: ImportAmountMode;
  debit_credit_config: Record<string, unknown>;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
}

class AcImportTemplate
  extends Model<AcImportTemplateAttributes, Optional<AcImportTemplateAttributes, 'id' | 'sheet_name' | 'created_by' | 'updated_by'>>
  implements AcImportTemplateAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public source_system!: string;
  public name!: string;
  public file_format!: string;
  public sheet_name?: string | null;
  public header_row_number!: number;
  public column_mapping!: Record<string, unknown>;
  public document_group_keys!: string[];
  public amount_mode!: ImportAmountMode;
  public debit_credit_config!: Record<string, unknown>;
  public is_active!: boolean;
  public created_by?: number | null;
  public updated_by?: number | null;
}

AcImportTemplate.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    source_system: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'sap' },
    name: { type: DataTypes.STRING(120), allowNull: false },
    file_format: { type: DataTypes.STRING(10), allowNull: false },
    sheet_name: { type: DataTypes.STRING(120), allowNull: true },
    header_row_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    column_mapping: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    document_group_keys: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: ['companyCode', 'fiscalYear', 'documentNumber'],
    },
    amount_mode: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'separate_columns' },
    debit_credit_config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'ac_import_templates', underscored: true, timestamps: true }
);

export default AcImportTemplate;
