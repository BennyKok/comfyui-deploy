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
        <button id="close-models-btn" onclick="closeModelSyncDialog()" style="
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

  // If an upload is in progress, show progress view instead of selection list
  if (
    window.__modelSyncUploading &&
    Array.isArray(window.__modelSyncUploadingModels)
  ) {
    const syncBtnEl = document.getElementById("sync-models-btn");
    if (syncBtnEl) syncBtnEl.style.display = "none";
    showProgressView(window.__modelSyncUploadingModels);
  } else {
    // Load model data (placeholder for now)
    loadModelSyncData();
  }
};

// Close model sync dialog
window.closeModelSyncDialog = function () {
  const overlay = document.getElementById("model-sync-dialog-overlay");
  if (overlay) {
    overlay.remove();
  }
  window.currentModelSyncData = null;
};

// Load model sync data from API
async function loadModelSyncData() {
  try {
    // Fetch real model data from your API
    const response = await fetch("/comfyui-deploy/models");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const modelsData = await response.json();

    // Process and filter the data
    const processedModels = processModelsData(modelsData);

    // Store data globally
    window.currentModelSyncData = {
      models: processedModels,
      selectedModels: new Set(),
    };

    renderModelSyncContent(processedModels);
  } catch (error) {
    console.error("Error loading model sync data:", error);
    renderModelSyncError("Failed to load local models");
  }
}

// Process models data from API response
function processModelsData(modelsData) {
  const processedModels = [];
  let modelIndex = 0;

  // Filter out unwanted categories
  const skipCategories = ["custom_nodes", "configs", "download_model_base"];

  Object.entries(modelsData).forEach(([modelType, modelInfo]) => {
    if (skipCategories.includes(modelType)) {
      return; // Skip these categories
    }

    const [paths, extensions, files] = modelInfo;

    // Filter files based on accepted extensions
    const filteredFiles = filterFilesByExtensions(files, extensions);

    // Process each file
    filteredFiles.forEach((file) => {
      processedModels.push({
        index: modelIndex++,
        name: file,
        type: modelType,
        paths: paths,
        extensions: extensions,
        // Parse nested folder structure for display
        displayPath: getDisplayPath(file),
        isNested: file.includes("/"),
        size: "Unknown", // We don't have size info from the API
      });
    });
  });

  return processedModels;
}

// Filter files by accepted extensions
function filterFilesByExtensions(files, extensions) {
  if (!files || files.length === 0) return [];
  if (!extensions || extensions.length === 0) return files;

  // Handle special case for "folder" extension (like diffusers)
  if (extensions.includes("folder")) {
    return files;
  }

  return files.filter((file) => {
    const fileExt = "." + file.split(".").pop().toLowerCase();
    return extensions.some((ext) => ext.toLowerCase() === fileExt);
  });
}

// Get display path for file tree
function getDisplayPath(filePath) {
  if (!filePath.includes("/")) {
    return filePath; // Root level file
  }

  const parts = filePath.split("/");
  return parts.slice(0, -1).join("/"); // Return path without filename
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
  const groupedModels = models.reduce((acc, model) => {
    if (!acc[model.type]) acc[model.type] = [];
    acc[model.type].push(model);
    return acc;
  }, {});

  const typeColors = {
    checkpoints: "#3498db",
    controlnet: "#e74c3c",
    loras: "#f39c12",
    vae: "#9b59b6",
    upscale_models: "#27ae60",
    text_encoders: "#e67e22",
    diffusion_models: "#8e44ad",
    clip_vision: "#16a085",
    style_models: "#c0392b",
    embeddings: "#f1c40f",
    diffusers: "#34495e",
    vae_approx: "#95a5a6",
    gligen: "#2ecc71",
    hypernetworks: "#e74c3c",
    photomaker: "#9b59b6",
    classifiers: "#34495e",
    model_patches: "#f39c12",
    audio_encoders: "#e67e22",
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

    // Build file tree structure for this type
    const fileTree = buildFileTree(typeModels);

    contentHTML += `
      <div style="margin-bottom: 16px;">
        <h5 style="
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: ${color};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">${type.replace("_", " ")} (${typeModels.length})</h5>
        <div style="border: 1px solid #333; border-radius: 6px; background: #252525; overflow: hidden;">
          ${renderFileTree(fileTree)}
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

// Build file tree structure
function buildFileTree(models) {
  const tree = {};

  models.forEach((model) => {
    if (model.isNested) {
      const pathParts = model.name.split("/");
      const fileName = pathParts.pop();
      const folderPath = pathParts.join("/");

      if (!tree[folderPath]) {
        tree[folderPath] = [];
      }
      tree[folderPath].push({
        ...model,
        displayName: fileName,
      });
    } else {
      // Root level files
      if (!tree["_root"]) {
        tree["_root"] = [];
      }
      tree["_root"].push({
        ...model,
        displayName: model.name,
      });
    }
  });

  return tree;
}

// Render file tree
function renderFileTree(tree) {
  let html = "";

  // Render root files first
  if (tree["_root"]) {
    tree["_root"].forEach((model) => {
      html += renderModelItem(model, false);
    });
  }

  // Render folders
  Object.entries(tree).forEach(([folderPath, files]) => {
    if (folderPath === "_root") return;

    const filesId = `files-${folderPath.replace(/[^a-zA-Z0-9]/g, "-")}`;

    html += `
      <div 
        onclick="toggleFolder('${filesId}', this)"
        style="
          background: #1a1a1a;
          border-bottom: 1px solid #333;
          padding: 8px 12px;
          font-size: 11px;
          color: #888;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.2s;
        "
        onmouseover="this.style.background='#222'"
        onmouseout="this.style.background='#1a1a1a'"
      >
        <span class="folder-icon" style="color: #FFFFFF;">▶</span>
        <span style="color: #f39c12;">📁</span>
        ${folderPath}
        <span style="margin-left: auto; font-size: 10px; color: #666;">(${files.length})</span>
      </div>
      <div id="${filesId}" style="display: none;">
    `;

    files.forEach((model) => {
      html += renderModelItem(model, true);
    });

    html += `</div>`;
  });

  return html;
}

// Render individual model item
function renderModelItem(model, isNested = false) {
  const isSelected =
    window.currentModelSyncData?.selectedModels.has(model.index) || false;

  const indentStyle = isNested ? "padding-left: 24px;" : "";
  const fileName = model.displayName || model.name;
  // Try to show size by probing the first valid path quickly (non-blocking)
  if (!model._sizeProbeRequested) {
    model._sizeProbeRequested = true;
    const basePath =
      (model.paths || []).find((p) => p.includes("/models/")) ||
      model.paths?.[0];
    if (basePath) {
      const absolutePath = `${basePath}/${model.name}`;
      fetch(`/comfyui-deploy/fs/stat?path=${encodeURIComponent(absolutePath)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j && j.size) {
            const sizeEl = document.querySelector(`#size-list-${model.index}`);
            if (sizeEl) sizeEl.textContent = ` — ${bytesToSize(j.size)}`;
          }
        })
        .catch(() => {});
    }
  }

  return `
    <div style="
      display: flex;
      align-items: center;
      padding: 8px 12px;
      border-bottom: 1px solid #333;
      ${indentStyle}
      background: ${isNested ? "#2a2a2a" : "#252525"};
    ">
      <input 
        type="checkbox" 
        id="model-${model.index}" 
        ${isSelected ? "checked" : ""}
        onchange="toggleModelSelection(${model.index})"
        style="margin-right: 10px; cursor: pointer; width: 14px; height: 14px;"
      />
      <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
        <span style="font-size: 12px;">📄</span>
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 12px; color: #fff;">
            ${fileName}<span id="size-list-${
    model.index
  }" style="font-size: 10px; color: #aaa;"></span>
          </div>
          ${
            model.size && model.size !== "Unknown"
              ? `
            <div style="font-size: 10px; color: #888; margin-top: 2px;">
              ${model.size}
            </div>
          `
              : ""
          }
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

// Toggle folder visibility
window.toggleFolder = function (filesId, folderElement) {
  const filesContainer = document.getElementById(filesId);
  const folderIcon = folderElement.querySelector(".folder-icon");

  if (filesContainer.style.display === "none") {
    filesContainer.style.display = "block";
    folderIcon.textContent = "▼";
  } else {
    filesContainer.style.display = "none";
    folderIcon.textContent = "▶";
  }
};

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
  if (window.__modelSyncUploading) return; // prevent re-entry during upload

  const selectedModels = Array.from(
    window.currentModelSyncData.selectedModels
  ).map((index) => window.currentModelSyncData.models[index]);

  // Support all model types (files only). We'll map the target folder by type.
  const modelsToUpload = selectedModels;

  // Switch dialog to progress view
  showProgressView(modelsToUpload);

  // Hide Sync button during upload and set beforeunload warning
  const syncBtnEl = document.getElementById("sync-models-btn");
  if (syncBtnEl) syncBtnEl.style.display = "none";
  const closeBtnEl = document.getElementById("close-models-btn");
  if (closeBtnEl) {
    closeBtnEl.disabled = false;
    closeBtnEl.textContent = "Cancel";
    closeBtnEl.onclick = () => cancelActiveUpload();
  }

  window.__modelSyncUploading = true;
  window.__modelSyncUploadingModels = modelsToUpload;
  window.__modelSyncCancelRequested = false;
  window.__modelSyncCurrent = null;
  const beforeUnloadHandler = (e) => {
    e.preventDefault();
    e.returnValue = "";
    return "";
  };
  window.addEventListener("beforeunload", beforeUnloadHandler);

  // Start sequential upload
  const data =
    (typeof window.comfyDeployGetModelData === "function"
      ? window.comfyDeployGetModelData()
      : {}) || {};
  const apiUrl = data.apiUrl || "https://api.comfydeploy.com";
  const authHeader = { Authorization: `Bearer ${data.apiKey}` };

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < modelsToUpload.length; i++) {
    if (window.__modelSyncCancelRequested) break;
    const model = modelsToUpload[i];
    try {
      setProgress(i, 0, "Preparing...");

      // Resolve absolute path: choose a base path that contains /models/
      const basePath =
        (model.paths || []).find((p) => p.includes("/models/")) ||
        model.paths?.[0];
      if (!basePath) throw new Error("No valid base path found for model");
      const absolutePath = `${basePath}/${model.name}`;

      // Stat file size
      const statResp = await fetch(
        `/comfyui-deploy/fs/stat?path=${encodeURIComponent(absolutePath)}`
      );
      if (!statResp.ok) throw new Error(`stat failed: ${statResp.status}`);
      const { size } = await statResp.json();
      if (!size || size <= 0) throw new Error("Invalid file size");
      setSize(i, size);

      // Multipart init
      const filenameOnly = model.name.includes("/")
        ? model.name.split("/").pop()
        : model.name;
      const initResp = await fetch(
        `/comfyui-deploy/volume/file/initiate-multipart-upload`,
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: filenameOnly,
            contentType: "application/octet-stream",
            size,
            api_url: apiUrl,
          }),
        }
      );
      const initData = await initResp.json();
      if (!initResp.ok)
        throw new Error(initData?.detail || JSON.stringify(initData));

      const uploadId = initData.uploadId;
      const key = initData.key;
      window.__modelSyncCurrent = { index: i, uploadId, key };
      const partSize = initData.partSize || 50 * 1024 * 1024;
      const totalParts = Math.ceil(size / partSize);
      const parts = [];

      let uploaded = 0;

      for (let partNumber = 1; partNumber <= totalParts; partNumber++) {
        if (window.__modelSyncCancelRequested) break;
        const start = (partNumber - 1) * partSize;
        const end = Math.min(start + partSize, size);

        // Get part upload URL via proxy
        const urlResp = await fetch(
          `/comfyui-deploy/volume/file/generate-part-upload-url`,
          {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              uploadId,
              key,
              partNumber,
              api_url: apiUrl,
            }),
          }
        );
        const urlData = await urlResp.json();
        if (!urlResp.ok)
          throw new Error(urlData?.detail || JSON.stringify(urlData));

        // Upload this part from machine
        const upResp = await fetch(
          `/comfyui-deploy/volume/file/upload-part-from-path`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              filePath: absolutePath,
              uploadUrl: urlData.uploadUrl,
              start,
              end,
            }),
          }
        );
        const upData = await upResp.json();
        if (!upResp.ok)
          throw new Error(upData?.error || JSON.stringify(upData));

        parts.push({ partNumber, eTag: upData.eTag });
        uploaded = end;
        const pct = Math.round((uploaded / size) * 100);
        setProgress(i, pct, `${bytesToSize(uploaded)} / ${bytesToSize(size)}`);
      }

      if (window.__modelSyncCancelRequested) {
        try {
          await fetch(`/comfyui-deploy/volume/file/abort-multipart-upload`, {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({ uploadId, key, api_url: apiUrl }),
          });
        } catch (_) {}
        setStatus(i, "Cancelled", true);
        break;
      }

      // Complete multipart
      const compResp = await fetch(
        `/comfyui-deploy/volume/file/complete-multipart-upload`,
        {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId, key, parts, api_url: apiUrl }),
        }
      );
      const compData = await compResp.json();
      if (!compResp.ok)
        throw new Error(compData?.detail || JSON.stringify(compData));

      // Register model in backend (source=link from temp upload)
      const rel = model.name;
      const slash = rel.lastIndexOf("/");
      const fileName = slash >= 0 ? rel.slice(slash + 1) : rel;
      const subDir = slash >= 0 ? rel.slice(0, slash) : "";
      const folderRoot = model.type;
      const folderPath = `/${folderRoot}${subDir ? `/${subDir}` : ""}`;

      const addResp = await fetch(`/comfyui-deploy/volume/model`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "link",
          folderPath,
          filename: fileName,
          downloadLink: `s3://${key}`,
          isTemporaryUpload: true,
          s3ObjectKey: key,
          api_url: apiUrl,
        }),
      });
      const addData = await addResp.json();
      if (!addResp.ok)
        throw new Error(addData?.detail || JSON.stringify(addData));

      setProgress(i, 100, "Uploaded");
      setStatus(i, "Success", false);
      successCount++;
    } catch (err) {
      console.error("Upload failed for", model, err);
      setStatus(i, (err && err.message) || "Failed", true);
      failCount++;
      // Try best-effort abort if we had an initialized upload; ignored if not available
      // (No state kept here to simplify; continuing with next file.)
    }
  }

  // Show summary toast
  if (window.app?.extensionManager?.toast) {
    window.app.extensionManager.toast.add({
      severity: window.__modelSyncCancelRequested
        ? "warn"
        : failCount > 0
        ? "warn"
        : "success",
      summary: window.__modelSyncCancelRequested
        ? "Model sync cancelled"
        : "Model sync completed",
      detail: window.__modelSyncCancelRequested
        ? `Cancelled. ${successCount} completed, ${failCount} failed`
        : `${successCount} succeeded, ${failCount} failed`,
      life: 4000,
    });
  }

  // Cleanup UI state
  window.removeEventListener("beforeunload", beforeUnloadHandler);
  window.__modelSyncUploading = false;
  window.__modelSyncUploadingModels = null;
  window.__modelSyncCancelRequested = false;
  window.__modelSyncCurrent = null;
  // Replace Sync with Done button
  if (syncBtnEl) {
    syncBtnEl.textContent = "Done";
    syncBtnEl.onclick = () => closeModelSyncDialog();
    syncBtnEl.style.display = "";
    syncBtnEl.style.cursor = "pointer";
    syncBtnEl.disabled = false;
  }
  if (closeBtnEl) {
    closeBtnEl.disabled = false;
    closeBtnEl.textContent = "Close";
    closeBtnEl.onclick = () => closeModelSyncDialog();
  }
};

// Export the main function
export { initializeModelManager };

// -------------------- Progress UI helpers --------------------
function bytesToSize(bytes) {
  if (!bytes && bytes !== 0) return "-";
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
}

// Cancel current upload gracefully
async function cancelActiveUpload() {
  if (!window.__modelSyncUploading) return;
  window.__modelSyncCancelRequested = true;
  // Visual feedback on Cancel button
  const closeBtnEl = document.getElementById("close-models-btn");
  if (closeBtnEl) {
    closeBtnEl.disabled = true;
    closeBtnEl.textContent = "Cancelling...";
    closeBtnEl.style.opacity = "0.7";
    closeBtnEl.style.cursor = "not-allowed";
  }
  // Mark current item as cancelling, if known
  const curr = window.__modelSyncCurrent;
  if (curr && typeof curr.index === "number") {
    const status = document.getElementById(`status-${curr.index}`);
    if (status) {
      status.textContent = "Cancelling...";
      status.style.color = "#e67e22";
    }
  }
}

function showProgressView(models) {
  const content = document.getElementById("model-sync-content");
  if (!content) return;
  let html = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
      <div style=\"font-size: 13px; color: #ccc;\">Uploading ${models.length} item(s) sequentially</div>
    </div>
    <div style=\"font-size: 11px; color: #ff0000; margin: -6px 0 10px 0;\">Do not close this window or tab while uploads are in progress.</div>
    <div id="upload-list" style="display: flex; flex-direction: column; gap: 10px;"></div>
  `;
  content.innerHTML = html;

  const list = content.querySelector("#upload-list");
  models.forEach((m, idx) => {
    const displayName = m.name;
    const row = document.createElement("div");
    row.id = `upload-row-${idx}`;
    row.style.cssText =
      "border: 1px solid #333; border-radius: 6px; background: #252525; padding: 10px;";
    row.innerHTML = `
      <div style="display:flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <div style="font-size: 12px; color: #fff;">${displayName}<span id="size-${idx}" style="font-size: 10px; color: #aaa; margin-left: 8px;"></span></div>
        <div id="status-${idx}" style="font-size: 11px; color: #888;">Waiting</div>
      </div>
      <div style="height: 8px; background: #1a1a1a; border-radius: 999px; overflow: hidden;">
        <div id="bar-${idx}" style="height:100%; width:0%; background: linear-gradient(90deg, #3498db, #2ecc71);"></div>
      </div>
      <div id="detail-${idx}" style="font-size: 10px; color: #888; margin-top: 6px;">0%</div>
    `;
    list.appendChild(row);
  });
}

function setProgress(idx, pct, detailText) {
  const bar = document.getElementById(`bar-${idx}`);
  const detail = document.getElementById(`detail-${idx}`);
  const status = document.getElementById(`status-${idx}`);
  if (bar) bar.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (detail) detail.textContent = `${pct}% • ${detailText || ""}`;
  if (status) status.textContent = pct >= 100 ? "Uploaded" : "Uploading";
}

function setStatus(idx, text, isError) {
  const status = document.getElementById(`status-${idx}`);
  if (status) {
    status.textContent = text;
    status.style.color = isError ? "#e74c3c" : "#27ae60";
  }
}

function setSize(idx, size) {
  const el = document.getElementById(`size-${idx}`);
  if (el) {
    el.textContent = `— ${bytesToSize(size)}`;
  }
}
