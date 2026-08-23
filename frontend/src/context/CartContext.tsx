import React, { createContext, useContext, useEffect, useState } from 'react';

export interface CartItem {
  cartId: string;
  id: string;
  title: string;
  price: number;
  qty: number;
  img: string;
  isPromotion?: boolean;
  meatPrep?: string;
  extras: { name: string; price: number }[];
  removals: string[];
  notes: string;
}

interface CartContextData {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'cartId'>) => void;
  removeItem: (cartId: string) => void;
  updateQty: (cartId: string, delta: number) => void;
  clearCart: () => void;
}

const CART_STORAGE_KEY = 'fatboy-cart-items';

function getInitialCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(getInitialCart);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (err) {
      console.error('Failed to save cart to localStorage', err);
    }
  }, [items]);

  const addItem = (item: Omit<CartItem, 'cartId'>) => {
    const cartId = Math.random().toString(36).substring(7);
    setItems((prev) => [...prev, { ...item, cartId }]);
  };

  const removeItem = (cartId: string) => {
    setItems((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const updateQty = (cartId: string, delta: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.cartId === cartId ? { ...i, qty: Math.max(1, i.qty + delta) } : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    try {
      localStorage.removeItem(CART_STORAGE_KEY);
    } catch {}
  };

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);

