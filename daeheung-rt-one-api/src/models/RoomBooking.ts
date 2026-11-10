import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomBookingAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  booking_id: string;
  room_id: number;
  room_number: string;
  room_type: string;
  user_id: number;
  guest_name: string;
  company_name?: string;
  guest_email?: string;
  guest_phone?: string;
  check_in_date: Date;
  check_in_time?: string;
  check_out_date: Date;
  check_out_time?: string;
  number_of_guests: number;
  total_nights: number;
  total_amount: number;
  status: 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out' | 'no_show';
  payment_status: 'pending' | 'paid' | 'refunded' | 'partial';
  payment_method?: string;
  special_requests?: string;
  airport_pickup?: boolean;
  airport_arrival_time?: string;
  flight_number?: string;
  created_by: number;
  is_active?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface RoomBookingCreationAttributes extends Optional<RoomBookingAttributes, 'id' | 'created_at' | 'updated_at'> {}

class RoomBooking extends Model<RoomBookingAttributes, RoomBookingCreationAttributes> implements RoomBookingAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public booking_id!: string;
  public room_id!: number;
  public room_number!: string;
  public room_type!: string;
  public user_id!: number;
  public guest_name!: string;
  public company_name?: string;
  public guest_email?: string;
  public guest_phone?: string;
  public check_in_date!: Date;
  public check_in_time?: string;
  public check_out_date!: Date;
  public check_out_time?: string;
  public number_of_guests!: number;
  public total_nights!: number;
  public total_amount!: number;
  public status!: 'confirmed' | 'pending' | 'cancelled' | 'checked_in' | 'checked_out' | 'no_show';
  public payment_status!: 'pending' | 'paid' | 'refunded' | 'partial';
  public payment_method?: string;
  public special_requests?: string;
  public airport_pickup?: boolean;
  public airport_arrival_time?: string;
  public flight_number?: string;
  public created_by!: number;
  public is_active?: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

RoomBooking.init(
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
    booking_id: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    room_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    room_number: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    room_type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    guest_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    company_name: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    guest_email: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    guest_phone: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    check_in_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    check_in_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    check_out_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    check_out_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    number_of_guests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    total_nights: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('confirmed', 'pending', 'cancelled', 'checked_in', 'checked_out', 'no_show'),
      allowNull: false,
      defaultValue: 'pending'
    },
    payment_status: {
      type: DataTypes.ENUM('pending', 'paid', 'refunded', 'partial'),
      allowNull: false,
      defaultValue: 'pending'
    },
    payment_method: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    special_requests: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    airport_pickup: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    airport_arrival_time: {
      type: DataTypes.TIME,
      allowNull: true
    },
    flight_number: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: 'room_bookings',
    indexes: [
      {
        fields: ['tenant_id', 'company_id']
      },
      {
        fields: ['booking_id']
      },
      {
        fields: ['room_id']
      },
      {
        fields: ['user_id']
      },
      {
        fields: ['check_in_date', 'check_out_date']
      }
    ]
  }
);

export default RoomBooking;




