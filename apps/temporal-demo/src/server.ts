import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { Connection, Client } from '@temporalio/client';
import { orderFulfillmentWorkflow, approveOrderSignal, cancelOrderSignal, getOrderStateQuery } from './workflows';
import { Order, OrderState } from './types';

const PORT = parseInt(process.env.PORT || '3000', 10);
const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'temporal-frontend.temporal-dev.svc.cluster.local:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
const TASK_QUEUE = 'order-processing-queue';
const TEMPORAL_WEB_URL = process.env.TEMPORAL_WEB_URL || 'https://dev-temporal.192.168.250.215.nip.io';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

let temporalClient: Client | null = null;
const recentOrders: Order[] = [];

async function getClient(): Promise<Client> {
  if (!temporalClient) {
    console.log(`[API Server] 🔌 Connecting to Temporal cluster at ${TEMPORAL_ADDRESS}...`);
    const connection = await Connection.connect({ address: TEMPORAL_ADDRESS });
    temporalClient = new Client({ connection, namespace: TEMPORAL_NAMESPACE });
    console.log(`[API Server] ✅ Connected to Temporal client!`);
  }
  return temporalClient;
}

// Config endpoint for UI
app.get('/api/config', (_req: Request, res: Response) => {
  res.json({
    temporalWebUrl: TEMPORAL_WEB_URL,
    temporalNamespace: TEMPORAL_NAMESPACE,
    temporalAddress: TEMPORAL_ADDRESS,
  });
});

// List recent orders
app.get('/api/orders', (_req: Request, res: Response) => {
  res.json(recentOrders.slice(-20).reverse());
});

// Create and trigger a new Order Workflow
app.post('/api/orders', async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    const orderData = req.body;

    const order: Order = {
      id: orderData.id || `ORD-${Date.now().toString().slice(-5)}`,
      item: orderData.item || 'Mechanical Keyboard Pro',
      quantity: Number(orderData.quantity) || 1,
      amount: Number(orderData.amount) || 149,
      customerName: orderData.customerName || 'Alex Johnson',
      simulatePaymentFailure: Boolean(orderData.simulatePaymentFailure),
      simulateInventoryFailure: Boolean(orderData.simulateInventoryFailure),
    };

    const workflowId = `order-${order.id}`;

    console.log(`[API Server] 🚀 Triggering workflow '${workflowId}' on task queue '${TASK_QUEUE}'...`);
    const handle = await client.workflow.start(orderFulfillmentWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId,
      args: [order],
    });

    recentOrders.push(order);

    res.json({
      success: true,
      order,
      workflowId,
      runId: handle.firstExecutionRunId,
      temporalWebLink: `${TEMPORAL_WEB_URL}/namespaces/${TEMPORAL_NAMESPACE}/workflows/${workflowId}`,
    });
  } catch (err: any) {
    console.error('[API Server] ❌ Error starting workflow:', err);
    res.status(500).json({ error: err.message });
  }
});

// Query live workflow state via Temporal Query
app.get('/api/orders/:id', async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    const workflowId = `order-${req.params.id}`;
    const handle = client.workflow.getHandle(workflowId);

    const description = await handle.describe();
    let state: OrderState | null = null;

    try {
      state = await handle.query(getOrderStateQuery);
    } catch {
      // Query might fail if workflow hasn't executed yet or finished abruptly
    }

    res.json({
      workflowId,
      runId: description.runId,
      status: description.status.name,
      startTime: description.startTime,
      closeTime: description.closeTime,
      state,
      temporalWebLink: `${TEMPORAL_WEB_URL}/namespaces/${TEMPORAL_NAMESPACE}/workflows/${workflowId}`,
    });
  } catch (err: any) {
    res.status(404).json({ error: err.message });
  }
});

// Send Signal: Approve Order
app.post('/api/orders/:id/approve', async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    const workflowId = `order-${req.params.id}`;
    const handle = client.workflow.getHandle(workflowId);

    console.log(`[API Server] 🔔 Sending 'approveOrder' signal to ${workflowId}...`);
    await handle.signal(approveOrderSignal);

    res.json({ success: true, message: `Approved signal sent to ${workflowId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send Signal: Cancel Order
app.post('/api/orders/:id/cancel', async (req: Request, res: Response) => {
  try {
    const client = await getClient();
    const workflowId = `order-${req.params.id}`;
    const handle = client.workflow.getHandle(workflowId);

    console.log(`[API Server] 🔔 Sending 'cancelOrder' signal to ${workflowId}...`);
    await handle.signal(cancelOrderSignal);

    res.json({ success: true, message: `Cancel signal sent to ${workflowId}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Server] 🌐 Express server listening on http://0.0.0.0:${PORT}`);
});
