import type { CollectionRecord } from "../../storage/index.js";

export type CustomerRecord = CollectionRecord & {
  id: string;
  fullName: string;
  phone?: string;
  email?: string;
  comment?: string;
  active?: boolean;
  balance?: number;
};

export type CustomerCompanyRecord = CollectionRecord & {
  id: string;
  name: string;
  inn?: string;
  kpp?: string;
  legalAddress?: string;
  comment?: string;
  active?: boolean;
  balance?: number;
};

export type CustomerCompanyLinkRecord = CollectionRecord & {
  id: string;
  customerId: string;
  companyId: string;
  role?: string;
  active?: boolean;
};
