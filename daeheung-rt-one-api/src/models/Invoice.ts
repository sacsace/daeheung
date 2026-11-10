import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface InvoiceAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  customer_id: number;
  is_active: boolean;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  payment_date?: string;
  notes?: string;
  invoice_category?: string;
  gst_irn?: string | null;
  gst_ack_no?: string | null;
  gst_ack_date?: string | null;
  signed_qr_code?: string | null;
  irp_status?: string;
  irp_last_error?: string | null;
  irp_submitted_at?: Date | null;
  transaction_type?: string;
  gst_einvoice_payload?: Record<string, unknown> | null;
  approver_user_id?: number | null;
  approved_at?: Date | null;
  /** null: 구 데이터(이메일·IRN 허용), pending_approval | approved | rejected */
  approval_status?: string | null;
  created_by: number;
  created_at: Date;
  updated_at: Date;
}

interface InvoiceCreationAttributes extends Optional<InvoiceAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Invoice extends Model<InvoiceAttributes, InvoiceCreationAttributes> implements InvoiceAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public customer_id!: number;
  public is_active!: boolean;
  public invoice_number!: string;
  public invoice_date!: string;
  public due_date!: string;
  public subtotal!: number;
  public tax_amount!: number;
  public total_amount!: number;
  public status!: string;
  public payment_status!: string;
  public payment_method?: string;
  public payment_date?: string;
  public notes?: string;
  public invoice_category?: string;
  public gst_irn?: string | null;
  public gst_ack_no?: string | null;
  public gst_ack_date?: string | null;
  public signed_qr_code?: string | null;
  public irp_status?: string;
  public irp_last_error?: string | null;
  public irp_submitted_at?: Date | null;
  public transaction_type?: string;
  public gst_einvoice_payload?: Record<string, unknown> | null;
  public approver_user_id?: number | null;
  public approved_at?: Date | null;
  public approval_status?: string | null;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Invoice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id',
      },
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'companies',
        key: 'id',
      },
    },
    customer_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    invoice_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    invoice_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'draft',
    },
    payment_status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'pending',
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    payment_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    invoice_category: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'regular',
    },
    gst_irn: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    gst_ack_no: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    gst_ack_date: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    signed_qr_code: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    irp_status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'draft',
    },
    irp_last_error: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    irp_submitted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    transaction_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'B2B',
    },
    gst_einvoice_payload: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    approver_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    },
    approved_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approval_status: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'invoices',
    timestamps: true,
    underscored: true,
  }
);

export default Invoice;
