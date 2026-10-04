// Single data-access layer. Everything is async on purpose: when the backend
// lands, each function body becomes a fetch() call and nothing else changes.
import { icedDrinks, products as seedProducts } from "@/lib/coffee-data";
import type { Customer, Order, OrderStatus, Product, StoreSettings } from "./types";

const KEYS = {
  products: "bc2_products",
  categories: "bc2_categories",
  orders: "bc2_orders",
  customers: "bc2_customers",
  settings: "bc2_settings",
} as const;

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: "Bean & Co",
  currency: "PKR",
  lowStockThreshold: 10,
  deliveryFee: 250,
  supportEmail: "hello@beanandco.pk",
};

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

const seedStock: Record<string, number> = {
  "caramel-latte": 42,
  "black-iced": 28,
  "coffee-mocha": 6,
  "double-espresso": 55,
  tiramisu: 4,
  "house-beans": 18,
  "iced-caramel-macchiato": 24,
  "coffee-frappe": 9,
  "espresso-tonic": 0,
};

function buildSeedProducts(): Product[] {
  return [...seedProducts, ...icedDrinks].map((p, i) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    price: p.price,
    category: p.category,
    image: p.image,
    stock: seedStock[p.id] ?? 20,
    status: "active" as const,
    notes: p.notes,
    roast: p.roast,
    best: p.best,
    createdAt: new Date(Date.now() - i * 864e5).toISOString(),
  }));
}

function seedOrders(all: Product[]): Order[] {
  const pick = (id: string, qty: number) => {
    const p = all.find((x) => x.id === id)!;
    return { productId: p.id, name: p.name, price: p.price, image: p.image, qty };
  };
  const make = (
    n: number,
    daysAgo: number,
    status: OrderStatus,
    name: string,
    email: string,
    items: Order["items"],
  ): Order => {
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    return {
      id: `ord-${n}`,
      reference: `BC-10${n}`,
      createdAt: new Date(Date.now() - daysAgo * 864e5).toISOString(),
      status,
      items,
      subtotal,
      deliveryFee: DEFAULT_SETTINGS.deliveryFee,
      total: subtotal + DEFAULT_SETTINGS.deliveryFee,
      address: {
        fullName: name,
        phone: "+92 300 1234567",
        email,
        line1: "12 Zamzama Boulevard",
        city: "Karachi",
      },
      paymentMethod: "cod",
      deliveryMethod: "standard",
      customerEmail: email,
      history: [{ status, at: new Date(Date.now() - daysAgo * 864e5).toISOString() }],
    };
  };

  return [
    make(1, 1, "Placed", "Ayesha Siddiqui", "ayesha@example.com", [
      pick("caramel-latte", 2),
      pick("tiramisu", 1),
    ]),
    make(2, 3, "Preparing", "Bilal Ahmed", "bilal@example.com", [pick("house-beans", 1)]),
    make(3, 6, "Shipped", "Hira Nadeem", "hira@example.com", [pick("iced-caramel-macchiato", 3)]),
    make(4, 11, "Delivered", "Usman Tariq", "usman@example.com", [
      pick("double-espresso", 2),
      pick("coffee-mocha", 1),
    ]),
    make(5, 18, "Delivered", "Ayesha Siddiqui", "ayesha@example.com", [pick("black-iced", 2)]),
  ];
}

function seedCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  orders.forEach((o, i) => {
    if (!map.has(o.customerEmail)) {
      map.set(o.customerEmail, {
        id: `cus-${i + 1}`,
        name: o.address.fullName,
        email: o.customerEmail,
        phone: o.address.phone,
        city: o.address.city,
        createdAt: o.createdAt,
      });
    }
  });
  return [...map.values()];
}

/** Ensures localStorage holds a full mock dataset. Safe to call repeatedly. */
export function ensureSeeded() {
  if (!isBrowser()) return;
  let all = read<Product[] | null>(KEYS.products, null);
  if (!all || all.length === 0) {
    all = buildSeedProducts();
    write(KEYS.products, all);
  }
  if (!read<string[] | null>(KEYS.categories, null)) {
    write(KEYS.categories, [...new Set(all.map((p) => p.category))]);
  }
  let orders = read<Order[] | null>(KEYS.orders, null);
  if (!orders) {
    orders = seedOrders(all);
    write(KEYS.orders, orders);
  }
  if (!read<Customer[] | null>(KEYS.customers, null)) {
    write(KEYS.customers, seedCustomers(orders));
  }
  if (!read<StoreSettings | null>(KEYS.settings, null)) {
    write(KEYS.settings, DEFAULT_SETTINGS);
  }
}

const delay = () => new Promise((r) => setTimeout(r, 120));

/* ------------------------------ products ------------------------------ */

export async function listProducts(): Promise<Product[]> {
  ensureSeeded();
  await delay();
  return read<Product[]>(KEYS.products, []);
}

export async function getProduct(id: string): Promise<Product | null> {
  const all = await listProducts();
  return all.find((p) => p.id === id) ?? null;
}

export async function saveProduct(input: Product): Promise<Product> {
  ensureSeeded();
  const all = read<Product[]>(KEYS.products, []);
  const idx = all.findIndex((p) => p.id === input.id);
  if (idx >= 0) all[idx] = input;
  else all.unshift({ ...input, createdAt: new Date().toISOString() });
  write(KEYS.products, all);
  const cats = read<string[]>(KEYS.categories, []);
  if (input.category && !cats.includes(input.category)) {
    write(KEYS.categories, [...cats, input.category]);
  }
  await delay();
  return input;
}

export async function deleteProduct(id: string): Promise<void> {
  ensureSeeded();
  write(
    KEYS.products,
    read<Product[]>(KEYS.products, []).filter((p) => p.id !== id),
  );
  await delay();
}

export async function updateStock(id: string, stock: number): Promise<void> {
  ensureSeeded();
  const all = read<Product[]>(KEYS.products, []);
  const idx = all.findIndex((p) => p.id === id);
  const cur = all[idx];
  if (cur) {
    all[idx] = { ...cur, stock: Math.max(0, Math.round(stock)) };
    write(KEYS.products, all);
  }
  await delay();
}

/* ----------------------------- categories ----------------------------- */

export async function listCategories(): Promise<string[]> {
  ensureSeeded();
  await delay();
  return read<string[]>(KEYS.categories, []);
}

export async function saveCategories(next: string[]): Promise<string[]> {
  ensureSeeded();
  write(KEYS.categories, next);
  await delay();
  return next;
}

export async function renameCategory(from: string, to: string): Promise<void> {
  ensureSeeded();
  const cats = read<string[]>(KEYS.categories, []).map((c) => (c === from ? to : c));
  write(KEYS.categories, [...new Set(cats)]);
  write(
    KEYS.products,
    read<Product[]>(KEYS.products, []).map((p) =>
      p.category === from ? { ...p, category: to } : p,
    ),
  );
  await delay();
}

export async function deleteCategory(name: string): Promise<void> {
  ensureSeeded();
  write(
    KEYS.categories,
    read<string[]>(KEYS.categories, []).filter((c) => c !== name),
  );
  await delay();
}

/* ------------------------------- orders ------------------------------- */

const LEGACY: Record<string, OrderStatus> = {
  pending: "Placed",
  processing: "Preparing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const normalize = (o: Order): Order => ({
  ...o,
  status: LEGACY[o.status as string] ?? o.status,
  history: o.history ?? [{ status: LEGACY[o.status as string] ?? o.status, at: o.createdAt }],
});

export async function listOrders(): Promise<Order[]> {
  ensureSeeded();
  await delay();
  return read<Order[]>(KEYS.orders, [])
    .map(normalize)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getOrder(id: string): Promise<Order | null> {
  const all = await listOrders();
  const q = id.trim().toLowerCase();
  return all.find((o) => o.id.toLowerCase() === q || o.reference.toLowerCase() === q) ?? null;
}

export async function createOrder(
  input: Omit<Order, "id" | "reference" | "createdAt" | "status">,
): Promise<Order> {
  ensureSeeded();
  const all = read<Order[]>(KEYS.orders, []);
  const n = all.length + 1;
  const order: Order = {
    ...input,
    id: `ord-${Date.now()}`,
    reference: `BC-10${n}`,
    createdAt: new Date().toISOString(),
    status: "Placed",
    history: [{ status: "Placed", at: new Date().toISOString() }],
  };
  write(KEYS.orders, [order, ...all]);

  // decrement stock so inventory stays believable
  const prods = read<Product[]>(KEYS.products, []);
  order.items.forEach((i) => {
    const idx = prods.findIndex((p) => p.id === i.productId);
    const cur = prods[idx];
    if (cur) prods[idx] = { ...cur, stock: Math.max(0, cur.stock - i.qty) };
  });
  write(KEYS.products, prods);

  // register the customer if new
  const customers = read<Customer[]>(KEYS.customers, []);
  if (!customers.some((c) => c.email === order.customerEmail)) {
    write(KEYS.customers, [
      ...customers,
      {
        id: `cus-${Date.now()}`,
        name: order.address.fullName,
        email: order.customerEmail,
        phone: order.address.phone,
        city: order.address.city,
        createdAt: order.createdAt,
      },
    ]);
  }

  await delay();
  return order;
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
  ensureSeeded();
  const all = read<Order[]>(KEYS.orders, []).map(normalize);
  const idx = all.findIndex((o) => o.id === id);
  const cur = all[idx];
  if (cur && cur.status !== status) {
    all[idx] = {
      ...cur,
      status,
      history: [...(cur.history ?? []), { status, at: new Date().toISOString() }],
    };
    write(KEYS.orders, all);
    // cancelling puts the stock back
    if (status === "Cancelled") {
      const prods = read<Product[]>(KEYS.products, []);
      cur.items.forEach((i) => {
        const k = prods.findIndex((p) => p.id === i.productId);
        const p = prods[k];
        if (p) prods[k] = { ...p, stock: p.stock + i.qty };
      });
      write(KEYS.products, prods);
    }
  }
  await delay();
}

/* ------------------------- customers + settings ------------------------- */

export async function listCustomers(): Promise<Customer[]> {
  ensureSeeded();
  await delay();
  return read<Customer[]>(KEYS.customers, []);
}

export async function getSettings(): Promise<StoreSettings> {
  ensureSeeded();
  await delay();
  return { ...DEFAULT_SETTINGS, ...read<StoreSettings>(KEYS.settings, DEFAULT_SETTINGS) };
}

export async function saveSettings(next: StoreSettings): Promise<StoreSettings> {
  ensureSeeded();
  write(KEYS.settings, next);
  await delay();
  return next;
}

export function readSettingsSync(): StoreSettings {
  return { ...DEFAULT_SETTINGS, ...read<StoreSettings>(KEYS.settings, DEFAULT_SETTINGS) };
}

/** Synchronous stock lookup for add-to-cart guards (browser only). */
export function getStockSync(id: string): number | null {
  if (!isBrowser()) return null;
  ensureSeeded();
  const p = read<Product[]>(KEYS.products, []).find((x) => x.id === id);
  return p ? p.stock : null;
}
