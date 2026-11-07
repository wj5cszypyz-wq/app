// The cart lives in the browser so it survives a refresh. Prices are never trusted from here:
// the server re-prices every line when the order is placed.
export type Cart = Record<string, number>; // productId -> qty

const key = (cartKey: string) => `orderdock_cart_${cartKey}`;

export function loadCart(cartKey: string): Cart {
  try {
    const raw = localStorage.getItem(key(cartKey));
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    if (!parsed || typeof parsed !== "object") return {};
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === "number" && v > 0),
    ) as Cart;
  } catch {
    return {};
  }
}

export function saveCart(cartKey: string, cart: Cart) {
  try {
    localStorage.setItem(key(cartKey), JSON.stringify(cart));
  } catch {
    // storage blocked: cart still works for this visit
  }
}
