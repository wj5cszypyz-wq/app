"use client";

import { useRouter } from "next/navigation";
import { IconRepeat } from "@/components/icons";
import { loadCart, saveCart } from "@/lib/cart";
import { useStorePaths } from "@/components/use-store";

export function ReorderButton({ cartKey, lines }: { cartKey: string; lines: { productId: string; qty: number }[] }) {
  const router = useRouter();
  const paths = useStorePaths();
  return (
    <button
      className="btn btn-sm"
      onClick={() => {
        const cart = loadCart(cartKey);
        for (const l of lines) cart[l.productId] = Math.round(((cart[l.productId] ?? 0) + l.qty) * 100) / 100;
        saveCart(cartKey, cart);
        router.push(paths.shop());
      }}
    >
      <IconRepeat /> Reorder
    </button>
  );
}
