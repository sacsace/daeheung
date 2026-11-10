import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface NoticeAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  title: string;
  content: string;
  category: 'general' | 'urgent' | 'maintenance' | 'policy' | 'event';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'draft' | 'published' | 'archived';
  is_public: boolean;
  target_audience: 'all' | 'employees' | 'managers' | 'specific';
  author_id: number;
  published_at?: Date;
  expires_at?: Date;
  attachments?: string;
  read_count: number;
  views: number;
  is_active: boolean;
  is_pinned: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface NoticeCreationAttributes extends Optional<NoticeAttributes, 'id' | 'published_at' | 'expires_at' | 'attachments' | 'read_count' | 'views' | 'is_active' | 'created_at' | 'updated_at'> {}

class Notice extends Model<NoticeAttributes, NoticeCreationAttributes> implements NoticeAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public title!: string;
  public content!: string;
  public category!: 'general' | 'urgent' | 'maintenance' | 'policy' | 'event';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public status!: 'draft' | 'published' | 'archived';
  public is_public!: boolean;
  public target_audience!: 'all' | 'employees' | 'managers' | 'specific';
  public author_id!: number;
  public published_at?: Date;
  public expires_at?: Date;
  public attachments?: string;
  public read_count!: number;
  public views!: number;
  public is_active!: boolean;
  public is_pinned!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Notice.init(
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('general', 'urgent', 'maintenance', 'policy', 'event'),
      allowNull: false,
      defaultValue: 'general',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: false,
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.ENUM('draft', 'published', 'archived'),
      allowNull: false,
      defaultValue: 'draft',
    },
    is_public: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    target_audience: {
      type: DataTypes.ENUM('all', 'employees', 'managers', 'specific'),
      allowNull: false,
      defaultValue: 'all',
    },
    author_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    attachments: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    read_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    views: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
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
    tableName: 'notices',
    timestamps: true,
    underscored: true,
  }
);

export default Notice;



