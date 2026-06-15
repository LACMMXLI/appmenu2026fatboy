import type { LucideIcon } from 'lucide-react';

export type Tab =
  | 'products'
  | 'categories'
  | 'promotions'
  | 'rewards'
  | 'customers'
  | 'orders'
  | 'visits'
  | 'banners'
  | 'settings'
  | 'feedback';

export type AdminTabCounts = Record<Tab, number>;

export interface AdminNavItem {
  id: Tab;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface NewProduct {
  name: string;
  price: number;
  categoryId: string;
  description: string;
  imageUrl: string;
}

export interface NewCategory {
  name: string;
  order: number;
  imageUrl: string;
}

export interface NewRedeemableProduct {
  name: string;
  pointsCost: number;
  imageUrl: string;
  description: string;
  order: number;
}

export interface NewBanner {
  imageUrl: string;
  title: string;
  subtitle: string;
  buttonText: string;
  linkView: string;
  order: number;
}
