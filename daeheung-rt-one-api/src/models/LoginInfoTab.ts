import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface LoginInfoTabAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  sort_order: number;
  /** 그리드 열 헤더 커스텀 라벨 (필드키 → 표시명) */
  column_headers?: Record<string, string> | null;
  /** 숨긴 데이터 열 필드명 배열 (division, login_id, …) — 레거시; column_schema 우선 */
  column_hidden?: string[] | null;
  /** 열 구성(순서·내장/커스텀). 있으면 column_hidden보다 우선 */
  column_schema?: { columns: unknown[] } | null;
  created_at?: Date;
  updated_at?: Date;
}

interface LoginInfoTabCreationAttributes
  extends Optional<
    LoginInfoTabAttributes,
    'id' | 'sort_order' | 'column_headers' | 'column_hidden' | 'column_schema' | 'created_at' | 'updated_at'
  > {}

class LoginInfoTab
  extends Model<LoginInfoTabAttributes, LoginInfoTabCreationAttributes>
  implements LoginInfoTabAttributes
{
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
  public sort_order!: number;
  public column_headers?: Record<string, string> | null;
  public column_hidden?: string[] | null;
  public column_schema?: { columns: unknown[] } | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

LoginInfoTab.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false
    },
    sort_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    column_headers: {
      type: DataTypes.JSON,
      allowNull: true
    },
    column_hidden: {
      type: DataTypes.JSON,
      allowNull: true
    },
    column_schema: {
      type: DataTypes.JSON,
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: 'login_info_tabs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['tenant_id'] },
      { fields: ['company_id'] },
      { fields: ['company_id', 'sort_order'] }
    ]
  }
);

export default LoginInfoTab;
