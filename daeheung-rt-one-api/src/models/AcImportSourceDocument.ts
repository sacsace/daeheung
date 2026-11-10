import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcImportSourceDocumentAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  source_system: string;
  source_company_code?: string | null;
  fiscal_year?: string | null;
  source_document_number: string;
  source_document_key: string;
  source_posting_date?: string | null;
  raw_document: Record<string, unknown>;
  normalized_document: Record<string, unknown>;
  latest_file_sha256?: string | null;
  status: string;
  voucher_id?: number | null;
  source_correlation_id: string;
  is_active: boolean;
}

class AcImportSourceDocument
  extends Model<AcImportSourceDocumentAttributes, Optional<AcImportSourceDocumentAttributes,
    'id' | 'source_company_code' | 'fiscal_year' | 'source_posting_date' | 'latest_file_sha256' | 'voucher_id'
  >>
  implements AcImportSourceDocumentAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public source_system!: string;
  public source_company_code?: string | null;
  public fiscal_year?: string | null;
  public source_document_number!: string;
  public source_document_key!: string;
  public source_posting_date?: string | null;
  public raw_document!: Record<string, unknown>;
  public normalized_document!: Record<string, unknown>;
  public latest_file_sha256?: string | null;
  public status!: string;
  public voucher_id?: number | null;
  public source_correlation_id!: string;
  public is_active!: boolean;
}

AcImportSourceDocument.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    source_system: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'sap' },
    source_company_code: { type: DataTypes.STRING(50), allowNull: true, defaultValue: '' },
    fiscal_year: { type: DataTypes.STRING(20), allowNull: true, defaultValue: '' },
    source_document_number: { type: DataTypes.STRING(80), allowNull: false },
    source_document_key: { type: DataTypes.STRING(255), allowNull: false },
    source_posting_date: { type: DataTypes.DATEONLY, allowNull: true },
    raw_document: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    normalized_document: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    latest_file_sha256: { type: DataTypes.STRING(64), allowNull: true },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'parsed' },
    voucher_id: { type: DataTypes.INTEGER, allowNull: true },
    source_correlation_id: { type: DataTypes.STRING(80), allowNull: false },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'ac_import_source_documents',
    underscored: true,
    timestamps: true,
    hooks: {
      beforeValidate: (row: AcImportSourceDocument) => {
        if (row.source_company_code == null || row.source_company_code === '') {
          row.source_company_code = row.source_system === 'tally' ? 'TALLY' : 'NA';
        }
        if (row.fiscal_year == null || row.fiscal_year === '') {
          row.fiscal_year = 'NA';
        }
      },
    },
  }
);

export default AcImportSourceDocument;
