export const STRIPE_PRODUCTION_PRODUCT_IDS = {
  semente: 'prod_VHJyIji7BiDXMN',
  crescimento: 'prod_VHK0NV797cK5v2',
  expansao: 'prod_VHK1R5xL6SKUm5',
  ministerio: 'prod_VHK29Q00ifpUrw',
} as const;

export type StripeProductionPlanCode = keyof typeof STRIPE_PRODUCTION_PRODUCT_IDS;
