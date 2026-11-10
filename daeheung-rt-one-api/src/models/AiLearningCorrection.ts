import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AiLearningCorrectionAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id?: number | null;
  source_type: string;
  source_id?: number | null;
  counterparty_name?: string | null;
  keyword?: string | null;
  doc_type?: string | null;
  field_name: string;
  before_value?: string | null;
  after_value?: string | null;
  recommendation_snapshot: Record<string, unknown>;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AiLearningCorrectionCreationAttributes
  extends Optional<
    AiLearningCorrectionAttributes,
    | 'id'
    | 'user_id'
    | 'source_id'
    | 'counterparty_name'
    | 'keyword'
    | 'doc_type'
    | 'before_value'
    | 'after_value'
    | 'recommendation_snapshot'
    | 'is_active'
    | 'created_at'
    | 'updated_at'
  > {}

class AiLearningCorrection
  extends Model<AiLearningCorrectionAttributes, AiLearningCorrectionCreationAttributes>
  implements AiLearningCorrectionAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id?: number | null;
  public source_type!: string;
  public source_id?: number | null;
  public counterparty_name?: string | null;
  public keyword?: string | null;
  public doc_type?: string | null;
  public field_name!: string;
  public before_value?: string | null;
  public after_value?: string | null;
  public recommendation_snapshot!: Record<string, unknown>;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

AiLearningCorrection.init(
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    user_id: { type: DataTypes.INTEGER, allowNull: true },
    source_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'auto_voucher' },
    source_id: { type: DataTypes.INTEGER, allowNull: true },
    counterparty_name: { type: DataTypes.STRING(255), allowNull: true },
    keyword: { type: DataTypes.STRING(120), allowNull: true },
    doc_type: { type: DataTypes.STRING(40), allowNull: true },
    field_name: { type: DataTypes.STRING(60), allowNull: false },
    before_value: { type: DataTypes.TEXT, allowNull: true },
    after_value: { type: DataTypes.TEXT, allowNull: true },
    recommendation_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    sequelize,
    tableName: 'ai_learning_corrections',
    underscored: true,
    timestamps: true,
  }
);

export default AiLearningCorrection;
