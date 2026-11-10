/**
 * Optional LLM reasoning for Accounting Brain.
 * Uses retrieved context only — never invents ledgers/rates.
 * Never posts vouchers.
 * Rule engine remains authoritative when allowLedgerOverride is false.
 */
import axios from 'axios';
import { env } from '../config/env';

export type LlmReasoningInput = {
  description: string;
  retrievedContext: Record<string, unknown>;
  ruleBasedRecommendation: Record<string, unknown>;
  /** When false, LLM may only add narrative — no debit/credit override */
  allowLedgerOverride?: boolean;
};

export type LlmReasoningResult = {
  used: boolean;
  narrative?: string;
  adjustedDebitAccount?: string | null;
  adjustedCreditAccount?: string | null;
  confidenceDelta?: number;
  allowLedgerOverride: boolean;
  notes: string[];
};

export async function reasonOverRetrievedContext(input: LlmReasoningInput): Promise<LlmReasoningResult> {
  const allowLedgerOverride = Boolean(input.allowLedgerOverride);
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      used: false,
      allowLedgerOverride,
      notes: ['OPENAI_API_KEY not set — rule/RAG path only'],
    };
  }

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: process.env.OPENAI_BRAIN_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an experienced Chartered Accountant assistant for an ERP.
You NEVER invent GST rates, ledger IDs, or post vouchers.
You may only choose ledgers from retrievedContext.accounts (name or nameEn) or keep the ruleBasedRecommendation.
${allowLedgerOverride ? 'You may propose adjusted ledgers when rules are weak.' : 'Do NOT change ledgers — keepRuleEngineChoice must be true. Provide narrative only.'}
Return JSON: {
  "narrative": string,
  "adjustedDebitAccount": string|null,
  "adjustedCreditAccount": string|null,
  "confidenceDelta": number (-10..10),
  "keepRuleEngineChoice": boolean
}`,
          },
          {
            role: 'user',
            content: JSON.stringify({
              description: input.description,
              retrievedContext: input.retrievedContext,
              ruleBasedRecommendation: input.ruleBasedRecommendation,
              allowLedgerOverride,
            }),
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 45000,
      }
    );

    const raw = String(response.data?.choices?.[0]?.message?.content || '{}');
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { used: false, allowLedgerOverride, notes: ['LLM returned non-JSON — ignored'] };
    }

    const allowedNames = new Set(
      ((input.retrievedContext.accounts as any[]) || [])
        .flatMap((a) => [String(a?.name || '').trim(), String(a?.nameEn || '').trim()])
        .filter(Boolean)
    );
    const ruleDebit = String((input.ruleBasedRecommendation as any)?.debitLedger?.accountName || '');
    const ruleCredit = String((input.ruleBasedRecommendation as any)?.creditLedger?.accountName || '');

    let debit = parsed.adjustedDebitAccount ? String(parsed.adjustedDebitAccount) : null;
    let credit = parsed.adjustedCreditAccount ? String(parsed.adjustedCreditAccount) : null;

    if (debit && allowedNames.size > 0 && !allowedNames.has(debit) && debit !== ruleDebit) {
      debit = null;
    }
    if (credit && allowedNames.size > 0 && !allowedNames.has(credit) && credit !== ruleCredit) {
      credit = null;
    }

    const keepRules = parsed.keepRuleEngineChoice !== false || !allowLedgerOverride;
    const delta = Number(parsed.confidenceDelta);
    return {
      used: true,
      narrative: parsed.narrative ? String(parsed.narrative).slice(0, 800) : undefined,
      adjustedDebitAccount: keepRules || !allowLedgerOverride ? null : debit,
      adjustedCreditAccount: keepRules || !allowLedgerOverride ? null : credit,
      confidenceDelta: Number.isFinite(delta) ? Math.max(-10, Math.min(10, delta)) : 0,
      allowLedgerOverride,
      notes: allowLedgerOverride
        ? ['LLM reasoning applied with COA allow-list']
        : ['LLM narrative only — rule engine ledger choice locked'],
    };
  } catch (err: any) {
    return {
      used: false,
      allowLedgerOverride,
      notes: [`LLM reasoning failed: ${err?.response?.data?.error?.message || err?.message || 'error'}`],
    };
  }
}
