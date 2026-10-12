import { Order } from './types';

// Helper to simulate realistic network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function processPayment(order: Order): Promise<{ transactionId: string; amount: number }> {
  console.log(`[Activity] 💳 Processing payment of $${order.amount} for Order #${order.id}...`);
  await delay(1500);

  if (order.simulatePaymentFailure) {
    console.error(`[Activity] ❌ Payment failed: Card declined by bank for Order #${order.id}`);
    throw new Error('Payment declined by issuing bank (Simulated failure)');
  }

  const transactionId = `txn_${Math.random().toString(36).substring(2, 10)}`;
  console.log(`[Activity] ✅ Payment successful: ${transactionId}`);
  return { transactionId, amount: order.amount };
}

export async function reserveInventory(order: Order): Promise<{ reservationId: string }> {
  console.log(`[Activity] 📦 Reserving ${order.quantity}x ${order.item} in warehouse for Order #${order.id}...`);
  await delay(1500);

  if (order.simulateInventoryFailure) {
    console.error(`[Activity] ❌ Inventory allocation failed: Out of stock for item ${order.item}`);
    throw new Error(`Inventory out of stock for item ${order.item} (Simulated failure)`);
  }

  const reservationId = `res_${Math.random().toString(36).substring(2, 10)}`;
  console.log(`[Activity] ✅ Inventory reserved: ${reservationId}`);
  return { reservationId };
}

export async function dispatchShipping(order: Order): Promise<{ trackingNumber: string }> {
  console.log(`[Activity] 🚚 Dispatching courier for Order #${order.id} to ${order.customerName}...`);
  await delay(1500);

  const trackingNumber = `TRK-${Date.now().toString().slice(-6)}`;
  console.log(`[Activity] ✅ Package dispatched with tracking #${trackingNumber}`);
  return { trackingNumber };
}

// Saga Compensation Activity
export async function refundPayment(order: Order): Promise<{ refundId: string }> {
  console.log(`[Activity] 🔄 [Saga Compensation] Refunding $${order.amount} for Order #${order.id}...`);
  await delay(1200);

  const refundId = `ref_${Math.random().toString(36).substring(2, 10)}`;
  console.log(`[Activity] ✅ Refund completed: ${refundId}`);
  return { refundId };
}
