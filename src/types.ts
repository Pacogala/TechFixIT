
export type UserRole = 'admin' | 'technician';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  createdAt: any;
}

export type RepairStatus = 'recibido' | 'diagnostico' | 'esperando_piezas' | 'reparado' | 'entregado';
export type EquipmentType = 'PC' | 'Laptop' | 'Celular' | 'Impresora' | 'Tablet' | 'Otro';

export interface Repair {
  id: string;
  customerId: string;
  customerName?: string; // Denormalized for easier search
  client?: any; // Full client info
  equipment: {
    type: EquipmentType;
    brand: string;
    model: string;
    serial: string;
  };
  status: RepairStatus;
  diagnostic?: string;
  actionsPerformed?: string[];
  parts?: {
    name: string;
    serial?: string;
    price: number;
    quantity: number;
  }[];
  quote?: {
    total: number;
    labor: number;
    authorized: boolean;
    authorizedAt?: any;
    notes?: string;
  };
  notes: string;
  photos: string[];
  createdAt: any;
  updatedAt: any;
  technicianId: string;
}

export type SaleStatus = 'cotizacion' | 'vendido';

export interface Sale {
  id: string;
  customerId?: string;
  items: {
    productId?: string;
    name: string;
    price: number;
    quantity: number;
  }[];
  total: number;
  status: SaleStatus;
  createdAt: any;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  sku?: string;
  price: number;
  stock: number;
  minStock?: number;
}

export interface Activity {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: any;
}

export interface BusinessSettings {
  name: string;
  rfc: string;
  address: string;
  phone: string;
  logo?: string;
  customMessage?: string;
  pdfPrimaryColor?: string;
  pdfAccentColor?: string;
  pdfTermsAndConditions?: string;
}
