import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ImportMappingStatus = 'suggested' | 'approved' | 'rejected' | 'inactive';
export type ImportMappingSource = 'source_file' | 'mapping_rule' | 'ai' | 'user_override' | 'system';

interface AcImportMappingAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  source_system: string;
  mapping_type: string;
  source_code?: string | null;
  source_name?: string | null;
  normalized_source_value?: string | null;
  target_account_id?: number | null;
  target_partner_id?: number | null;
  target_gst_code_id?: number | null;
  status: ImportMappingStatus;
  confidence_score?: number | null;
  mapping_source: ImportMappingSource;
  reason?: string | null;
  approved_by?: number | null;
  approved_at?: Date | null;
  is_active: boolean;
  created_by?: number | null;
  updated_by?: number | null;
}

class AcImportMapping
  extends Model<AcImportMappingAttributes, Optional<AcImportMappingAttributes,
    'id' | 'source_code' | 'source_name' | 'normalized_source_value' | 'target_account_id' |
    'target_partner_id' | 'target_gst_code_id' | 'confidence_score' | 'reason' | 'approved_by' |
    'approved_at' | 'created_by' | 'updated_by'
  >>
  implements AcImportMappingAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public source_system!: string;
  public mapping_type!: string;
  public source_code?: string | null;
  public source_name?: string | null;
  public normalized_source_value?: string | null;
  public target_account_id?: number | null;
  public target_partner_id?: number | null;
  public target_gst_code_id?: number | null;
  public status!: ImportMappingStatus;
  public confidence_score?: number | null;
  public mapping_source!: ImportMappingSource;
  public reason?: string | null;
  public approved_by?: number | null;
  public approved_at?: Date | null;
  public is_active!: boolean;
  public created_by?: number | null;
  public updated_by?: number | null;
}

AcImportMapping.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    source_system: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'sap' },
    mapping_type: { type: DataTypes.STRING(30), allowNull: false },
    source_code: { type: DataTypes.STRING(120), allowNull: true },
    source_name: { type: DataTypes.STRING(255), allowNull: true },
    normalized_source_value: { type: DataTypes.STRING(255), allowNull: true },
    target_account_id: { type: DataTypes.INTEGER, allowNull: true },
    target_partner_id: { type: DataTypes.INTEGER, allowNull: true },
    target_gst_code_id: { type: DataTypes.INTEGER, allowNull: true },
    status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'suggested' },
    confidence_score: { type: DataTypes.DECIMAL(5, 2), allowNull: true },
    mapping_source: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'system' },
    reason: { type: DataTypes.TEXT, allowNull: true },
    approved_by: { type: DataTypes.INTEGER, allowNull: true },
    approved_at: { type: DataTypes.DATE, allowNull: true },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'ac_import_mappings', underscored: true, timestamps: true }
);

export default AcImportMapping;
