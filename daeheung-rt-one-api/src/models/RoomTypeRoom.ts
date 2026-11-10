import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomTypeRoomAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  room_type_id: number;
  room_number: string;
  room_name?: string;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
}

interface RoomTypeRoomCreationAttributes extends Optional<RoomTypeRoomAttributes, 'id' | 'room_name' | 'created_at' | 'updated_at'> {}

class RoomTypeRoom extends Model<RoomTypeRoomAttributes, RoomTypeRoomCreationAttributes> implements RoomTypeRoomAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public room_type_id!: number;
  public room_number!: string;
  public room_name?: string;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

RoomTypeRoom.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    company_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    room_type_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    room_number: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    room_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'room_type_rooms',
    underscored: true,
  }
);

export default RoomTypeRoom;
