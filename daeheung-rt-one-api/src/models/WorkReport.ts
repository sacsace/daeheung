import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WorkReportAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  report_id: string;
  title: string;
  type: 'daily' | 'weekly' | 'monthly' | 'project' | 'incident' | 'other';
  category?: string | null;
  author_id: number;
  recipient_id?: number | null;
  /** 참조(CC): 같은 회사 사용자 id 배열 — 열람·피드백만, 정식 수신자와 달리 승인 불가 */
  cc_user_ids?: number[] | null;
  content: string;
  summary?: string | null;
  achievements?: any; // JSON array
  challenges?: any; // JSON array
  next_steps?: any; // JSON array
  attachments?: any; // JSON array
  status: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  report_date: Date;
  due_date?: Date;
  reviewer_id?: number;
  review_comment?: string;
  reviewed_at?: Date;
  tags?: any; // JSON array
  is_public: boolean;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface WorkReportCreationAttributes
  extends Optional<
    WorkReportAttributes,
    | 'id'
    | 'category'
    | 'summary'
    | 'recipient_id'
    | 'cc_user_ids'
    | 'achievements'
    | 'challenges'
    | 'next_steps'
    | 'attachments'
    | 'tags'
    | 'created_at'
    | 'updated_at'
  > {}

class WorkReport extends Model<WorkReportAttributes, WorkReportCreationAttributes> implements WorkReportAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public report_id!: string;
  public title!: string;
  public type!: 'daily' | 'weekly' | 'monthly' | 'project' | 'incident' | 'other';
  public category?: string | null;
  public author_id!: number;
  public recipient_id?: number | null;
  public cc_user_ids?: number[] | null;
  public content!: string;
  public summary?: string | null;
  public achievements?: any;
  public challenges?: any;
  public next_steps?: any;
  public attachments?: any;
  public status!: 'draft' | 'submitted' | 'reviewed' | 'approved' | 'rejected';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public report_date!: Date;
  public due_date?: Date;
  public reviewer_id?: number;
  public review_comment?: string;
  public reviewed_at?: Date;
  public tags?: any;
  public is_public!: boolean;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

WorkReport.init(
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
    report_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'project', 'incident', 'other'),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: ''
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    recipient_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    cc_user_ids: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    summary: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: ''
    },
    achievements: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    challenges: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    next_steps: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    status: {
      type: DataTypes.ENUM('draft', 'submitted', 'reviewed', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'draft'
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium'
    },
    report_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    reviewer_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    review_comment: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    tags: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: '[]'
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: 'work_reports',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['report_id']
      },
      {
        fields: ['author_id']
      },
      {
        fields: ['status']
      },
      {
        fields: ['report_date']
      }
    ]
  }
);

export default WorkReport;




