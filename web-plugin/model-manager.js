// Model Manager Script
// Handles local model sync functionality

// Initialize model manager
async function initializeModelManager(element, getData) {
  const modelTabContent = element.querySelector("#model-tab-content");
  const modelLoading = element.querySelector("#model-loading");
  const modelList = element.querySelector("#model-list");

  // Store getData function globally for sync functionality
  window.comfyDeployGetModelData = getData;

  const data = getData();

  if (!modelTabContent || !modelLoading || !modelList) {
    console.warn("Model manager: Missing required elements", {
      modelTabContent: !!modelTabContent,
      modelLoading: !!modelLoading,
      modelList: !!modelList,
    });
    return;
  }

  if (!data.apiKey) {
    console.warn("Model manager: No API key available");
    return;
  }

  try {
    console.log("Model manager: Initializing...");
    // Show initial state
    showModelInitialState(modelLoading, modelList);
  } catch (error) {
    console.error("Model manager initialization error:", error);
    showModelError(modelLoading, modelList, "Error loading model manager");
  }
}

// Show initial model state
function showModelInitialState(modelLoading, modelList) {
  modelLoading.style.display = "none";
  modelList.style.display = "block";
  modelList.innerHTML = `
    <li style="text-align: center; padding: 16px; color: #666; font-size: 13px;">
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button 
          onclick="showModelSyncDialog()"
          style="
            background: #f39c12;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
          "
          title="Sync local models to cloud"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
            <path d="M16 16h5v5"/>
          </svg>
          Sync Models
        </button>
      </div>
    </li>
  `;
}

// Show error message
function showModelError(modelLoading, modelList, errorMessage) {
  modelLoading.style.display = "none";
  modelList.style.display = "block";
  modelList.innerHTML = `
    <li style="text-align: center; padding: 16px; color: #e74c3c; font-size: 13px;">
      <div style="margin-bottom: 8px;">⚠️</div>
      <div style="margin-bottom: 12px;">${errorMessage}</div>
    </li>
  `;
}

// Show model sync dialog
window.showModelSyncDialog = function () {
  // Create dialog overlay
  const overlay = document.createElement("div");
  overlay.id = "model-sync-dialog-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  // Create dialog box
  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background: #2c2c2c;
    border-radius: 12px;
    padding: 0;
    width: 800px;
    max-width: 90vw;
    max-height: 85vh;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  // Create dialog content
  dialog.innerHTML = `
    <div style="
      padding: 18px 24px;
      border-bottom: 1px solid #404040;
      background: linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Model Sync</h3>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
            Sync your local models to the cloud
          </p>
        </div>
        <button onclick="closeModelSyncDialog()" style="
          background: none;
          border: none;
          color: #999;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s;
        " onmouseover="this.style.background='#404040'" onmouseout="this.style.background='none'">×</button>
      </div>
    </div>
    
    <div id="model-sync-content" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      background: #1a1a1a;
    ">
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 24px; margin-bottom: 16px;">⏳</div>
        <div style="font-size: 16px; font-weight: 500;">Loading local models...</div>
        <div style="font-size: 13px; margin-top: 8px;">Scanning model directories</div>
      </div>
    </div>
    
    <div style="
      padding: 16px 20px;
      border-top: 1px solid #404040;
      background: linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <div id="model-selected-count" style="font-size: 12px; color: #999;">
        0 models selected
      </div>
      <div style="display: flex; gap: 12px;">
        <button onclick="closeModelSyncDialog()" style="
          background: #404040;
          color: white;
          border: none;
          border-radius: 6px;
          padding: 8px 18px;
          font-size: 13px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        " onmouseover="this.style.background='#555'" onmouseout="this.style.background='#404040'">
          Cancel
        </button>
        <button id="sync-models-btn" onclick="syncSelectedModels()" disabled style="
          background: #555;
          color: #999;
          border: none;
          border-radius: 6px;
          padding: 8px 20px;
          font-size: 13px;
          cursor: not-allowed;
          font-weight: 500;
          transition: all 0.2s;
        ">
          Sync Models
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeModelSyncDialog();
    }
  });

  // Load model data (placeholder for now)
  loadModelSyncData();
};

// Close model sync dialog
window.closeModelSyncDialog = function () {
  const overlay = document.getElementById("model-sync-dialog-overlay");
  if (overlay) {
    overlay.remove();
  }
  window.currentModelSyncData = null;
};

// Load model sync data (placeholder implementation)
async function loadModelSyncData() {
  try {
    // Simulate loading delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Placeholder model data - you'll replace this with actual model scanning
    const mockModels = [
      {
        name: "sd_xl_base_1.0.safetensors",
        path: "/models/checkpoints/",
        size: "6.94 GB",
        type: "checkpoint",
      },
      {
        name: "sd_xl_refiner_1.0.safetensors",
        path: "/models/checkpoints/",
        size: "6.08 GB",
        type: "checkpoint",
      },
      {
        name: "controlnet_canny.safetensors",
        path: "/models/controlnet/",
        size: "1.45 GB",
        type: "controlnet",
      },
    ];

    // Store data globally
    window.currentModelSyncData = {
      models: mockModels,
      selectedModels: new Set(),
    };

    renderModelSyncContent(mockModels);
  } catch (error) {
    console.error("Error loading model sync data:", error);
    renderModelSyncError("Failed to load local models");
  }
}

// Render model sync content
function renderModelSyncContent(models) {
  const content = document.getElementById("model-sync-content");
  if (!content) return;

  if (models.length === 0) {
    content.innerHTML = `
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 48px; margin-bottom: 16px;">📂</div>
        <div style="font-size: 16px; font-weight: 500;">No models found</div>
        <div style="font-size: 13px; margin-top: 8px;">No model files detected in local directories</div>
      </div>
    `;
    return;
  }

  // Group models by type
  const groupedModels = models.reduce((acc, model, index) => {
    model.index = index;
    if (!acc[model.type]) acc[model.type] = [];
    acc[model.type].push(model);
    return acc;
  }, {});

  const typeColors = {
    checkpoint: "#3498db",
    controlnet: "#e74c3c",
    lora: "#f39c12",
    vae: "#9b59b6",
    upscale: "#27ae60",
  };

  let contentHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h4 style="margin: 0; font-size: 14px; color: #ccc;">Local Models (${models.length})</h4>
      <div style="display: flex; gap: 8px;">
        <button onclick="selectAllModels()" style="
          background: #27ae60;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 500;
        ">Select All</button>
        <button onclick="deselectAllModels()" style="
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
          font-weight: 500;
        ">Deselect All</button>
      </div>
    </div>
  `;

  Object.entries(groupedModels).forEach(([type, typeModels]) => {
    const color = typeColors[type] || "#666";
    contentHTML += `
      <div style="margin-bottom: 16px;">
        <h5 style="
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: ${color};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">${type} (${typeModels.length})</h5>
        <div style="border: 1px solid #333; border-radius: 6px; background: #252525; overflow: hidden;">
          ${typeModels.map((model) => renderModelItem(model)).join("")}
        </div>
      </div>
    `;
  });

  content.innerHTML = contentHTML;

  // Enable sync button if we have models
  const syncBtn = document.getElementById("sync-models-btn");
  if (syncBtn) {
    syncBtn.disabled = false;
    syncBtn.style.background =
      "linear-gradient(135deg, #3498db 0%, #2980b9 100%)";
    syncBtn.style.color = "white";
    syncBtn.style.cursor = "pointer";
    syncBtn.style.boxShadow = "0 2px 8px rgba(52, 152, 219, 0.3)";
  }
}

// Render individual model item
function renderModelItem(model) {
  const isSelected =
    window.currentModelSyncData?.selectedModels.has(model.index) || false;

  return `
    <div style="
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #333;
    ">
      <input 
        type="checkbox" 
        id="model-${model.index}" 
        ${isSelected ? "checked" : ""}
        onchange="toggleModelSelection(${model.index})"
        style="margin-right: 10px; cursor: pointer; width: 16px; height: 16px;"
      />
      <div style="flex: 1;">
        <div style="font-weight: 500; font-size: 13px; color: #fff; margin-bottom: 2px;">
          ${model.name}
        </div>
        <div style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #666;">
          <span>${model.path}</span>
          <span>•</span>
          <span>${model.size}</span>
        </div>
      </div>
    </div>
  `;
}

// Render error state
function renderModelSyncError(message) {
  const content = document.getElementById("model-sync-content");
  if (!content) return;

  content.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #e74c3c;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Error</div>
      <div style="font-size: 13px;">${message}</div>
    </div>
  `;
}

// Toggle model selection
window.toggleModelSelection = function (index) {
  if (!window.currentModelSyncData) return;

  const selectedModels = window.currentModelSyncData.selectedModels;
  if (selectedModels.has(index)) {
    selectedModels.delete(index);
  } else {
    selectedModels.add(index);
  }

  updateModelSelectedCount();
};

// Select all models
window.selectAllModels = function () {
  if (!window.currentModelSyncData) return;

  const models = window.currentModelSyncData.models || [];
  window.currentModelSyncData.selectedModels = new Set(
    models.map((_, index) => index)
  );

  // Update checkboxes
  models.forEach((_, index) => {
    const checkbox = document.getElementById(`model-${index}`);
    if (checkbox) checkbox.checked = true;
  });

  updateModelSelectedCount();
};

// Deselect all models
window.deselectAllModels = function () {
  if (!window.currentModelSyncData) return;

  window.currentModelSyncData.selectedModels.clear();

  // Update checkboxes
  const models = window.currentModelSyncData.models || [];
  models.forEach((_, index) => {
    const checkbox = document.getElementById(`model-${index}`);
    if (checkbox) checkbox.checked = false;
  });

  updateModelSelectedCount();
};

// Update selected count display
function updateModelSelectedCount() {
  if (!window.currentModelSyncData) return;

  const selectedCount = window.currentModelSyncData.selectedModels.size;
  const countElement = document.querySelector("#model-selected-count");
  if (countElement) {
    countElement.textContent = `${selectedCount} models selected`;
  }
}

// Sync selected models (placeholder)
window.syncSelectedModels = async function () {
  if (!window.currentModelSyncData) return;

  const selectedModels = Array.from(
    window.currentModelSyncData.selectedModels
  ).map((index) => window.currentModelSyncData.models[index]);

  console.log("Syncing models:", selectedModels);

  // Show toast (placeholder)
  if (window.app?.extensionManager?.toast) {
    window.app.extensionManager.toast.add({
      severity: "info",
      summary: "Model sync started",
      detail: `Starting sync for ${selectedModels.length} models`,
      life: 3000,
    });
  }

  // Close dialog
  closeModelSyncDialog();

  // TODO: Implement actual sync logic
};

// Export the main function
export { initializeModelManager };
