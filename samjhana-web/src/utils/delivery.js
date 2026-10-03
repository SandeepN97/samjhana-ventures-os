/** The delivery charge for an order, worked out the same way the shop does (the shop has the final say). */
export function deliveryFeeFor(subtotal, shop = {}) {
  const fee = Number(shop.deliveryFee) || 0;
  const freeOver = Number(shop.freeDeliveryOver) || 0;
  if (fee <= 0) return 0;
  if (freeOver > 0 && subtotal >= freeOver) return 0;
  return fee;
}
