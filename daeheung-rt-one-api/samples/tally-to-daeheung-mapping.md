# Tally Export → MSV GL Mapping

| Tally | MSV table.column | Notes |
|-------|------------------|-------|
| GROUP.NAME | gl_accounts.name (`account_type=group`) | code `TLYG####` |
| GROUP.PARENT | gl_accounts.parent_id / account_group | nature from parent heuristic |
| LEDGER.NAME | gl_accounts.name / name_en | code `TLY####` or name match |
| LEDGER.PARENT | parent_id, account_group, nature | Sundry Debtors/Creditors → party |
| LEDGER.OPENINGBALANCE | opening_balance + current_balance | not auto-posted JE |
| LEDGER.ALIAS / GUID | search_aliases | |
| LEDGER GSTIN / PARTYGSTIN / LEDGSTREGDETAILS | partners.business_number + partner_gst_numbers | GSTIN required when present in export |
| LEDGER ADDRESS.LIST (+ PIN/STATE) | partners.address | joined as one comma-separated line |
| LEDGER PAN/EMAIL/PHONE | partners.pan_number / email / phone | |
| VOUCHER.DATE | voucher_date | YYYYMMDD → ISO |
| VOUCHER.EFFECTIVEDATE | posting_date | |
| VOUCHERTYPENAME | voucher_type enum | payment/receipt/sales/… |
| VOUCHERNUMBER | voucher_no as `TLY-{no}` | unique per company |
| REFERENCE | invoice_number / amount_details | |
| NARRATION | narration | |
| GUID | amount_details.tallyGuid | dedupe |
| PARTYLEDGERNAME | party_id → partners | |
| ISDEEMEDPOSITIVE+AMOUNT | debit/credit | Yes=Debit |
| ALLLEDGERENTRIES.LIST | gl_voucher_lines | preferred |
| LEDGERENTRIES.LIST | gl_voucher_lines | fallback |
| ACCOUNTINGALLOCATIONS (inventory) | gl_voucher_lines | invoice mode |
| BILLALLOCATIONS / BANKALLOCATIONS | amount_details.linesMeta + line_category | |

Vouchers always **draft**. Post manually in 회계장부.
