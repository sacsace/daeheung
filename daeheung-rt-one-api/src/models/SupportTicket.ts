import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface SupportTicketAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  customer_id: number;
  ticket_number: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assigned_to?: number;
  created_at: Date;
  updated_at: Date;
  last_response_at?: Date;
}

interface SupportTicketCreationAttributes extends Optional<SupportTicketAttributes, 'id' | 'created_at' | 'updated_at' | 'last_response_at'> {}

class SupportTicket extends Model<SupportTicketAttributes, SupportTicketCreationAttributes> implements SupportTicketAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public customer_id!: number;
  public ticket_number!: string;
  public title!: string;
  public description!: string;
  public category!: string;
  public priority!: string;
  public status!: string;
  public assigned_to?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public last_response_at?: Date;
}

SupportTicket.init(
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
    ticket_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'general',
    },
    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'medium',
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'open',
    },
    assigned_to: {
      type: DataTypes.INTEGER,
      allowNull: true,
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
    last_response_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'support_tickets',
    timestamps: true,
    underscored: true,
  }
);

export default SupportTicket;
