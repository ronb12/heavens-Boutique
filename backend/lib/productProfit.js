/**
 * Lowest amount the customer might pay for one unit (regular vs sale).
 * If a sale price is set, we use the lower of list and sale (worst-case revenue).
 */
export function minEffectiveSellCents(priceCents, salePriceCents) {
  const p = Number(priceCents);
  if (!Number.isFinite(p) || p < 0) return null;
  if (salePriceCents == null) return Math.floor(p);
  const s = Number(salePriceCents);
  if (!Number.isFinite(s) || s < 0) return Math.floor(p);
  return Math.floor(Math.min(p, s));
}

function readCardPercent() {
  const v = process.env.PROFIT_GUARD_CARD_PERCENT;
  if (v === undefined || v === '') return 0.029;
  const n = Number.parseFloat(String(v));
  return Number.isFinite(n) && n >= 0 ? n : 0.029;
}

function readCardFixedCents() {
  const v = process.env.PROFIT_GUARD_CARD_FIXED_CENTS;
  if (v === undefined || v === '') return 30;
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) && n >= 0 ? n : 30;
}

/**
 * Estimated card/Stripe-like fee on a single charge (percent of charge + fixed).
 * Defaults ~2.9% + $0.30; set env to 0 to disable that component.
 */
export function estimatedCardFeeCents(chargeCents) {
  const charge = Number(chargeCents);
  if (!Number.isFinite(charge) || charge <= 0) return 0;
  const pct = readCardPercent();
  const fixed = readCardFixedCents();
  return Math.ceil(charge * pct) + fixed;
}

/**
 * Lowest catalog price minus estimated processing fees (same formula as profit guard).
 */
export function netAfterEstimatedFeesCents(priceCents, salePriceCents) {
  const effective = minEffectiveSellCents(priceCents, salePriceCents);
  if (effective == null) return null;
  const fees = estimatedCardFeeCents(effective);
  return effective - fees;
}

/**
 * When cost is set, require net revenue after estimated card fees >= unit cost.
 * Assumes the lowest catalog price is charged as one card payment (full fixed fee applies once).
 * Tax and shipping are still excluded.
 */
export function validateProductProfit({ priceCents, salePriceCents, costCents }) {
  if (costCents == null) return { ok: true };
  const c = Number(costCents);
  if (!Number.isFinite(c) || c < 0) {
    return { ok: false, error: 'Invalid cost: must be a non-negative number.' };
  }
  const effective = minEffectiveSellCents(priceCents, salePriceCents);
  if (effective == null) {
    return { ok: false, error: 'Invalid list price.' };
  }
  const fees = estimatedCardFeeCents(effective);
  const net = effective - fees;
  if (net < c) {
    const effD = (effective / 100).toFixed(2);
    const feeD = (fees / 100).toFixed(2);
    const netD = (net / 100).toFixed(2);
    const costD = (c / 100).toFixed(2);
    return {
      ok: false,
      error: `Price would not cover cost after estimated card fees: lowest price $${effD}, fees ~$${feeD}, net ~$${netD}, unit cost $${costD}. Raise list/sale price, lower cost, or adjust PROFIT_GUARD_CARD_* if your rates differ.`,
    };
  }
  return { ok: true };
}
