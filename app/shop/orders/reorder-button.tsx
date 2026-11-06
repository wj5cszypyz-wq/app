"use client";

import { useRouter } from "next/navigation";
import { IconRepeat } from "@/components/icons";
import { loadCart, saveCart } from "@/lib/cart";

export function ReorderButton({ restaurantId, lines }: { restaurantId: string; lines: { productId: string; qty: number }[] }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm"
      onClick={() => {
        const cart = loadCart(restaurantId);
        for (const l of lines) cart[l.productId] = Math.round(((cart[l.productId] ?? 0) + l.qty) * 100) / 100;
        saveCart(restaurantId, cart);
        router.push("/shop");
      }}
    >
      <IconRepeat /> Reorder
    </button>
  );
}
