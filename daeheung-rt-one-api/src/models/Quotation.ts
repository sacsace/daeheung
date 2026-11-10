import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface QuotationAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  is_active: boolean;
  quotation_number: string;
  customer_id?: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  customer_address?: string;
  /** 고객 GSTIN (작성 시점 스냅샷) */
  customer_gst?: string;
  items?: any; // JSON
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number;
  total_amount: number;
  currency: string;
  valid_until?: Date;
  status: 'draft' | 'sent' | 'pending_approval' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  approver_user_id?: number;
  approved_at?: Date;
  /** 승인자 반려 시 사유 */
  rejection_reason?: string;
  notes?: string;
  terms?: string;
  /** 소프트 삭제 시각·실행자 (행은 DB에 유지) */
  deleted_at?: Date;
  deleted_by?: number;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
}

interface QuotationCreationAttributes extends Optional<QuotationAttributes, 'id' | 'items' | 'created_at' | 'updated_at'> {}

class Quotation extends Model<QuotationAttributes, QuotationCreationAttributes> implements QuotationAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public is_active!: boolean;
  public quotation_number!: string;
  public customer_id?: number;
  public customer_name!: string;
  public customer_email?: string;
  public customer_phone?: string;
  public customer_address?: string;
  public customer_gst?: string;
  public items?: any;
  public subtotal!: number;
  public tax_rate!: number;
  public tax_amount!: number;
  public discount!: number;
  public total_amount!: number;
  public currency!: string;
  public valid_until?: Date;
  public status!: 'draft' | 'sent' | 'pending_approval' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  public approver_user_id?: number;
  public approved_at?: Date;
  public rejection_reason?: string;
  public notes?: string;
  public terms?: string;
  public deleted_at?: Date;
  public deleted_by?: number;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Quotation.init(
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
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    quotation_number: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customer_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    customer_email: {
      type: DataTypes.STRING(2000),
      allowNull: true
    },
    customer_phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    customer_address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    customer_gst: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    items: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    tax_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    discount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'KRW'
    },
    valid_until: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'sent', 'pending_approval', 'accepted', 'rejected', 'expired', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft'
    },
    approver_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    terms: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false
    }
  },
  {
    sequelize,
    tableName: 'quotations',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['quotation_number']
      },
      {
        fields: ['customer_id']
      },
      {
        fields: ['status']
      }
    ]
  }
);

export default Quotation;







