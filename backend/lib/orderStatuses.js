/** Allowed values for orders.status (must match DB constraint). */
export const ORDER_STATUSES = [
  'pending',
  'paid',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
];

export function isAllowedOrderStatus(s) {
  return typeof s === 'string' && ORDER_STATUSES.includes(s);
}
