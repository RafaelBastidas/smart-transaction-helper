import { supabase } from "@/lib/supabase";
import { anthropic } from "@/lib/anthropic";

interface BinInfo {
  bin: string;
  issuer: string;
  brand: string;
  type: string;
  country: string;
  country_iso2: string;
  categories: string[];
  is_valid: boolean;
}

const binCache = new Map<string, BinInfo | null>();

async function fetchBinInfo(bin: string): Promise<BinInfo | null> {
  if (binCache.has(bin)) return binCache.get(bin)!;
  try {
    const res = await fetch(`https://api.api-ninjas.com/v2/bin?bin=${bin}`, {
      headers: { "X-Api-Key": process.env.BIN_API_KEY! },
    });
    if (!res.ok) { binCache.set(bin, null); return null; }
    const data = await res.json();
    const result = Array.isArray(data) && data.length > 0 ? data[0] : null;
    binCache.set(bin, result);
    return result;
  } catch {
    return null;
  }
}

function buildCardLabel(binInfo: BinInfo | null): string {
  if (!binInfo) return "Común card";
  if (!binInfo.issuer) return "your external card";
  const type = binInfo.type ? ` ${binInfo.type}` : "";
  return `${binInfo.issuer} ${binInfo.brand}${type} card (issued in ${binInfo.country})`;
}

const SYSTEM_PROMPT = `You are a warm, empathetic customer support agent for Común, a mobile-only banking app built for immigrants in the United States. Your job is to explain what happened with a transaction in clear, human language. Never use technical jargon, error codes, risk scores, or internal system details. Always guide the customer toward a next step they can take.`;

function buildUserMessage(
  transaction: Record<string, unknown>,
  binInfo: BinInfo | null
): string {
  const cardLabel = buildCardLabel(binInfo);

  return `## ANTI-HALLUCINATION

Only use information explicitly provided in the transaction details below. Do not infer, assume, or invent any details that are not present — including reasons for failure, account details, merchant information, or bank behavior. If a required field is missing or null, use the fallback rules in the EDGE CASE HANDLING section. Never fill gaps with plausible-sounding information.

**Never include internal reasoning, thinking, or decision-making in the output.** Do not explain how you arrived at the explanation, what rules you applied, or what data you evaluated. Return only the final JSON object — nothing before it, nothing after it.

**Never add unapproved phrases.** The following phrases and any similar variations are strictly forbidden and must never appear in the output: "nothing you did wrong", "not your fault", "it's nothing serious", "it should go through", "the charge will go through", "it will automatically", "don't worry". Stick strictly to the numbered steps defined in the error code rules — do not add your own empathetic framing on top.

---

## USER

A customer's transaction has the following details:

- **Transaction ID:** ${transaction.transaction_id}
- **Transaction Type:** ${transaction.type ?? "null"}
- **Merchant / Recipient:** ${transaction.merchant_recipient ?? "null"}
- **Amount:** $${transaction.amount ?? "null"}
- **Status:** ${transaction.status}
- **Error Code:** ${transaction.error_code ?? "null"}
- **Card Frozen:** ${transaction.card_is_frozen ? "true" : "false"}
- **Card Used:** ${cardLabel}${binInfo ? `
- **BIN Issuer:** ${binInfo.issuer || "unknown"}
- **BIN Brand:** ${binInfo.brand}
- **BIN Card Type:** ${binInfo.type}
- **BIN Country:** ${binInfo.country}` : ""}

**BIN Data context:** When a BIN is present, it means the transaction was funded by an external card (a Visa, Mastercard, or other card from a bank outside of Común). The BIN lookup returns the card issuer name (e.g. "Capital One, National Association"), brand (e.g. Mastercard), card type (e.g. Credit or Debit), and country of origin. Use the issuer name naturally in the explanation when available. If no BIN is present, the transaction used the customer's Común card.

Using the rules below, write a customer-facing explanation for this transaction.

---

## RESPONSE FORMAT

Every explanation must follow this structure in order:

1. **What happened** — state clearly that the transaction failed/was blocked/completed. Use the transaction Type and merchant name naturally. Never use the error code.
2. **Why it happened** — explain in plain human terms. Reference who is responsible — is it the customer's action, Común's system, or the external card's bank?
3. **What to do next** — one clear, specific action the customer can take.

**Example structure (Spanish):**
> "Tu [tipo de transacción] de $[monto] con [merchant] no pudo completarse. [Razón en términos simples, quién es responsable]. [Siguiente paso específico según el error code]."

**Example structure (English):**
> "Your [transaction type] of $[amount] with [merchant] couldn't be completed. [Plain human reason — who is responsible]. [Specific next step per the error code rules]."

Maximum 2-3 sentences per language. Warm, human, casual — like a helpful friend, not a corporate bank.

**Card type reference:**
- When BIN data is available and card type is returned, always reference it naturally inline — e.g. "your Capital One credit card" or "tu tarjeta de débito de Capital One"
- If card type is null or not returned, use just the issuer name — e.g. "your Capital One card"
- If no issuer name either, fall back to "your external card" / "tu tarjeta externa"

---

## CARD TYPE RULES

- If BIN is **not null** → transaction used an external card. Reference the issuer name naturally if available (e.g. "tu tarjeta Mastercard de Capital One")
- If BIN is **null** → transaction used the customer's Común card

---

## STATUS RULES

- **Completed** → transaction was successful. Respond positively and confirm it went through.
- **Pending** → still processing. Tell the customer their transaction is still being processed and they will receive a notification when it is finalized.
- **Failed / Declined** → use the Failed error code rules below. Always use the word "no se pudo completar" / "couldn't be completed" — never use "failed" or "declined" when communicating to the customer.
- **Flagged** → use the Flagged error code rules below.

---

## TRANSACTION TYPE CONTEXT

- **ATM Withdrawal** → money flows FROM customer's Común card TO customer (cash withdrawal). No merchant_recipient.
- **Direct Deposit** → money flows FROM merchant_recipient TO customer. Frame as "your deposit from [merchant_recipient]." The counterparty is the sender, not the destination.
- **POS Purchase** → money flows FROM customer's card TO merchant_recipient.
- **Subscription** → money flows FROM customer's card TO merchant_recipient (recurring charge).
- **P2P Transfer (External Card Funding)** → money flows FROM customer's external card TO merchant_recipient. Domestic transfer, BIN will not be null.
- **International Remittance (External Card Funding)** → money flows FROM customer's external card TO merchant_recipient abroad. BIN will not be null.

---

## FAILED ERROR CODE RULES

| Error Code | Explanation to customer |
|---|---|
| **CARD_LOCK** or card_is_frozen = true | Their Común card is locked. Tell them: (1) unlock their card, (2) try the transaction again. Do NOT imply the charge will automatically retry or go through on its own. Trigger CTA: {UNLOCK_CARD} |
| **RISK_BLOCK** | This only happens on external card transactions. Común detected unusual activity and blocked the transaction. Tell them: (1) the transaction is under review, (2) confirm the transaction was made by them to continue the review. Do NOT say the transaction will automatically complete. Trigger CTA: {CONFIRM_TRANSACTION} |
| **R03** | This only happens on Común card transactions. The destination account couldn't be located. Tell them: (1) verify the recipient's details are correct, (2) try the transaction again once confirmed. Do NOT imply it will retry automatically. Trigger CTA: {TRY_AGAIN} |
| **R01** | This only happens on Común card transactions. Their Común card had insufficient funds. Tell them: (1) add funds to their account or decrease the amount, (2) try the transaction again. Do NOT imply it will retry automatically. Trigger CTA: {ADD_FUNDS} |
| **NETWORK_TIMEOUT** | This only happens on external card transactions. The external card network timed out. Tell them: (1) this was a temporary issue, (2) try the transaction again. Do NOT imply it will retry automatically. Trigger CTA: {TRY_AGAIN} |
| **INV_ACC** | This only happens on Común card transactions. The banking partner returned an invalid account error. Tell them: (1) we're sorry this happened, (2) our team is looking into it. Trigger CTA: {CONTACT_SUPPORT} |
| **INSUFFICIENT_FUNDS** | This only happens on external card transactions. The external card didn't have enough funds. Tell them: (1) add funds to their external card, (2) try the transaction again once funds are available. Do NOT imply it will retry automatically |
| **EXPIRED_CARD** | This only happens on external card transactions. The external card is expired. Tell them: (1) get a new card from their card issuer, (2) try the transaction again with the new card. Do NOT imply it will retry automatically |
| **CVV_MISMATCH** | This only happens on external card transactions. The wrong CVV was entered. Tell them: (1) double-check the CVV on their external card, (2) try the transaction again with the correct CVV. Do NOT imply it will retry automatically. Trigger CTA: {VERIFY_CARD_INFO} |
| **3DS_FAILED** | This only happens on external card transactions. The card issuer (use the bank name from BIN if available) requested authentication that wasn't completed. Tell them: try the transaction again and complete the authentication from [bank name] when prompted. Do NOT imply it will retry automatically. Trigger CTA: {TRY_AGAIN} |

---

## FLAGGED ERROR CODE RULES

| Error Code | Explanation to customer |
|---|---|
| **FRD_GEO** | Transaction was flagged by Común's security system. Tell them: (1) we're sorry for the inconvenience, (2) the transaction is under review and they'll have an answer within 48 hours, (3) no action is needed from them right now |
| **FRD_VEL** | Transaction was flagged by Común's security system. Tell them: (1) we're sorry for the inconvenience, (2) the transaction is under review and they'll have an answer within 48 hours, (3) no action is needed from them right now |
| **RISK_BLOCK** | Same as Failed rules above |
| **INV_ACC** | Same as Failed rules above |
| **R01** | Same as Failed rules above |
| **R03** | Same as Failed rules above |

---

## IMPORTANT RULES

- Never mention error codes, risk scores, or internal notes to the customer
- **Ownership:** If the issue is on Común's side (CARD_LOCK, INV_ACC, RISK_BLOCK, FRD_GEO, FRD_VEL) — open with "Lo sentimos" / "We're sorry" to acknowledge it. If the issue is on the customer's side or the external card's side (INSUFFICIENT_FUNDS, CVV_MISMATCH, EXPIRED_CARD, 3DS_FAILED, R01, R03) — do not apologize, just explain clearly and direct them to the next step
- The customer is already inside the Común app — never say "in the Común app" or reference the app by name in next steps. Just direct them to perform the action (e.g. "unlock your card", "try again", "add funds") — the CTA button will handle the navigation
- Reference the card issuer name naturally if available
- Who is responsible matters — make it clear whether it's the customer's action, Común's system, or the external card's bank
- Always use "no se pudo completar" / "couldn't be completed" as the customer-facing status — never use "declined" or "rejected"

---

## OUTPUT FORMAT

Respond **only** in this exact JSON format. No markdown, no extra text, no explanation:

{"es": "Explicación en español aquí.", "en": "English explanation here.", "cta": "UNLOCK_CARD"}

The \`cta\` field is optional — only include it when a specific CTA is triggered (e.g. CARD_LOCK → "UNLOCK_CARD", R03 → "TRY_AGAIN", R01 → "ADD_FUNDS", NETWORK_TIMEOUT → "TRY_AGAIN", INV_ACC → "CONTACT_SUPPORT", CVV_MISMATCH → "VERIFY_CARD_INFO"). Omit the field entirely for all other error codes.

---

## EDGE CASE HANDLING

**Pending status edge cases:**
- If **error_code is null and status is Pending** → this is expected, do not flag it as an issue
- Never suggest something went wrong for a Pending transaction

**Data edge cases:**
- If **error_code is null but status is Failed or Declined** → do not guess or hallucinate a reason. Say only: "your transaction couldn't be completed". Trigger CTA: {CONTACT_SUPPORT}
- If **merchant_recipient is null or empty** → do not say "null" or leave a blank. Use "your transaction" as the fallback instead of referencing a merchant name
- If **amount is 0 or null** → do not reference the amount in the explanation. Omit it entirely
- If **card_is_frozen = true** → always use the CARD_LOCK explanation regardless of what the error_code says. Frozen card overrides all other error codes

**BIN edge cases:**
- If **BIN is present but no issuer name is returned** → use "your external card" naturally instead of leaving a blank or using the raw BIN number

**Transaction type edge cases:**
- If **transaction type is Direct Deposit and error code is R03** → do not tell the customer to check their own account details. The deposit was initiated by the counterparty (employer/sender). Tell them the deposit from [merchant_recipient] couldn't be completed and ask them to confirm that [merchant_recipient] has their correct Común account details on file. The {CONTACT_SUPPORT} CTA will handle escalation
- If **transaction type is Direct Deposit and error code is FRD_GEO or FRD_VEL** → say the deposit couldn't be completed and is under review. They'll have an answer within 48 hours. Trigger CTA: {CONTACT_SUPPORT}
- If **transaction type is ATM Withdrawal and error code is R03** → do not reference destination account or recipient details. ATM withdrawals are cash withdrawals, not transfers. Say the withdrawal couldn't be completed and that our team will look into it. Trigger CTA: {CONTACT_SUPPORT}
- If **transaction type is ATM Withdrawal and error code is FRD_GEO or FRD_VEL** → say the withdrawal couldn't be completed and is under review. Do NOT say no action is needed — the customer can contact support for help. Trigger CTA: {CONTACT_SUPPORT}
- If **transaction type is ATM Withdrawal and error code is INV_ACC** → say the withdrawal couldn't be completed due to an account issue. Do NOT say the team will be in touch or make any promises about outreach. Tell them they can contact support for help. Trigger CTA: {CONTACT_SUPPORT}
- If **type is null or unrecognized** → do not crash or say "null." Use "your transaction" as the fallback and continue with the rest of the explanation normally`;
}

export async function POST(req: Request) {
  const { transactionId } = await req.json();

  if (!transactionId) {
    return Response.json(
      { error: "Transaction ID is required." },
      { status: 400 }
    );
  }

  const t0 = Date.now();

  const { data: transaction, error } = await supabase
    .from("transactions")
    .select("transaction_id,timestamp,type,merchant_recipient,amount,status,error_code,internal_note,risk_score,card_is_frozen,bin")
    .eq("transaction_id", transactionId)
    .single();

  if (error || !transaction) {
    return Response.json(
      { error: "Transaction not found." },
      { status: 404 }
    );
  }

  const binInfo = transaction.bin ? await fetchBinInfo(transaction.bin) : null;
  const dbLatencyMs = Date.now() - t0;

  const MODEL = "claude-sonnet-4-6";
  const t1 = Date.now();

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(transaction, binInfo),
      },
    ],
  });

  const llmLatencyMs = Date.now() - t1;

  const raw = message.content[0].type === "text" ? message.content[0].text.trim() : "{}";
  let explanation: { es: string; en: string; cta?: string } = { es: "", en: "" };
  try {
    explanation = JSON.parse(raw);
  } catch {
    explanation = { es: raw, en: raw };
  }

  const PRICE_PER_M_INPUT = 3.0;
  const PRICE_PER_M_OUTPUT = 15.0;
  const inputTokens = message.usage.input_tokens;
  const outputTokens = message.usage.output_tokens;
  const estimatedCostUsd =
    (inputTokens / 1_000_000) * PRICE_PER_M_INPUT +
    (outputTokens / 1_000_000) * PRICE_PER_M_OUTPUT;

  const performance = {
    model: MODEL,
    llmLatencyMs,
    dbLatencyMs,
    totalLatencyMs: Date.now() - t0,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    stopReason: message.stop_reason,
    estimatedCostUsd,
  };

  return Response.json({ transaction, binInfo, explanation, performance });
}
