import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ImportBatchStatus =
  | 'uploaded'
  | 'parsing'
  | 'parsed'
  | 'mapping_required'
  | 'validating'
  | 'validated'
  | 'converting'
  | 'converted'
  | 'failed'
  | 'cancelled';

interface AcImportBatchAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  financial_year_id?: number | null;
  template_id?: number | null;
  source_system: string;
  source_company_code?: string | null;
  file_name: string;
  file_path?: string | null;
  file_mime_type?: string | null;
  file_size_bytes?: string | null;
  file_sha256: string;
  status: ImportBatchStatus;
  total_rows: number;
  total_documents: number;
  valid_documents: number;
  warning_count: number;
  error_count: number;
  mapping_required_count: number;
  converted_documents: number;
  started_at?: Date | null;
  completed_at?: Date | null;
  cancelled_at?: Date | null;
  failure_detail?: Record<string, unknown> | null;
  created_by?: number | null;
  updated_by?: number | null;
}

class AcImportBatch
  extends Model<AcImportBatchAttributes, Optional<AcImportBatchAttributes,
    'id' | 'financial_year_id' | 'template_id' | 'source_company_code' | 'file_path' | 'file_mime_type' |
    'file_size_bytes' | 'started_at' | 'completed_at' | 'cancelled_at' | 'failure_detail' | 'created_by' | 'updated_by'
  >>
  implements AcImportBatchAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public financial_year_id?: number | null;
  public template_id?: number | null;
  public source_system!: string;
  public source_company_code?: string | null;
  public file_name!: string;
  public file_path?: string | null;
  public file_mime_type?: string | null;
  public file_size_bytes?: string | null;
  public file_sha256!: string;
  public status!: ImportBatchStatus;
  public total_rows!: number;
  public total_documents!: number;
  public valid_documents!: number;
  public warning_count!: number;
  public error_count!: number;
  public mapping_required_count!: number;
  public converted_documents!: number;
  public started_at?: Date | null;
  public completed_at?: Date | null;
  public cancelled_at?: Date | null;
  public failure_detail?: Record<string, unknown> | null;
  public created_by?: number | null;
  public updated_by?: number | null;
}

AcImportBatch.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    financial_year_id: { type: DataTypes.INTEGER, allowNull: true },
    template_id: { type: DataTypes.INTEGER, allowNull: true },
    source_system: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'sap' },
    source_company_code: { type: DataTypes.STRING(50), allowNull: true },
    file_name: { type: DataTypes.STRING(255), allowNull: false },
    file_path: { type: DataTypes.STRING(500), allowNull: true },
    file_mime_type: { type: DataTypes.STRING(120), allowNull: true },
    file_size_bytes: { type: DataTypes.BIGINT, allowNull: true },
    file_sha256: { type: DataTypes.STRING(64), allowNull: false },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'uploaded' },
    total_rows: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    total_documents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    valid_documents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    warning_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    error_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    mapping_required_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    converted_documents: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    cancelled_at: { type: DataTypes.DATE, allowNull: true },
    failure_detail: { type: DataTypes.JSONB, allowNull: true },
    created_by: { type: DataTypes.INTEGER, allowNull: true },
    updated_by: { type: DataTypes.INTEGER, allowNull: true },
  },
  { sequelize, tableName: 'ac_import_batches', underscored: true, timestamps: true }
);

export default AcImportBatch;
