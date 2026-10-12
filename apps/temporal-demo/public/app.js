// DOM Elements
const orderForm = document.getElementById('orderForm');
const productSelect = document.getElementById('productSelect');
const customerNameInput = document.getElementById('customerName');
const orderQuantityInput = document.getElementById('orderQuantity');
const simPaymentFailure = document.getElementById('simPaymentFailure');
const simInventoryFailure = document.getElementById('simInventoryFailure');
const btnSubmitOrder = document.getElementById('btnSubmitOrder');

const currentWorkflowTitle = document.getElementById('currentWorkflowTitle');
const workflowStatusBadge = document.getElementById('workflowStatusBadge');
const workflowIdSubtitle = document.getElementById('workflowIdSubtitle');
const btnOpenInTemporal = document.getElementById('btnOpenInTemporal');
const recentOrdersList = document.getElementById('recentOrdersList');

// Stepper Elements
const stepPayment = document.getElementById('step-payment');
const stepInventory = document.getElementById('step-inventory');
const stepApproval = document.getElementById('step-approval');
const stepShipping = document.getElementById('step-shipping');
const connectors = document.querySelectorAll('.step-connector');

// Signal & Saga Boxes
const signalActionBox = document.getElementById('signalActionBox');
const btnApproveSignal = document.getElementById('btnApproveSignal');
const btnCancelSignal = document.getElementById('btnCancelSignal');
const sagaCompensationBox = document.getElementById('sagaCompensationBox');
const sagaCompensationText = document.getElementById('sagaCompensationText');

// Terminal Elements
const terminalConsole = document.getElementById('terminalConsole');
const logCounter = document.getElementById('logCounter');

let currentOrderId = null;
let pollInterval = null;
let temporalWebBase = 'https://dev-temporal.192.168.250.215.nip.io';

// Fetch Config on startup
async function fetchConfig() {
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (data.temporalWebUrl) {
      temporalWebBase = data.temporalWebUrl;
      const dashLink = document.getElementById('temporalDashboardLink');
      if (dashLink) dashLink.href = temporalWebBase;
    }
  } catch (e) {
    console.warn('Could not load config:', e);
  }
}

// Reset Stepper
function resetStepper() {
  [stepPayment, stepInventory, stepApproval, stepShipping].forEach(el => {
    el.className = 'step-item step-pending';
  });
  connectors.forEach(c => c.className = 'step-connector');
  signalActionBox.classList.add('hidden');
  sagaCompensationBox.classList.add('hidden');
}

// Update Stepper based on Workflow State
function updateStepper(state) {
  if (!state) return;

  const status = state.status;

  // Reset
  [stepPayment, stepInventory, stepApproval, stepShipping].forEach(el => {
    el.className = 'step-item step-pending';
  });
  connectors.forEach(c => c.className = 'step-connector');

  // Step 1: Payment
  if (state.paymentProcessed) {
    stepPayment.className = 'step-item step-completed';
    connectors[0].className = 'step-connector completed';
  } else if (status === 'PROCESSING_PAYMENT') {
    stepPayment.className = 'step-item step-active';
  } else if (status === 'FAILED' && !state.paymentProcessed) {
    stepPayment.className = 'step-item step-failed';
  }

  // Step 2: Inventory
  if (state.inventoryReserved) {
    stepInventory.className = 'step-item step-completed';
    connectors[1].className = 'step-connector completed';
  } else if (status === 'RESERVING_INVENTORY') {
    stepInventory.className = 'step-item step-active';
  } else if ((status === 'FAILED' || status === 'COMPENSATING_REFUND' || state.refunded) && !state.inventoryReserved) {
    stepInventory.className = 'step-item step-failed';
  }

  // Step 3: Approval (Human Signal)
  if (state.approved) {
    stepApproval.className = 'step-item step-completed';
    connectors[2].className = 'step-connector completed';
  } else if (status === 'AWAITING_APPROVAL') {
    stepApproval.className = 'step-item step-active';
    signalActionBox.classList.remove('hidden');
  } else if (state.cancelled) {
    stepApproval.className = 'step-item step-failed';
  }

  // Hide signal box if no longer awaiting approval
  if (status !== 'AWAITING_APPROVAL') {
    signalActionBox.classList.add('hidden');
  }

  // Step 4: Shipping
  if (state.shipped) {
    stepShipping.className = 'step-item step-completed';
  } else if (status === 'DISPATCHING_SHIPPING') {
    stepShipping.className = 'step-item step-active';
  }

  // Saga Compensation Box
  if (state.refunded || status === 'COMPENSATING_REFUND') {
    sagaCompensationBox.classList.remove('hidden');
    sagaCompensationText.textContent = state.errorMessage || 
      'Khách hàng hủy đơn hoặc lỗi kho -> Temporal Workflow tự động kích hoạt Activity bồi hoàn hoàn tiền 100%.';
  } else {
    sagaCompensationBox.classList.add('hidden');
  }

  // Badge Status
  updateBadge(status);

  // Update Logs
  if (state.logs && state.logs.length > 0) {
    terminalConsole.innerHTML = state.logs
      .map(log => `<div class="terminal-line">${escapeHtml(log)}</div>`)
      .join('');
    terminalConsole.scrollTop = terminalConsole.scrollHeight;
    logCounter.textContent = `${state.logs.length} events`;
  }
}

function updateBadge(status) {
  let badgeClass = 'badge-idle';
  let badgeText = status;

  switch (status) {
    case 'PROCESSING_PAYMENT':
    case 'RESERVING_INVENTORY':
    case 'DISPATCHING_SHIPPING':
      badgeClass = 'badge-running';
      badgeText = 'ĐANG XỬ LÝ';
      break;
    case 'AWAITING_APPROVAL':
      badgeClass = 'badge-awaiting';
      badgeText = 'CHỜ DUYỆT (SIGNAL)';
      break;
    case 'COMPLETED':
      badgeClass = 'badge-completed';
      badgeText = 'HOÀN THÀNH';
      break;
    case 'FAILED':
    case 'CANCELLED':
    case 'REFUNDED':
      badgeClass = 'badge-failed';
      badgeText = status === 'CANCELLED' ? 'ĐÃ HỦY' : 'THẤT BẠI';
      break;
  }

  workflowStatusBadge.className = `badge-status ${badgeClass}`;
  workflowStatusBadge.textContent = badgeText;
}

// Poll order status
async function pollOrder(orderId) {
  try {
    const res = await fetch(`/api/orders/${orderId}`);
    if (!res.ok) return;

    const data = await res.json();
    currentWorkflowTitle.textContent = `Order #${orderId} (${data.workflowId})`;
    workflowIdSubtitle.textContent = `Workflow RunID: ${data.runId} | Status: ${data.status}`;
    
    btnOpenInTemporal.classList.remove('hidden');
    btnOpenInTemporal.href = data.temporalWebLink || `${temporalWebBase}/namespaces/default/workflows/order-${orderId}`;

    if (data.state) {
      updateStepper(data.state);
      if (['COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED'].includes(data.state.status)) {
        clearInterval(pollInterval);
      }
    }
  } catch (err) {
    console.error('Error polling order:', err);
  }
}

// Start watching an order
function startWatchingOrder(orderId) {
  if (pollInterval) clearInterval(pollInterval);
  currentOrderId = orderId;
  resetStepper();
  pollOrder(orderId);
  pollInterval = setInterval(() => pollOrder(orderId), 1000);
}

// Submit Order Form
orderForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const selectedOpt = productSelect.options[productSelect.selectedIndex];
  const item = selectedOpt.value;
  const basePrice = Number(selectedOpt.getAttribute('data-price') || 100);
  const quantity = Number(orderQuantityInput.value);
  const amount = basePrice * quantity;
  const customerName = customerNameInput.value.trim();

  btnSubmitOrder.disabled = true;
  btnSubmitOrder.innerHTML = `<span>Đang khởi động Workflow...</span>`;

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item,
        quantity,
        amount,
        customerName,
        simulatePaymentFailure: simPaymentFailure.checked,
        simulateInventoryFailure: simInventoryFailure.checked,
      }),
    });

    const data = await res.json();
    if (data.success) {
      loadRecentOrders();
      startWatchingOrder(data.order.id);
    } else {
      alert(`Lỗi: ${data.error}`);
    }
  } catch (err) {
    alert(`Không thể gửi đơn hàng: ${err.message}`);
  } finally {
    btnSubmitOrder.disabled = false;
    btnSubmitOrder.innerHTML = `
      <span>Đặt hàng & Khởi động Workflow</span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="5" y1="12" x2="19" y2="12"></line>
        <polyline points="12 5 19 12 12 19"></polyline>
      </svg>
    `;
  }
});

// Signal: Approve Order
btnApproveSignal.addEventListener('click', async () => {
  if (!currentOrderId) return;
  btnApproveSignal.disabled = true;
  try {
    await fetch(`/api/orders/${currentOrderId}/approve`, { method: 'POST' });
    signalActionBox.classList.add('hidden');
  } catch (e) {
    alert(`Lỗi gửi Signal: ${e.message}`);
  } finally {
    btnApproveSignal.disabled = false;
  }
});

// Signal: Cancel Order
btnCancelSignal.addEventListener('click', async () => {
  if (!currentOrderId) return;
  btnCancelSignal.disabled = true;
  try {
    await fetch(`/api/orders/${currentOrderId}/cancel`, { method: 'POST' });
    signalActionBox.classList.add('hidden');
  } catch (e) {
    alert(`Lỗi gửi Signal: ${e.message}`);
  } finally {
    btnCancelSignal.disabled = false;
  }
});

// Load Recent Orders
async function loadRecentOrders() {
  try {
    const res = await fetch('/api/orders');
    const orders = await res.json();

    if (!orders || orders.length === 0) {
      recentOrdersList.innerHTML = `<div class="empty-state">Chưa có đơn hàng nào được tạo.</div>`;
      return;
    }

    recentOrdersList.innerHTML = orders.map(ord => `
      <div class="recent-order-item ${ord.id === currentOrderId ? 'active' : ''}" onclick="startWatchingOrder('${ord.id}')">
        <div>
          <strong>#${ord.id}</strong> — ${escapeHtml(ord.item)}
        </div>
        <span class="text-muted">$${ord.amount}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Error loading recent orders:', err);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Init
fetchConfig();
loadRecentOrders();
