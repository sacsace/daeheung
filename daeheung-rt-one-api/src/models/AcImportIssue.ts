import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type ImportIssueSeverity = 'ERROR' | 'WARNING' | 'INFO';

interface AcImportIssueAttributes {
  id: number;
  batch_id: number;
  source_document_id?: number | null;
  row_number?: number | null;
  code: string;
  severity: ImportIssueSeverity;
  field_name?: string | null;
  source_value?: string | null;
  message: string;
  suggested_action?: string | null;
  is_resolved: boolean;
  resolved_by?: number | null;
  resolved_at?: Date | null;
}

class AcImportIssue
  extends Model<AcImportIssueAttributes, Optional<AcImportIssueAttributes,
    'id' | 'source_document_id' | 'row_number' | 'field_name' | 'source_value' |
    'suggested_action' | 'resolved_by' | 'resolved_at'
  >>
  implements AcImportIssueAttributes
{
  public id!: number;
  public batch_id!: number;
  public source_document_id?: number | null;
  public row_number?: number | null;
  public code!: string;
  public severity!: ImportIssueSeverity;
  public field_name?: string | null;
  public source_value?: string | null;
  public message!: string;
  public suggested_action?: string | null;
  public is_resolved!: boolean;
  public resolved_by?: number | null;
  public resolved_at?: Date | null;
}

AcImportIssue.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    batch_id: { type: DataTypes.INTEGER, allowNull: false },
    source_document_id: { type: DataTypes.INTEGER, allowNull: true },
    row_number: { type: DataTypes.INTEGER, allowNull: true },
    code: { type: DataTypes.STRING(100), allowNull: false },
    severity: { type: DataTypes.STRING(10), allowNull: false },
    field_name: { type: DataTypes.STRING(100), allowNull: true },
    source_value: { type: DataTypes.TEXT, allowNull: true },
    message: { type: DataTypes.TEXT, allowNull: false },
    suggested_action: { type: DataTypes.TEXT, allowNull: true },
    is_resolved: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    resolved_by: { type: DataTypes.INTEGER, allowNull: true },
    resolved_at: { type: DataTypes.DATE, allowNull: true },
  },
  { sequelize, tableName: 'ac_import_issues', underscored: true, timestamps: true }
);

export default AcImportIssue;
