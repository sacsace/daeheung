import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ContractAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  customer_id: number;
  contract_number: string;
  title: string;
  description?: string;
  contract_type: string;
  contract_value: number;
  start_date: string;
  end_date: string;
  status: string;
  attachments?: string[];
  created_at: Date;
  updated_at: Date;
}

interface ContractCreationAttributes extends Optional<ContractAttributes, 'id' | 'created_at' | 'updated_at'> {}

class Contract extends Model<ContractAttributes, ContractCreationAttributes> implements ContractAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public customer_id!: number;
  public contract_number!: string;
  public title!: string;
  public description?: string;
  public contract_type!: string;
  public contract_value!: number;
  public start_date!: string;
  public end_date!: string;
  public status!: string;
  public attachments?: string[];
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Contract.init(
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
      allowNull: true,
      references: {
        model: 'customers',
        key: 'id',
      },
    },
    contract_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contract_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'sales'
    },
    contract_value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
    attachments: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: []
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
    tableName: 'contracts',
    timestamps: true,
    underscored: true,
  }
);

export default Contract;
