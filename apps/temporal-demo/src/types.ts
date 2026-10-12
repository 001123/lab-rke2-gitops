export interface Order {
  id: string;
  item: string;
  quantity: number;
  amount: number;
  customerName: string;
  simulatePaymentFailure?: boolean;
  simulateInventoryFailure?: boolean;
}

export type OrderStep = 
  | 'INITIALIZED'
  | 'PROCESSING_PAYMENT'
  | 'PAYMENT_COMPLETED'
  | 'RESERVING_INVENTORY'
  | 'INVENTORY_RESERVED'
  | 'AWAITING_APPROVAL'
  | 'DISPATCHING_SHIPPING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'COMPENSATING_REFUND'
  | 'REFUNDED';

export interface OrderState {
  orderId: string;
  status: OrderStep;
  logs: string[];
  paymentProcessed: boolean;
  inventoryReserved: boolean;
  approved: boolean;
  cancelled: boolean;
  shipped: boolean;
  refunded: boolean;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}
