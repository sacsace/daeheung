import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ApprovalAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  document_id: string;
  title: string;
  type: string;
  category?: string | null;
  amount?: number;
  requester_id: number;
  description: string;
  attachments?: any; // JSON
  status: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  current_approver_id?: number;
  approval_flow?: any; // JSON
  due_date?: Date;
  comments?: any; // JSON
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface ApprovalCreationAttributes extends Optional<ApprovalAttributes, 'id' | 'attachments' | 'approval_flow' | 'comments' | 'created_at' | 'updated_at'> {}

class Approval extends Model<ApprovalAttributes, ApprovalCreationAttributes> implements ApprovalAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public document_id!: string;
  public title!: string;
  public type!: string;
  public category?: string | null;
  public amount?: number;
  public requester_id!: number;
  public description!: string;
  public attachments?: any;
  public status!: 'draft' | 'submitted' | 'in_review' | 'approved' | 'rejected' | 'cancelled';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public current_approver_id?: number;
  public approval_flow?: any;
  public due_date?: Date;
  public comments?: any;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Approval.init(
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
    document_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: ''
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    requester_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'in_review', 'approved', 'rejected', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    current_approver_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    approval_flow: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    comments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: 'approvals',
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['requester_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['document_id']
      }
    ]
  }
);

export default Approval;







