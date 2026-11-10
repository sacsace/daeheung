import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AttendanceAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  user_id: number;
  date: Date;
  check_in?: Date;
  check_out?: Date;
  check_in_client_time?: string;
  check_out_client_time?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_in_accuracy?: number;
  work_hours?: number;
  status: 'normal' | 'late' | 'early' | 'overtime' | 'absent';
  notes?: string;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface AttendanceCreationAttributes extends Optional<AttendanceAttributes, 'id' | 'check_in' | 'check_out' | 'work_hours' | 'notes' | 'created_at' | 'updated_at'> {}

class Attendance extends Model<AttendanceAttributes, AttendanceCreationAttributes> implements AttendanceAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public user_id!: number;
  public date!: Date;
  public check_in?: Date;
  public check_out?: Date;
  public check_in_client_time?: string;
  public check_out_client_time?: string;
  public check_in_lat?: number;
  public check_in_lng?: number;
  public check_in_accuracy?: number;
  public work_hours?: number;
  public status!: 'normal' | 'late' | 'early' | 'overtime' | 'absent';
  public notes?: string;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Attendance.init(
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
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    check_in: {
      type: DataTypes.DATE,
      allowNull: true
    },
    check_out: {
      type: DataTypes.DATE,
      allowNull: true
    },
    check_in_client_time: {
      type: DataTypes.STRING,
      allowNull: true
    },
    check_out_client_time: {
      type: DataTypes.STRING,
      allowNull: true
    },
    check_in_lat: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true
    },
    check_in_lng: {
      type: DataTypes.DECIMAL(9, 6),
      allowNull: true
    },
    check_in_accuracy: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true
    },
    work_hours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('normal', 'late', 'early', 'overtime', 'absent'),
      allowNull: false,
      defaultValue: 'normal'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: 'attendances',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['date']
      },
      {
        unique: true,
        fields: ['user_id', 'date']
      }
    ]
  }
);

export default Attendance;







