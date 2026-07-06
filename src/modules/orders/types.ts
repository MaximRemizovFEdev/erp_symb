import type { CollectionRecord } from "../../storage/index.js";

export type OrderRecord = CollectionRecord & {
  id: string;
  orderNumber: string;
  customerId: string;
  companyId?: string;
  managerEmployeeId?: string;
  orderStatusId: string;
  officeStatusId: string;
  comment?: string;
  orderSum: number;
  itemsTotalCost: number;
  itemsManagerCommissionSum: number;
  itemsTaxSum: number;
  profitSum: number;
  paidAmount: number;
  paymentDue: number;
  officePaymentDue: number;
  overpaidAmount: number;
  marginPercent: number;
};

export type OrderItemRecord = CollectionRecord & {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  pricePerUnit: number;
  contractor1Cost?: number;
  contractor2Cost?: number;
  managerPercent?: number;
  taxPercent?: number;
  contractorId?: string;
  productionStatusId?: string;
  officeStatusId?: string;
  comment?: string;
  orderSum: number;
  unitCost: number;
  totalCost: number;
  managerCommissionSum: number;
  taxSum: number;
  profitSum: number;
  marginPercent: number;
};

export type OrderWithItems = OrderRecord & {
  items: OrderItemRecord[];
};
