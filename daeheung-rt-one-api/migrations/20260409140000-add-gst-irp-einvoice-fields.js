/* eslint-disable @typescript-eslint/no-var-requires */
'use strict';

/** 인도 GST e-invoice (IRP) 연동용 컬럼 — NIC 스키마 기반 저장 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoices"
      ADD COLUMN IF NOT EXISTS "gst_irn" VARCHAR(64),
      ADD COLUMN IF NOT EXISTS "gst_ack_no" VARCHAR(50),
      ADD COLUMN IF NOT EXISTS "gst_ack_date" VARCHAR(32),
      ADD COLUMN IF NOT EXISTS "signed_qr_code" TEXT,
      ADD COLUMN IF NOT EXISTS "irp_status" VARCHAR(32) NOT NULL DEFAULT 'draft',
      ADD COLUMN IF NOT EXISTS "irp_last_error" TEXT,
      ADD COLUMN IF NOT EXISTS "irp_submitted_at" TIMESTAMP WITH TIME ZONE,
      ADD COLUMN IF NOT EXISTS "transaction_type" VARCHAR(20) NOT NULL DEFAULT 'B2B',
      ADD COLUMN IF NOT EXISTS "gst_einvoice_payload" JSONB;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE "invoice_items"
      ADD COLUMN IF NOT EXISTS "hsn_sac" VARCHAR(20),
      ADD COLUMN IF NOT EXISTS "cgst_rate" DECIMAL(7, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "sgst_rate" DECIMAL(7, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "igst_rate" DECIMAL(7, 2) NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS "cess_rate" DECIMAL(7, 2) NOT NULL DEFAULT 0;
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoice_items"
      DROP COLUMN IF EXISTS "cess_rate",
      DROP COLUMN IF EXISTS "igst_rate",
      DROP COLUMN IF EXISTS "sgst_rate",
      DROP COLUMN IF EXISTS "cgst_rate",
      DROP COLUMN IF EXISTS "hsn_sac";
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "invoices"
      DROP COLUMN IF EXISTS "gst_einvoice_payload",
      DROP COLUMN IF EXISTS "transaction_type",
      DROP COLUMN IF EXISTS "irp_submitted_at",
      DROP COLUMN IF EXISTS "irp_last_error",
      DROP COLUMN IF EXISTS "irp_status",
      DROP COLUMN IF EXISTS "signed_qr_code",
      DROP COLUMN IF EXISTS "gst_ack_date",
      DROP COLUMN IF EXISTS "gst_ack_no",
      DROP COLUMN IF EXISTS "gst_irn";
    `);
  }
};
