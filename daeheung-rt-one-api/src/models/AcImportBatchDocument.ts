import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AcImportBatchDocumentAttributes {
  id: number;
  batch_id: number;
  source_document_id: number;
  first_row_number?: number | null;
  row_count: number;
  status: string;
  validation_summary: Record<string, unknown>;
  override_values: Record<string, unknown>;
  source_fields: Record<string, string>;
}

class AcImportBatchDocument
  extends Model<AcImportBatchDocumentAttributes, Optional<AcImportBatchDocumentAttributes, 'id' | 'first_row_number'>>
  implements AcImportBatchDocumentAttributes
{
  public id!: number;
  public batch_id!: number;
  public source_document_id!: number;
  public first_row_number?: number | null;
  public row_count!: number;
  public status!: string;
  public validation_summary!: Record<string, unknown>;
  public override_values!: Record<string, unknown>;
  public source_fields!: Record<string, string>;
}

AcImportBatchDocument.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    batch_id: { type: DataTypes.INTEGER, allowNull: false },
    source_document_id: { type: DataTypes.INTEGER, allowNull: false },
    first_row_number: { type: DataTypes.INTEGER, allowNull: true },
    row_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'parsed' },
    validation_summary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    override_values: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    source_fields: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  },
  { sequelize, tableName: 'ac_import_batch_documents', underscored: true, timestamps: true }
);

export default AcImportBatchDocument;
