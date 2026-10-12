import { proxyActivities, defineSignal, defineQuery, setHandler, condition } from '@temporalio/workflow';
import type * as activities from './activities';
import { Order, OrderState } from './types';

// Configure proxy activities with retry policy and timeouts
const { processPayment, reserveInventory, dispatchShipping, refundPayment } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 minute',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 2, // low attempts so user sees simulated failure quickly
  },
});

// Signals: External asynchronous inputs to the workflow
export const approveOrderSignal = defineSignal('approveOrder');
export const cancelOrderSignal = defineSignal('cancelOrder');

// Queries: Read-only synchronous inspections of workflow state
export const getOrderStateQuery = defineQuery<OrderState>('getOrderState');

export async function orderFulfillmentWorkflow(order: Order): Promise<OrderState> {
  const state: OrderState = {
    orderId: order.id,
    status: 'INITIALIZED',
    logs: [`[${new Date().toLocaleTimeString()}] Order #${order.id} workflow started for customer ${order.customerName}.`],
    paymentProcessed: false,
    inventoryReserved: false,
    approved: false,
    cancelled: false,
    shipped: false,
    refunded: false,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const addLog = (msg: string) => {
    state.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
    state.updatedAt = Date.now();
  };

  // Register Query handler so web clients can inspect state at any time
  setHandler(getOrderStateQuery, () => state);

  // Register Signal handlers to react to human input from the UI
  setHandler(approveOrderSignal, () => {
    if (state.status === 'AWAITING_APPROVAL' && !state.cancelled) {
      state.approved = true;
      addLog(`Customer approved order #${order.id} via Web Signal.`);
    }
  });

  setHandler(cancelOrderSignal, () => {
    if (!state.shipped && !state.cancelled) {
      state.cancelled = true;
      addLog(`Customer cancelled order #${order.id} via Web Signal.`);
    }
  });

  try {
    // -------------------------------------------------------------
    // Step 1: Charge Payment
    // -------------------------------------------------------------
    state.status = 'PROCESSING_PAYMENT';
    addLog(`Calling activity: processPayment ($${order.amount})...`);
    const paymentResult = await processPayment(order);
    state.paymentProcessed = true;
    state.status = 'PAYMENT_COMPLETED';
    addLog(`Payment successfully processed (Txn: ${paymentResult.transactionId}).`);

    // -------------------------------------------------------------
    // Step 2: Reserve Warehouse Inventory (with Saga Compensation)
    // -------------------------------------------------------------
    state.status = 'RESERVING_INVENTORY';
    addLog(`Calling activity: reserveInventory (${order.quantity}x ${order.item})...`);
    try {
      const inventoryResult = await reserveInventory(order);
      state.inventoryReserved = true;
      state.status = 'INVENTORY_RESERVED';
      addLog(`Inventory reserved (Reservation: ${inventoryResult.reservationId}).`);
    } catch (invErr: any) {
      // SAGA COMPENSATION: Payment succeeded, but inventory failed!
      addLog(`Inventory failed: ${invErr.message}. Initiating Saga compensation...`);
      state.status = 'COMPENSATING_REFUND';
      await refundPayment(order);
      state.refunded = true;
      state.status = 'FAILED';
      state.errorMessage = `Out of stock: ${invErr.message}. Payment has been automatically refunded.`;
      addLog(`Saga compensation complete: Customer has been refunded.`);
      return state;
    }

    // -------------------------------------------------------------
    // Step 3: Human-in-the-loop Approval (Durable Timer & Signal)
    // -------------------------------------------------------------
    state.status = 'AWAITING_APPROVAL';
    addLog(`Awaiting human approval via Signal (or timeout in 120 seconds)...`);

    // Wait until customer clicks "Approve" or "Cancel", or 120 seconds elapse
    const conditionMet = await condition(() => state.approved || state.cancelled, '120s');

    if (!conditionMet) {
      addLog(`Approval timed out after 120s. Auto-cancelling order.`);
      state.cancelled = true;
    }

    if (state.cancelled) {
      addLog(`Order cancelled. Initiating Saga compensation...`);
      state.status = 'COMPENSATING_REFUND';
      await refundPayment(order);
      state.refunded = true;
      state.status = 'CANCELLED';
      addLog(`Saga compensation complete: Customer has been refunded.`);
      return state;
    }

    // -------------------------------------------------------------
    // Step 4: Dispatch Courier Shipping
    // -------------------------------------------------------------
    state.status = 'DISPATCHING_SHIPPING';
    addLog(`Calling activity: dispatchShipping...`);
    const shippingResult = await dispatchShipping(order);
    state.shipped = true;
    state.status = 'COMPLETED';
    addLog(`Order successfully fulfilled! Tracking #${shippingResult.trackingNumber}.`);

    return state;
  } catch (err: any) {
    state.status = 'FAILED';
    state.errorMessage = err.message || 'Unknown error occurred';
    addLog(`Workflow failed: ${state.errorMessage}`);
    return state;
  }
}
