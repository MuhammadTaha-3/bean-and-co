"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getStockSync, listProducts } from "./repo";
import { keyOf, useCart } from "./cart-context";
import type { Product } from "./types";

/** Loads the storefront catalogue (active products only). `products === null` while loading. */
export function useCatalog() {
  const [products, setProducts] = useState<Product[] | null>(null);
  useEffect(() => {
    let live = true;
    listProducts().then((all) => live && setProducts(all.filter((p) => p.status === "active")));
    return () => {
      live = false;
    };
  }, []);
  return { products, loading: products === null };
}

type Addable = Pick<Product, "id" | "name" | "price" | "image">;

/** Add-to-cart with stock guard. Opens the drawer on success. Returns true if added. */
export function useAddToCart() {
  const cart = useCart();
  return useCallback(
    (product: Addable, opts: { qty?: number; size?: string; price?: number } = {}) => {
      const stock = getStockSync(product.id);
      if (stock !== null && stock <= 0) {
        toast.error(`${product.name} is sold out right now`);
        return false;
      }
      const inCart = cart.lines
        .filter((l) => l.productId === product.id && keyOf(l) !== keyOf({ productId: product.id, size: opts.size }))
        .reduce((n, l) => n + l.qty, 0);
      const room = stock === null ? 99 : stock - inCart;
      if (room <= 0) {
        toast.error(`You already have all ${stock} in your cart`);
        return false;
      }
      const same = cart.lines.find((l) => keyOf(l) === keyOf({ productId: product.id, size: opts.size }));
      if (stock !== null && same && same.qty >= room) {
        toast.message(`Only ${stock} of ${product.name} in stock`);
        return false;
      }
      cart.add(product, { ...opts, ...(stock !== null ? { stock: room } : {}) });
      cart.setOpen(true);
      return true;
    },
    [cart],
  );
}
