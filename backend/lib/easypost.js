const BASE = 'https://api.easypost.com/v2';

import { getDb } from './db.js';
import { getEasyPostApiKey, getEasyPostFromAddress } from './easypostCredentials.js';

async function resolvedCreds(sqlMaybe) {
  const sql = sqlMaybe || getDb();
  const apiKey = await getEasyPostApiKey(sql);
  if (!apiKey) {
    throw new Error(
      'EasyPost is not configured. Add EASYPOST_API_KEY in Vercel env or Admin → EasyPost settings.',
    );
  }
  const fromAddress = await getEasyPostFromAddress(sql);
  return { apiKey, fromAddress };
}

async function epFetch(path, method = 'GET', body, apiKey) {
  const auth = Buffer.from(`${apiKey}:`).toString('base64');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const msg =
      data?.error?.message ||
      (Array.isArray(data?.error?.errors) ? data.error.errors.map((e) => e.message).join('; ') : null) ||
      `EasyPost error ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

function toEpAddress(addr, nameOverride) {
  return {
    name: nameOverride || addr.name || addr.fullName || 'Customer',
    street1: addr.line1,
    street2: addr.line2 || undefined,
    city: addr.city,
    state: addr.state || '',
    zip: addr.postal,
    country: addr.country || 'US',
    phone: addr.phone || '',
    email: addr.email || '',
  };
}

function formatRate(r) {
  return {
    id: r.id,
    carrier: r.carrier,
    service: r.service,
    rateCents: Math.round(parseFloat(r.rate || 0) * 100),
    deliveryDays: r.delivery_days ?? null,
    deliveryDate: r.delivery_date ?? null,
  };
}

/**
 * Create a shipment and return available rates (does not purchase).
 * @param {{ toAddress: object, weightOz?: number, customerName?: string, customerEmail?: string, sql?: any }}
 */
export async function createShipment({ toAddress, weightOz = 8, customerName, customerEmail, sql }) {
  const creds = await resolvedCreds(sql);
  const ship = await epFetch('/shipments', 'POST', {
    shipment: {
      from_address: creds.fromAddress,
      to_address: toEpAddress(toAddress, customerName),
      parcel: { weight: Math.max(1, Number(weightOz) || 8) },
      options: { label_format: 'PNG' },
    },
  }, creds.apiKey);
  return {
    id: ship.id,
    rates: (ship.rates || []).map(formatRate).sort((a, b) => a.rateCents - b.rateCents),
  };
}

/**
 * Purchase a specific rate on an existing shipment.
 * @returns {{ trackingCode, labelUrl, carrier, service, rateCents, trackerId }}
 */
export async function buyRate(shipmentId, rateId, sql) {
  const creds = await resolvedCreds(sql);
  const ship = await epFetch(`/shipments/${shipmentId}/buy`, 'POST', { rate: { id: rateId } }, creds.apiKey);
  return {
    trackingCode: ship.tracking_code || null,
    labelUrl: ship.postage_label?.label_url || null,
    carrier: ship.selected_rate?.carrier || null,
    service: ship.selected_rate?.service || null,
    rateCents: Math.round(parseFloat(ship.selected_rate?.rate || 0) * 100),
    trackerId: ship.tracker?.id || null,
    shipmentId: ship.id,
  };
}

/**
 * Create and auto-purchase a pre-paid return label (cheapest rate).
 * @param {{ fromAddress: object, weightOz?: number, sql?: any }}
 */
export async function createReturnLabel({ fromAddress, weightOz = 8, sql }) {
  const creds = await resolvedCreds(sql);
  const ship = await epFetch('/shipments', 'POST', {
    shipment: {
      to_address: creds.fromAddress,
      from_address: toEpAddress(fromAddress),
      parcel: { weight: Math.max(1, Number(weightOz) || 8) },
      is_return: true,
      options: { label_format: 'PNG' },
    },
  }, creds.apiKey);

  const rates = (ship.rates || []).sort((a, b) => parseFloat(a.rate) - parseFloat(b.rate));
  if (!rates.length) throw new Error('No return shipping rates available for this address.');

  const bought = await epFetch(`/shipments/${ship.id}/buy`, 'POST', { rate: { id: rates[0].id } }, creds.apiKey);
  return {
    shipmentId: bought.id,
    trackingCode: bought.tracking_code || null,
    labelUrl: bought.postage_label?.label_url || null,
    carrier: bought.selected_rate?.carrier || null,
    service: bought.selected_rate?.service || null,
  };
}
