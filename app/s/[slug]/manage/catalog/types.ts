export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unit: string;
  unitKind: string;
  packCount: number | null;
  packAmount: number | null;
  packUnit: string | null;
  packSize: string | null;
  byWeight: boolean;
  priceCents: number;
  inStock: boolean;
  imageIds: string | null;
};

export type Category = { id: string; name: string; emoji: string };

export const photoIds = (p: Pick<Product, "imageIds">): string[] => {
  try {
    const v = p.imageIds ? JSON.parse(p.imageIds) : [];
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};
