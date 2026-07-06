import type { CollectionRecord } from "../../storage/index.js";

export type PaymentRecord = CollectionRecord & {
  id: string;
  customerId?: string;
  companyId?: string;
  amount: number;
  allocatedAmount: number;
  unallocatedAmount: number;
  method?: string;
  paidAt: string;
  comment?: string;
};

export type PaymentAllocationRecord = CollectionRecord & {
  id: string;
  paymentId: string;
  orderId: string;
  amount: number;
};
