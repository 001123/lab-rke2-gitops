import { NativeConnection, Worker } from '@temporalio/worker';
import * as activities from './activities';

const TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || 'temporal-frontend.temporal-dev.svc.cluster.local:7233';
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || 'default';
export const TASK_QUEUE = 'order-processing-queue';

async function runWorker() {
  console.log(`[Worker] 🚀 Connecting to Temporal Server at ${TEMPORAL_ADDRESS} (Namespace: ${TEMPORAL_NAMESPACE})...`);

  // Connect to the Temporal server
  const connection = await NativeConnection.connect({
    address: TEMPORAL_ADDRESS,
  });

  console.log(`[Worker] ✅ Connected! Initializing Worker on Task Queue: '${TASK_QUEUE}'...`);

  const worker = await Worker.create({
    connection,
    namespace: TEMPORAL_NAMESPACE,
    taskQueue: TASK_QUEUE,
    workflowsPath: require.resolve('./workflows'),
    activities,
  });

  console.log(`[Worker] 👂 Worker started and listening for tasks on queue '${TASK_QUEUE}'...`);
  await worker.run();
}

runWorker().catch((err) => {
  console.error('[Worker] ❌ Fatal error running worker:', err);
  process.exit(1);
});
