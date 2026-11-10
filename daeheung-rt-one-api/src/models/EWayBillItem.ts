import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface EWayBillItemAttributes {
  id: number;
  eway_bill_id: number;
  item_name: string;
  hsn_code: string; // HSN 코드
  quantity: number;
  unit: string; // 단위 (PCS, KGS, LTR 등)
  unit_price: number;
  total_value: number; // 수량 * 단가
  cgst_rate?: number; // CGST 세율 (%)
  cgst_amount?: number; // CGST 금액
  sgst_rate?: number; // SGST 세율 (%)
  sgst_amount?: number; // SGST 금액
  igst_rate?: number; // IGST 세율 (%)
  igst_amount?: number; // IGST 금액
  cess_rate?: number; // CESS 세율 (%)
  cess_amount?: number; // CESS 금액
  total_tax_amount: number; // 총 세금
  total_amount: number; // 총 금액 (가치 + 세금)
  created_at?: Date;
  updated_at?: Date;
}

interface EWayBillItemCreationAttributes extends Optional<EWayBillItemAttributes, 'id' | 'cgst_rate' | 'cgst_amount' | 'sgst_rate' | 'sgst_amount' | 'igst_rate' | 'igst_amount' | 'cess_rate' | 'cess_amount' | 'created_at' | 'updated_at'> {}

class EWayBillItem extends Model<EWayBillItemAttributes, EWayBillItemCreationAttributes> implements EWayBillItemAttributes {
  public id!: number;
  public eway_bill_id!: number;
  public item_name!: string;
  public hsn_code!: string;
  public quantity!: number;
  public unit!: string;
  public unit_price!: number;
  public total_value!: number;
  public cgst_rate?: number;
  public cgst_amount?: number;
  public sgst_rate?: number;
  public sgst_amount?: number;
  public igst_rate?: number;
  public igst_amount?: number;
  public cess_rate?: number;
  public cess_amount?: number;
  public total_tax_amount!: number;
  public total_amount!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

EWayBillItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    eway_bill_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    item_name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    hsn_code: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(15, 3),
      allowNull: false,
      defaultValue: 0
    },
    unit: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'PCS'
    },
    unit_price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_value: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    cgst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    cgst_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    sgst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    sgst_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    igst_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    igst_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    cess_rate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    cess_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      defaultValue: 0
    },
    total_tax_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    total_amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    }
  },
  {
    sequelize,
    tableName: 'eway_bill_items',
    indexes: [
      {
        fields: ['eway_bill_id']
      },
      {
        fields: ['hsn_code']
      }
    ]
  }
);

export default EWayBillItem;



