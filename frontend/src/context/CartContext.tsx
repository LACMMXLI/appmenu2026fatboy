import React, { createContext, useContext, useState } from 'react';

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

const CartContext = createContext<CartContextData>({} as CartContextData);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

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

  const clearCart = () => setItems([]);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
