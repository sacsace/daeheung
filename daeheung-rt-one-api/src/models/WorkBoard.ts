import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type WorkBoardType = 'GENERAL' | 'RECURRING';

interface WorkBoardAttributes {
  id: number;
  tenant_id: number;
  company_id: number;
  name: string;
  description?: string;
  board_color?: string | null;
  /** GENERAL: 칸반 | RECURRING: 정기 업무 */
  board_type: WorkBoardType;
  position: number;
  created_by: number;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

interface WorkBoardCreationAttributes
  extends Optional<
    WorkBoardAttributes,
    'id' | 'created_at' | 'updated_at' | 'description' | 'position' | 'deleted_at' | 'board_type'
  > {}

class WorkBoard extends Model<WorkBoardAttributes, WorkBoardCreationAttributes> implements WorkBoardAttributes {
  public id!: number;
  public tenant_id!: number;
  public company_id!: number;
  public name!: string;
  public description?: string;
  public board_color?: string | null;
  public board_type!: WorkBoardType;
  public position!: number;
  public created_by!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public readonly deleted_at!: Date | null;
}

WorkBoard.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    tenant_id: { type: DataTypes.INTEGER, allowNull: false },
    company_id: { type: DataTypes.INTEGER, allowNull: false },
    name: { type: DataTypes.STRING(200), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    board_color: { type: DataTypes.STRING(7), allowNull: true, defaultValue: null },
    board_type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'GENERAL',
      validate: {
        isIn: [['GENERAL', 'RECURRING']],
      },
    },
    position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    created_by: { type: DataTypes.INTEGER, allowNull: false },
    deleted_at: { type: DataTypes.DATE, allowNull: true }
  },
  {
    sequelize,
    tableName: 'work_boards',
    timestamps: true,
    underscored: true,
    paranoid: true
  }
);

export default WorkBoard;
