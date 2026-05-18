import { z } from 'zod';

export const variantOptionSchema = z.object({
  name: z.string().min(1),
  values: z.array(z.string().min(1)).min(1),
});

export const generateVariantsSchema = z.object({
  options: z.array(variantOptionSchema).min(1),
  replaceExisting: z.boolean().optional().default(false),
});

export type VariantOption = z.infer<typeof variantOptionSchema>;

/** Build variant display names from option dimensions (cartesian product). */
export function buildVariantNames(options: VariantOption[]): string[] {
  const cleaned = options
    .map((o) => ({
      name: o.name.trim(),
      values: [...new Set(o.values.map((v) => v.trim()).filter(Boolean))],
    }))
    .filter((o) => o.values.length > 0);

  if (cleaned.length === 0) return [];

  return cleaned
    .reduce<string[][]>(
      (acc, opt) => acc.flatMap((combo) => opt.values.map((v) => [...combo, v])),
      [[]] as string[][],
    )
    .map((combo) => combo.join(' / '));
}
