// Machine Manager Script
// Handles local storage machine ID functionality

import { fetchSnapshot } from "./snapshot-utils.js";

const MACHINE_STORAGE_KEY = "comfy_deploy_machine_id";

// Blacklisted URLs that should never appear in machine creation or sync
const BLACKLISTED_URLS = [
  "https://github.com/Comfy-Org/ComfyUI-Manager",
  "https://github.com/ltdrdata/ComfyUI-Manager",
  // Add more URLs to blacklist here
];

// Helper function to check if a step should be blacklisted
function isBlacklisted(step) {
  if (step.type === "custom-node" && step.data?.url) {
    const normalizedStepUrl = normalizeRepoUrl(step.data.url);
    return BLACKLISTED_URLS.some(
      (blacklistedUrl) => normalizeRepoUrl(blacklistedUrl) === normalizedStepUrl
    );
  }
  return false;
}

// Helper function to filter out blacklisted steps
function filterBlacklistedSteps(steps) {
  if (!steps || !Array.isArray(steps)) return steps;
  return steps.filter((step) => !isBlacklisted(step));
}

// Initialize machine manager
async function initializeMachineManager(element, getData) {
  const machineContainer = element.querySelector("#machine-container");
  const machineLoading = element.querySelector("#machine-loading");
  const machineList = element.querySelector("#machine-list");

  // Store getData function globally for sync functionality
  window.comfyDeployGetData = getData;

  const data = getData();

  if (!machineContainer || !machineLoading || !machineList || !data.apiKey) {
    return;
  }

  try {
    // Check if machine ID exists in localStorage
    const storedMachineId = localStorage.getItem(MACHINE_STORAGE_KEY);

    if (!storedMachineId) {
      showNoMachineMessage(machineLoading, machineList);
      return;
    }

    // Show loading state
    machineLoading.style.display = "flex";
    machineList.style.display = "none";

    // Get machine details from API
    const machineData = await fetchMachineDetails(storedMachineId, getData);

    if (machineData && !machineData.error) {
      displayMachine(machineData, machineLoading, machineList, data.endpoint);
    } else {
      showMachineError(
        machineLoading,
        machineList,
        "Failed to load machine details"
      );
    }
  } catch (error) {
    showMachineError(machineLoading, machineList, "Error loading machine");
  }
}

// Show message when no machine is found
function showNoMachineMessage(machineLoading, machineList) {
  machineLoading.style.display = "none";
  machineList.style.display = "block";
  machineList.innerHTML = `
    <li style="text-align: center; padding: 16px; color: #666; font-size: 13px;">
      <div style="margin-bottom: 8px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
          <line x1="6" x2="6.01" y1="6" y2="6"/>
          <line x1="6" x2="6.01" y1="18" y2="18"/>
        </svg>
      </div>
      <div style="font-weight: 500; margin-bottom: 12px; font-size: 12px;">No machine found</div>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button 
          onclick="showAddMachineDialog()"
          style="
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
          "
          title="Add existing machine"
        >
          Add Machine
        </button>
        <button 
          onclick="showCreateMachineDialog()"
          style="
            background: #3498db;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
          "
          title="Create new machine from local setup"
        >
          Sync Local Machine
        </button>
      </div>
    </li>
  `;
}

// Show error message
function showMachineError(machineLoading, machineList, errorMessage) {
  machineLoading.style.display = "none";
  machineList.style.display = "block";
  machineList.innerHTML = `
    <li style="text-align: center; padding: 16px; color: #e74c3c; font-size: 13px;">
      <div style="margin-bottom: 8px;">⚠️</div>
      <div style="margin-bottom: 12px;">${errorMessage}</div>
      <div style="display: flex; gap: 8px; justify-content: center;">
        <button 
          onclick="showAddMachineDialog(true)"
          style="
            background: #f39c12;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
          "
          title="Update machine ID"
        >
          Update Machine ID
        </button>
        <button 
          onclick="removeMachine()"
          style="
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-size: 12px;
            cursor: pointer;
            font-weight: 500;
          "
          title="Remove machine"
        >
          Remove Machine
        </button>
      </div>
    </li>
  `;
}

// Display machine information
function displayMachine(machineData, machineLoading, machineList, endpoint) {
  machineLoading.style.display = "none";
  machineList.style.display = "block";

  const machine = machineData.data || machineData;
  const machineName = machine.name || "Unnamed Machine";
  const machineGpu = machine.gpu || "Unknown GPU";
  const machineStatus = machine.status || "ready";
  const machineId = machine.id;

  // Determine status color and display for specific statuses
  const getStatusStyle = (status) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "ready") {
      return { color: "#27ae60", text: "Ready" };
    } else if (statusLower === "building") {
      return { color: "#f39c12", text: "Building" };
    } else if (statusLower === "error") {
      return { color: "#e74c3c", text: "Error" };
    } else {
      return { color: "#95a5a6", text: "Unknown" };
    }
  };

  const statusStyle = getStatusStyle(machineStatus);

  machineList.innerHTML = `
    <li style="
      border: 1px solid #404040; 
      border-radius: 8px; 
      padding: 16px; 
      background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
      position: relative;
      color: #ffffff;
    ">
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 8px;">
            <a href="${endpoint}/machines/${machineId}" target="_blank" style="color: #ffffff; text-decoration: none;" onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">
              ${machineName}
            </a>
          </div>
          <div style="display: flex; align-items: center; margin-bottom: 4px;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 6px;">
              <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
              <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
              <line x1="6" x2="6.01" y1="6" y2="6"/>
              <line x1="6" x2="6.01" y1="18" y2="18"/>
            </svg>
            <span style="font-size: 12px; color: #cccccc;">${machineGpu}</span>
          </div>
          <div style="display: flex; align-items: center;">
            <div style="
              width: 8px; 
              height: 8px; 
              border-radius: 50%; 
              background: ${statusStyle.color}; 
              margin-right: 6px;
            "></div>
            <span style="font-size: 12px; color: ${statusStyle.color}; font-weight: 500;">
              ${statusStyle.text}
            </span>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button 
            onclick="syncMachine('${machineId}')"
            style="
              background: #f39c12;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 6px 8px;
              font-size: 11px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 4px;
            "
            title="Sync machine status"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 16h5v5"/>
            </svg>
            Sync
          </button>
          <button 
            onclick="removeMachine('${machineId}')"
            style="
              background: #e74c3c;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 6px 8px;
              font-size: 11px;
              cursor: pointer;
              display: flex;
              align-items: center;
              gap: 4px;
            "
            title="Remove machine from local storage"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3,6 5,6 21,6"></polyline>
              <path d="M19,6l-2,14c0,1.1-0.9,2-2,2H9c-1.1,0-2-0.9-2-2L5,6"></path>
              <path d="M10,11v6"></path>
              <path d="M14,11v6"></path>
            </svg>
            Delete
          </button>
        </div>
      </div>
    </li>
  `;
}

// Fetch machine details from API
async function fetchMachineDetails(machineId, getData) {
  try {
    const data = getData();
    if (!data.apiKey) {
      throw new Error("No API key available");
    }

    const params = new URLSearchParams({
      machine_id: machineId,
      api_url: data.apiUrl || "https://api.comfydeploy.com",
    });

    const response = await fetch(`/comfyui-deploy/machine?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching machine details:", error);
    return { error: error.message };
  }
}

// Remove machine from localStorage
window.removeMachine = function () {
  if (confirm("Are you sure you want to unlink this machine?")) {
    localStorage.removeItem(MACHINE_STORAGE_KEY);

    // Show success message temporarily
    const machineList = document.querySelector("#machine-list");
    if (machineList) {
      machineList.innerHTML = `
        <li style="text-align: center; padding: 20px; color: #27ae60; font-size: 14px;">
          <div style="margin-bottom: 10px;">✓</div>
          <div>Machine removed successfully</div>
        </li>
      `;

      // After 2 seconds, show the no machine message
      setTimeout(() => {
        const machineLoading = document.querySelector("#machine-loading");
        showNoMachineMessage(machineLoading, machineList);
      }, 2000);
    }
  }
};

// Sync machine status
window.syncMachine = async function (machineId) {
  try {
    // Get current machine elements
    const machineList = document.querySelector("#machine-list");
    const machineLoading = document.querySelector("#machine-loading");

    if (!machineList || !machineLoading) {
      console.error("Machine elements not found");
      return;
    }

    // Update the sync button to show loading state
    const syncButton = machineList.querySelector(
      'button[onclick*="syncMachine"]'
    );
    let originalButtonContent = null;
    if (syncButton) {
      originalButtonContent = syncButton.innerHTML;
      syncButton.disabled = true;
      syncButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 16h5v5"/>
        </svg>
        Loading...
      `;
      // Add spinning animation
      const style = document.createElement("style");
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `;
      document.head.appendChild(style);
    }

    // Get getData function from global scope (passed during initialization)
    if (!window.comfyDeployGetData) {
      console.error("getData function not available");
      showMachineError(machineLoading, machineList, "Configuration error");
      return;
    }

    const data = window.comfyDeployGetData();

    // Fetch machine data and snapshot docker steps in parallel
    const [machineData, snapshot] = await Promise.all([
      fetchMachineDetails(machineId, window.comfyDeployGetData),
      fetchSnapshot(window.comfyDeployGetData),
    ]);

    if (!machineData || machineData.error) {
      showMachineError(
        machineLoading,
        machineList,
        "Failed to fetch machine data"
      );
      return;
    }

    // Fetch docker steps from snapshot
    const dockerSteps = await fetch("/comfyui-deploy/snapshot-to-docker", {
      method: "POST",
      body: JSON.stringify({
        api_url: data.apiUrl,
        snapshot: snapshot,
      }),
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
        "Content-Type": "application/json",
      },
    }).then((x) => x.json());

    // Restore the sync button
    if (syncButton && originalButtonContent) {
      syncButton.disabled = false;
      syncButton.innerHTML = originalButtonContent;
    }

    // Get endpoint for the link
    const endpoint = data.endpoint || "https://app.comfydeploy.com";

    // Update display with fresh data
    displayMachine(machineData, machineLoading, machineList, endpoint);

    // Store data globally for version comparison
    window.lastMachineData = machineData;
    window.lastSnapshotData = snapshot;

    // Show the sync dialog with comparison
    showSyncComparisonDialog(
      machineData.docker_command_steps || { steps: [] },
      dockerSteps || { steps: [] },
      machineId
    );
  } catch (error) {
    console.error("Error syncing machine:", error);
    const machineList = document.querySelector("#machine-list");
    const machineLoading = document.querySelector("#machine-loading");

    // Restore the sync button if it was modified
    const syncButton = machineList?.querySelector(
      'button[onclick*="syncMachine"]'
    );
    if (syncButton) {
      syncButton.disabled = false;
      // Try to restore original button content or use default
      syncButton.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
          <path d="M16 16h5v5"/>
        </svg>
        Sync Local Machine
      `;
    }

    if (machineList && machineLoading) {
      // Check if the error is related to snapshot fetch
      if (error.message && error.message.includes("Snapshot fetch failed")) {
        // Show toast notification to install ComfyUI Manager
        if (
          window.app &&
          window.app.extensionManager &&
          window.app.extensionManager.toast
        ) {
          window.app.extensionManager.toast.add({
            severity: "error",
            summary: "ComfyUI Manager Required",
            detail:
              "Please install ComfyUI Manager to sync machine configurations",
            life: 8000,
          });
        }
        showMachineError(
          machineLoading,
          machineList,
          "ComfyUI Manager is required to sync machine configurations"
        );
      } else {
        showMachineError(machineLoading, machineList, "Error syncing machine");
      }
    }
  }
};

// Normalize repository URL for comparison
function normalizeRepoUrl(url) {
  if (!url) return null;
  // Remove protocol, www, .git extension, and trailing slashes
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.git$/, "")
    .replace(/\/$/, "");
}

// Get a unique key for comparison based on the step type
function getComparisonKey(step) {
  if (step.type === "custom-node") {
    // Use normalized URL as key for custom nodes
    const url = step.data?.url;
    return normalizeRepoUrl(url) || step.id;
  } else if (step.type === "custom-node-manager") {
    // Use node_id as key for custom-node-manager
    return step.data?.node_id || step.id;
  }
  return step.id;
}

// Compare docker steps and generate diff
function compareDockerSteps(machineSteps, snapshotSteps) {
  const machineMap = new Map();
  const snapshotMap = new Map();
  const comparisonResults = [];

  // Filter out blacklisted steps before comparison
  const filteredMachineSteps = filterBlacklistedSteps(machineSteps.steps || []);
  const filteredSnapshotSteps = filterBlacklistedSteps(
    snapshotSteps.steps || []
  );

  // Build maps using comparison keys
  filteredMachineSteps.forEach((step) => {
    const key = getComparisonKey(step);
    machineMap.set(key, step);
  });

  filteredSnapshotSteps.forEach((step) => {
    const key = getComparisonKey(step);
    snapshotMap.set(key, step);
  });

  // Process all unique keys
  const allKeys = new Set([...machineMap.keys(), ...snapshotMap.keys()]);

  allKeys.forEach((key) => {
    const machineStep = machineMap.get(key);
    const snapshotStep = snapshotMap.get(key);

    if (machineStep && snapshotStep) {
      // Both exist - check if they match
      let isMatch = false;

      if (
        machineStep.type === "custom-node" &&
        snapshotStep.type === "custom-node"
      ) {
        isMatch = machineStep.data?.hash === snapshotStep.data?.hash;
      } else if (
        machineStep.type === "custom-node-manager" &&
        snapshotStep.type === "custom-node-manager"
      ) {
        isMatch = machineStep.data?.version === snapshotStep.data?.version;
      }

      if (isMatch) {
        // Identical - no action needed
        comparisonResults.push({
          type: "unchanged",
          key: key,
          step: snapshotStep,
          name: snapshotStep.data?.name || snapshotStep.id,
        });
      } else {
        // Version conflict - user needs to choose
        comparisonResults.push({
          type: "conflict",
          key: key,
          machineStep: machineStep,
          snapshotStep: snapshotStep,
          selectedVersion: "snapshot", // Default to snapshot version
          name: snapshotStep.data?.name || machineStep.data?.name || key,
        });
      }
    } else if (snapshotStep && !machineStep) {
      // Only in snapshot - new addition
      comparisonResults.push({
        type: "new",
        key: key,
        step: snapshotStep,
        selected: true, // Default selected for addition
        name: snapshotStep.data?.name || snapshotStep.id,
      });
    } else if (machineStep && !snapshotStep) {
      // Only in machine - might be removed
      comparisonResults.push({
        type: "removed",
        key: key,
        step: machineStep,
        selected: false, // Default not selected for removal
        name: machineStep.data?.name || machineStep.id,
      });
    }
  });

  // Sort results: conflicts first, then new, then removed, then unchanged
  const typeOrder = { conflict: 0, new: 1, removed: 2, unchanged: 3 };
  comparisonResults.sort((a, b) => {
    const orderDiff = typeOrder[a.type] - typeOrder[b.type];
    if (orderDiff !== 0) return orderDiff;
    // Within same type, sort by name
    return (a.name || "").localeCompare(b.name || "");
  });

  return comparisonResults;
}

// Show sync comparison dialog
window.showSyncComparisonDialog = function (
  machineSteps,
  snapshotSteps,
  machineId
) {
  // Compare the steps
  const comparisonResults = compareDockerSteps(machineSteps, snapshotSteps);

  // Get ComfyUI version comparison data from global storage
  const machineData = window.lastMachineData;
  const snapshotData = window.lastSnapshotData;

  let comfyuiComparison = null;
  if (machineData && snapshotData) {
    const machineVersion = machineData.comfyui_version;
    const localVersion = snapshotData.comfyui;

    if (machineVersion && localVersion) {
      const versionsMatch = machineVersion === localVersion;
      comfyuiComparison = {
        machineVersion,
        localVersion,
        versionsMatch,
        selectedVersion: versionsMatch ? "same" : "local", // Default to local version if different
      };
    }
  }

  // Create dialog overlay
  const overlay = document.createElement("div");
  overlay.id = "sync-dialog-overlay";
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

  // Count different types
  const conflicts = comparisonResults.filter((r) => r.type === "conflict");
  const newItems = comparisonResults.filter((r) => r.type === "new");
  const removedItems = comparisonResults.filter((r) => r.type === "removed");
  const unchangedItems = comparisonResults.filter(
    (r) => r.type === "unchanged"
  );

  // Create dialog content
  let dialogContent = `
    <div style="
      padding: 18px 24px;
      border-bottom: 1px solid #404040;
      background: linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Dependencies Sync</h3>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
            ${
              comfyuiComparison
                ? comfyuiComparison.versionsMatch
                  ? "1 ComfyUI (same), "
                  : "1 ComfyUI version, "
                : ""
            }${conflicts.length} conflicts, ${newItems.length} new, ${
    removedItems.length
  } removed, ${unchangedItems.length} unchanged
          </p>
        </div>
        <button onclick="closeSyncDialog()" style="
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
    
    <div style="
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      background: #1a1a1a;
    ">
  `;

  // Helper function to render compact item
  const renderCompactItem = (item, index) => {
    const step = item.step || item.snapshotStep || item.machineStep;
    const name = item.name;

    if (item.type === "conflict") {
      // Version conflict - show radio buttons for selection
      const machineHash = item.machineStep.data?.hash;
      const snapshotHash = item.snapshotStep.data?.hash;
      const machineVersion = item.machineStep.data?.version;
      const snapshotVersion = item.snapshotStep.data?.version;

      return `
        <div style="
          display: flex;
          align-items: center;
          padding: 10px 12px;
          background: #252525;
          border-radius: 6px;
          margin-bottom: 6px;
          border: 1px solid #444;
        ">
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 3px;
            background: #f39c1220;
            color: #f39c12;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
            flex-shrink: 0;
          ">⚠</div>
          
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 500; font-size: 13px; color: #fff; margin-bottom: 6px;">
              ${name}
            </div>
            <div style="display: flex; gap: 12px; font-size: 11px;">
              <label style="
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                background: #1a1a1a;
                border: 1px solid #333;
                transition: all 0.2s;
              " onmouseover="this.style.borderColor='#555'" onmouseout="this.style.borderColor='#333'">
                <input 
                  type="radio" 
                  name="conflict-${item.key}"
                  value="machine"
                  ${item.selectedVersion === "machine" ? "checked" : ""}
                  onchange="updateConflictSelection('${item.key}', 'machine')"
                  style="margin-right: 6px; cursor: pointer;"
                />
                <span style="color: #e74c3c;">Machine:</span>
                <span style="margin-left: 4px; font-family: monospace; color: #999;">
                  ${
                    machineHash
                      ? machineHash.substring(0, 8)
                      : machineVersion || "unknown"
                  }
                </span>
              </label>
              
              <label style="
                display: flex;
                align-items: center;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                background: #1a1a1a;
                border: 1px solid #333;
                transition: all 0.2s;
              " onmouseover="this.style.borderColor='#555'" onmouseout="this.style.borderColor='#333'">
                <input 
                  type="radio" 
                  name="conflict-${item.key}"
                  value="snapshot"
                  ${item.selectedVersion === "snapshot" ? "checked" : ""}
                  onchange="updateConflictSelection('${item.key}', 'snapshot')"
                  style="margin-right: 6px; cursor: pointer;"
                />
                <span style="color: #27ae60;">Local:</span>
                <span style="margin-left: 4px; font-family: monospace; color: #999;">
                  ${
                    snapshotHash
                      ? snapshotHash.substring(0, 8)
                      : snapshotVersion || "unknown"
                  }
                </span>
              </label>
            </div>
          </div>
        </div>
      `;
    } else if (item.type === "new") {
      // New item - show checkbox
      return `
        <div style="
          display: flex;
          align-items: center;
          padding: 10px 12px;
          background: #252525;
          border-radius: 6px;
          margin-bottom: 6px;
          border: 1px solid #333;
        ">
          <input 
            type="checkbox" 
            id="new-${item.key}" 
            ${item.selected ? "checked" : ""}
            onchange="updateItemSelection('${item.key}', 'new', this.checked)"
            style="margin-right: 10px; cursor: pointer; width: 16px; height: 16px;"
          />
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 3px;
            background: #27ae6020;
            color: #27ae60;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
            flex-shrink: 0;
          ">+</div>
          <div style="flex: 1;">
            <div style="font-weight: 500; font-size: 13px; color: #fff;">
              ${name}
            </div>
            ${
              step.type === "custom-node" && step.data?.hash
                ? `<div style="font-size: 11px; color: #666; font-family: monospace;">${step.data.hash.substring(
                    0,
                    8
                  )}</div>`
                : step.type === "custom-node-manager" && step.data?.version
                ? `<div style="font-size: 11px; color: #666;">v${step.data.version}</div>`
                : ""
            }
          </div>
        </div>
      `;
    } else if (item.type === "removed") {
      // Removed item - show checkbox (unchecked by default)
      return `
        <div style="
          display: flex;
          align-items: center;
          padding: 10px 12px;
          background: #252525;
          border-radius: 6px;
          margin-bottom: 6px;
          border: 1px solid #333;
          opacity: ${item.selected ? "1" : "0.6"};
        ">
          <input 
            type="checkbox" 
            id="remove-${item.key}" 
            ${item.selected ? "checked" : ""}
            onchange="updateItemSelection('${
              item.key
            }', 'removed', this.checked)"
            style="margin-right: 10px; cursor: pointer; width: 16px; height: 16px;"
          />
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 3px;
            background: #e74c3c20;
            color: #e74c3c;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 600;
            margin-right: 10px;
            flex-shrink: 0;
          ">−</div>
          <div style="flex: 1;">
            <div style="font-weight: 500; font-size: 13px; color: #fff;">
              ${name}
            </div>
            ${
              step.type === "custom-node" && step.data?.hash
                ? `<div style="font-size: 11px; color: #666; font-family: monospace;">${step.data.hash.substring(
                    0,
                    8
                  )}</div>`
                : step.type === "custom-node-manager" && step.data?.version
                ? `<div style="font-size: 11px; color: #666;">v${step.data.version}</div>`
                : ""
            }
          </div>
        </div>
      `;
    } else {
      // Unchanged - just show as info
      return `
        <div style="
          display: flex;
          align-items: center;
          padding: 8px 12px;
          background: #1f1f1f;
          border-radius: 6px;
          margin-bottom: 4px;
          border: 1px solid #2a2a2a;
          opacity: 0.5;
        ">
          <div style="
            width: 20px;
            height: 20px;
            border-radius: 3px;
            color: #555;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            margin-right: 10px;
            flex-shrink: 0;
          ">✓</div>
          <div style="flex: 1;">
            <div style="font-size: 12px; color: #888;">
              ${name}
            </div>
          </div>
        </div>
      `;
    }
  };

  // Store comfyui comparison globally
  window.currentComfyUIComparison = comfyuiComparison;

  // Render ComfyUI version section - always show if we have version data
  if (comfyuiComparison) {
    if (comfyuiComparison.versionsMatch) {
      // Versions match - show green success state
      dialogContent += `
        <div style="margin-bottom: 16px;">
          <h4 style="
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 600;
            color: #27ae60;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">ComfyUI Version</h4>
          <div style="
            display: flex;
            align-items: center;
            padding: 10px 12px;
            background: #1f2f1f;
            border-radius: 6px;
            border: 1px solid #27ae60;
            opacity: 0.8;
          ">
            <div style="
              width: 20px;
              height: 20px;
              border-radius: 3px;
              background: #27ae60;
              color: white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              margin-right: 10px;
              flex-shrink: 0;
            ">✓</div>
            
            <div style="flex: 1;">
              <div style="font-weight: 500; font-size: 13px; color: #27ae60; margin-bottom: 2px;">
                ComfyUI Core - Versions Match
              </div>
              <div style="font-size: 11px; color: #666; font-family: monospace;">
                ${comfyuiComparison.machineVersion}
              </div>
            </div>
          </div>
        </div>
      `;
    } else {
      // Versions differ - show conflict state
      dialogContent += `
        <div style="margin-bottom: 20px;">
          <h4 style="
            margin: 0 0 8px 0;
            font-size: 13px;
            font-weight: 600;
            color: #9b59b6;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">ComfyUI Version</h4>
          <div style="font-size: 11px; color: #666; margin-bottom: 8px;">Choose which ComfyUI version to use:</div>
          <div style="
            display: flex;
            align-items: center;
            padding: 10px 12px;
            background: #252525;
            border-radius: 6px;
            border: 1px solid #444;
          ">
            <div style="
              width: 20px;
              height: 20px;
              border-radius: 3px;
              background: #9b59b620;
              color: #9b59b6;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: 600;
              margin-right: 10px;
              flex-shrink: 0;
            ">🔧</div>
            
            <div style="flex: 1; min-width: 0;">
              <div style="font-weight: 500; font-size: 13px; color: #fff; margin-bottom: 6px;">
                ComfyUI Core
              </div>
              <div style="display: flex; gap: 12px; font-size: 11px;">
                <label style="
                  display: flex;
                  align-items: center;
                  cursor: pointer;
                  padding: 4px 8px;
                  border-radius: 4px;
                  background: #1a1a1a;
                  border: 1px solid #333;
                  transition: all 0.2s;
                " onmouseover="this.style.borderColor='#555'" onmouseout="this.style.borderColor='#333'">
                  <input 
                    type="radio" 
                    name="comfyui-version"
                    value="machine"
                    ${
                      comfyuiComparison.selectedVersion === "machine"
                        ? "checked"
                        : ""
                    }
                    onchange="updateComfyUIVersionSelection('machine')"
                    style="margin-right: 6px; cursor: pointer;"
                  />
                  <span style="color: #e74c3c;">Machine:</span>
                  <span style="margin-left: 4px; font-family: monospace; color: #999;">
                    ${comfyuiComparison.machineVersion}
                  </span>
                </label>
                
                <label style="
                  display: flex;
                  align-items: center;
                  cursor: pointer;
                  padding: 4px 8px;
                  border-radius: 4px;
                  background: #1a1a1a;
                  border: 1px solid #333;
                  transition: all 0.2s;
                " onmouseover="this.style.borderColor='#555'" onmouseout="this.style.borderColor='#333'">
                  <input 
                    type="radio" 
                    name="comfyui-version"
                    value="local"
                    ${
                      comfyuiComparison.selectedVersion === "local"
                        ? "checked"
                        : ""
                    }
                    onchange="updateComfyUIVersionSelection('local')"
                    style="margin-right: 6px; cursor: pointer;"
                  />
                  <span style="color: #27ae60;">Local:</span>
                  <span style="margin-left: 4px; font-family: monospace; color: #999;">
                    ${comfyuiComparison.localVersion}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Render sections
  if (conflicts.length > 0) {
    dialogContent += `
      <div style="margin-bottom: 16px;">
        <h4 style="
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #f39c12;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">Version Conflicts (${conflicts.length})</h4>
        <div style="font-size: 11px; color: #666; margin-bottom: 8px;">Choose which version to use:</div>
        ${conflicts.map((item, i) => renderCompactItem(item, i)).join("")}
      </div>
    `;
  }

  if (newItems.length > 0) {
    dialogContent += `
      <div style="margin-bottom: 16px;">
        <h4 style="
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #27ae60;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">New Dependencies (${newItems.length})</h4>
        ${newItems.map((item, i) => renderCompactItem(item, i)).join("")}
      </div>
    `;
  }

  if (removedItems.length > 0) {
    dialogContent += `
      <div style="margin-bottom: 16px;">
        <h4 style="
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: #e74c3c;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        ">Not in Local Snapshot (${removedItems.length})</h4>
        <div style="font-size: 11px; color: #666; margin-bottom: 8px;">Select to remove from machine:</div>
        ${removedItems.map((item, i) => renderCompactItem(item, i)).join("")}
      </div>
    `;
  }

  if (unchangedItems.length > 0) {
    dialogContent += `
      <details style="margin-bottom: 16px;">
        <summary style="
          cursor: pointer;
          font-size: 13px;
          font-weight: 600;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        ">Unchanged (${unchangedItems.length})</summary>
        ${unchangedItems.map((item, i) => renderCompactItem(item, i)).join("")}
      </details>
    `;
  }

  const hasChanges =
    conflicts.length > 0 || newItems.length > 0 || removedItems.length > 0;

  if (!hasChanges) {
    dialogContent += `
      <div style="
        text-align: center;
        padding: 40px;
        color: #666;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
        <div style="font-size: 16px; font-weight: 500;">Everything is up to date!</div>
        <div style="font-size: 13px; margin-top: 8px;">Your machine dependencies match the current snapshot.</div>
      </div>
    `;
  }

  dialogContent += `
    </div>
    
    <div style="
      padding: 16px 20px;
      border-top: 1px solid #404040;
      background: linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%);
      display: flex;
      justify-content: space-between;
      align-items: center;
    ">
      <div id="sync-selected-count" style="font-size: 12px; color: #999;">
        ${
          hasChanges
            ? `${getSelectedCount(comparisonResults)} changes selected`
            : ""
        }
      </div>
      <div style="display: flex; gap: 12px;">
        <button onclick="closeSyncDialog()" style="
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
        ${
          hasChanges
            ? `
          <button onclick="applySyncChanges('${machineId}')" style="
            background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
            color: white;
            border: none;
            border-radius: 6px;
            padding: 8px 20px;
            font-size: 13px;
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
            box-shadow: 0 2px 8px rgba(39, 174, 96, 0.3);
          " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
            Apply Changes
          </button>
        `
            : ""
        }
      </div>
    </div>
  `;

  dialog.innerHTML = dialogContent;
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Store comparison results globally for access by apply function
  window.currentComparisonResults = comparisonResults;

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeSyncDialog();
    }
  });
};

// Helper function to get selected count
function getSelectedCount(comparisonResults) {
  let count = 0;

  // Count ComfyUI version if there's a difference (not if they match)
  if (
    window.currentComfyUIComparison &&
    !window.currentComfyUIComparison.versionsMatch
  ) {
    count++;
  }

  comparisonResults.forEach((item) => {
    if (item.type === "conflict") {
      count++; // Conflicts always need resolution
    } else if (item.type === "new" && item.selected) {
      count++;
    } else if (item.type === "removed" && item.selected) {
      count++;
    }
  });
  return count;
}

// Update selected count in dialog
function updateSelectedCountDisplay() {
  if (!window.currentComparisonResults) return;

  const selectedCount = getSelectedCount(window.currentComparisonResults);
  const countElement = document.querySelector("#sync-selected-count");
  if (countElement) {
    countElement.textContent = `${selectedCount} changes selected`;
  }
}

// Update ComfyUI version selection
window.updateComfyUIVersionSelection = function (version) {
  if (window.currentComfyUIComparison) {
    window.currentComfyUIComparison.selectedVersion = version;
    updateSelectedCountDisplay();
  }
};

// Update conflict selection
window.updateConflictSelection = function (key, version) {
  if (!window.currentComparisonResults) return;

  const item = window.currentComparisonResults.find(
    (r) => r.key === key && r.type === "conflict"
  );
  if (item) {
    item.selectedVersion = version;
    updateSelectedCountDisplay();
  }
};

// Update item selection (for new and removed items)
window.updateItemSelection = function (key, type, selected) {
  if (!window.currentComparisonResults) return;

  const item = window.currentComparisonResults.find(
    (r) => r.key === key && r.type === type
  );
  if (item) {
    item.selected = selected;
    updateSelectedCountDisplay();
  }
};

// Close sync dialog
window.closeSyncDialog = function () {
  const overlay = document.getElementById("sync-dialog-overlay");
  if (overlay) {
    overlay.remove();
  }
  window.currentComparisonResults = null;
  window.currentComfyUIComparison = null;
};

// Apply sync changes
window.applySyncChanges = async function (machineId) {
  if (!window.currentComparisonResults) return;

  // Get the apply button and show loading state
  const applyButton = document.querySelector(
    'button[onclick*="applySyncChanges"]'
  );
  let originalButtonContent = null;

  if (applyButton) {
    originalButtonContent = applyButton.innerHTML;
    applyButton.disabled = true;
    applyButton.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin" style="margin-right: 6px;">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 16h5v5"/>
      </svg>
      Applying...
    `;
    applyButton.style.background = "#555";
    applyButton.style.cursor = "not-allowed";
  }

  try {
    const finalSteps = [];

    window.currentComparisonResults.forEach((item) => {
      let stepToAdd = null;

      if (item.type === "conflict") {
        // Use the selected version for conflicts
        if (item.selectedVersion === "machine") {
          stepToAdd = item.machineStep;
        } else {
          stepToAdd = item.snapshotStep;
        }
      } else if (item.type === "new" && item.selected) {
        // Add selected new items
        stepToAdd = item.step;
      } else if (item.type === "removed" && !item.selected) {
        // Keep items that are NOT selected for removal
        stepToAdd = item.step;
      } else if (item.type === "unchanged") {
        // Always include unchanged items
        stepToAdd = item.step;
      }

      // Only add if not blacklisted
      if (stepToAdd && !isBlacklisted(stepToAdd)) {
        finalSteps.push(stepToAdd);
      }
    });

    // Format as docker steps
    const dockerSteps = {
      steps: finalSteps,
    };

    // Add ComfyUI version if there's a comparison (whether matching or not)
    let selectedComfyUIVersion = null;
    if (window.currentComfyUIComparison) {
      if (window.currentComfyUIComparison.versionsMatch) {
        // If versions match, use the common version
        selectedComfyUIVersion = window.currentComfyUIComparison.machineVersion;
      } else {
        // If versions differ, use the selected one
        if (window.currentComfyUIComparison.selectedVersion === "machine") {
          selectedComfyUIVersion =
            window.currentComfyUIComparison.machineVersion;
        } else {
          selectedComfyUIVersion = window.currentComfyUIComparison.localVersion;
        }
      }
      dockerSteps.comfyui_version = selectedComfyUIVersion;
    }

    // Send these docker steps to the backend to update the machine
    const body = {
      machine_id: machineId,
      docker_steps: dockerSteps,
      api_url: window.comfyDeployGetData().apiUrl,
    };

    if (selectedComfyUIVersion) {
      body.comfyui_version = selectedComfyUIVersion;
    }

    const response = await fetch(`/comfyui-deploy/machine/update`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${window.comfyDeployGetData().apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }).then((response) => response.json());

    // Close the dialog
    closeSyncDialog();

    if (response.id) {
      window.app.extensionManager.toast.add({
        severity: "success",
        summary: "Machine updated successfully",
        detail: "Your machine has been updated successfully",
        life: 3000,
      });
    } else {
      window.app.extensionManager.toast.add({
        severity: "error",
        summary: "Failed to update machine",
        detail: response.error || "Please try again",
        life: 5000,
      });
    }
  } catch (error) {
    console.error("Error updating machine:", error);

    // Restore button if there was an error and dialog is still open
    if (applyButton && originalButtonContent) {
      applyButton.disabled = false;
      applyButton.innerHTML = originalButtonContent;
      applyButton.style.background =
        "linear-gradient(135deg, #27ae60 0%, #229954 100%)";
      applyButton.style.cursor = "pointer";
    }

    window.app.extensionManager.toast.add({
      severity: "error",
      summary: "Network error",
      detail: "Failed to connect to server. Please try again.",
      life: 5000,
    });
  }
};

// Show add machine dialog
window.showAddMachineDialog = function (isUpdate = false) {
  const currentMachineId = localStorage.getItem(MACHINE_STORAGE_KEY);
  // Create dialog overlay
  const overlay = document.createElement("div");
  overlay.id = "machine-dialog-overlay";
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;

  // Create dialog box
  const dialog = document.createElement("div");
  dialog.style.cssText = `
    background: #2c2c2c;
    border-radius: 8px;
    padding: 24px;
    width: 400px;
    max-width: 90vw;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    color: #ffffff;
  `;

  dialog.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${
        isUpdate ? "Update Machine ID" : "Add Machine"
      }</h3>
      <button onclick="closeAddMachineDialog()" style="
        background: none;
        border: none;
        color: #ccc;
        font-size: 18px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      ">×</button>
    </div>
    
    ${
      isUpdate && currentMachineId
        ? `
    <div style="margin-bottom: 12px; padding: 8px 12px; background: #1a1a1a; border-radius: 4px; border-left: 3px solid #f39c12;">
      <div style="font-size: 12px; color: #ccc; margin-bottom: 4px;">Current Machine ID:</div>
      <div style="font-size: 13px; color: #ffffff; font-family: monospace;">${currentMachineId}</div>
    </div>
    `
        : ""
    }
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #ccc;">${
        isUpdate ? "New Machine ID:" : "Machine ID:"
      }</label>
      <input 
        type="text" 
        id="dialog-machine-id-input" 
        placeholder="${
          isUpdate ? "Enter new machine ID" : "Enter your machine ID"
        }" 
        onkeypress="if(event.key === 'Enter') addMachineFromDialog()"
        oninput="validateMachineIdInput()"
        style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #555;
          border-radius: 4px;
          font-size: 13px;
          background: #1a1a1a;
          color: #ffffff;
          box-sizing: border-box;
        "
      />
    </div>
    
    <div style="display: flex; gap: 8px; justify-content: flex-end;">
      <button onclick="closeAddMachineDialog()" style="
        background: #555;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 12px;
        cursor: pointer;
      ">Cancel</button>
      <button onclick="addMachineFromDialog()" style="
        background: ${isUpdate ? "#f39c12" : "#27ae60"};
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
      ">${isUpdate ? "Update Machine" : "Add Machine"}</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus on input
  setTimeout(() => {
    const input = document.getElementById("dialog-machine-id-input");
    if (input) input.focus();
  }, 100);

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeAddMachineDialog();
    }
  });
};

// Close add machine dialog
window.closeAddMachineDialog = function () {
  const overlay = document.getElementById("machine-dialog-overlay");
  if (overlay) {
    overlay.remove();
  }
};

// Validate UUID format
function isValidUUID(str) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

// Show validation error in dialog
function showValidationError(message) {
  let errorDiv = document.getElementById("dialog-validation-error");
  if (!errorDiv) {
    errorDiv = document.createElement("div");
    errorDiv.id = "dialog-validation-error";
    errorDiv.style.cssText = `
      color: #e74c3c;
      font-size: 12px;
      margin-top: 4px;
      padding: 8px 12px;
      background: rgba(231, 76, 60, 0.1);
      border: 1px solid rgba(231, 76, 60, 0.3);
      border-radius: 4px;
    `;

    const input = document.getElementById("dialog-machine-id-input");
    if (input && input.parentElement) {
      input.parentElement.appendChild(errorDiv);
    }
  }
  errorDiv.textContent = message;
  errorDiv.style.display = "block";
}

// Hide validation error
function hideValidationError() {
  const errorDiv = document.getElementById("dialog-validation-error");
  if (errorDiv) {
    errorDiv.style.display = "none";
  }
}

// Real-time validation as user types
window.validateMachineIdInput = function () {
  const input = document.getElementById("dialog-machine-id-input");
  if (!input) return;

  const machineId = input.value.trim();

  // Clear validation if input is empty
  if (!machineId) {
    hideValidationError();
    updateInputBorder(input, "neutral");
    return;
  }

  // Check UUID format
  if (isValidUUID(machineId)) {
    hideValidationError();
    updateInputBorder(input, "valid");
  } else {
    // Only show error if user has typed something substantial
    if (machineId.length > 8) {
      showValidationError("Machine ID must be a valid UUID format");
      updateInputBorder(input, "invalid");
    } else {
      hideValidationError();
      updateInputBorder(input, "neutral");
    }
  }
};

// Update input border color based on validation state
function updateInputBorder(input, state) {
  switch (state) {
    case "valid":
      input.style.borderColor = "#27ae60";
      break;
    case "invalid":
      input.style.borderColor = "#e74c3c";
      break;
    default:
      input.style.borderColor = "#555";
  }
}

// Add machine from dialog
window.addMachineFromDialog = function () {
  const input = document.getElementById("dialog-machine-id-input");
  if (!input) {
    console.error("Machine ID input not found");
    return;
  }

  const machineId = input.value.trim();
  if (!machineId) {
    showValidationError("Please enter a machine ID");
    return;
  }

  // Validate UUID format
  if (!isValidUUID(machineId)) {
    showValidationError("Machine ID must be a valid UUID format");
    return;
  }

  // Hide any validation errors
  hideValidationError();

  // Close dialog
  closeAddMachineDialog();

  // Add the machine and refresh
  addMachine(machineId);
};

// Add machine to localStorage (utility function)
window.addMachine = function (machineId) {
  localStorage.setItem(MACHINE_STORAGE_KEY, machineId);

  // Show loading state immediately
  const machineLoading = document.querySelector("#machine-loading");
  const machineList = document.querySelector("#machine-list");

  if (machineLoading && machineList) {
    machineLoading.style.display = "flex";
    machineList.style.display = "none";
  }

  // Find the correct parent element that contains the machine elements
  let element = document.querySelector(".comfy-menu");

  // If .comfy-menu doesn't work, try to find the parent of machine-container
  if (!element || !element.querySelector("#machine-container")) {
    const machineContainer = document.querySelector("#machine-container");
    if (machineContainer) {
      element = machineContainer.parentElement;
    }
  }

  if (element && window.comfyDeployGetData) {
    // Use setTimeout to ensure DOM updates are processed
    setTimeout(() => {
      initializeMachineManager(element, window.comfyDeployGetData);
    }, 100);
  } else {
    console.error("Could not find elements for machine refresh");
  }
};

// Show create machine dialog
window.showCreateMachineDialog = function () {
  // Create dialog overlay
  const overlay = document.createElement("div");
  overlay.id = "create-machine-dialog-overlay";
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
    width: 600px;
    max-width: 90vw;
    max-height: 85vh;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    color: #ffffff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `;

  dialog.innerHTML = `
    <div style="
      padding: 18px 24px;
      border-bottom: 1px solid #404040;
      background: linear-gradient(135deg, #2c2c2c 0%, #1f1f1f 100%);
    ">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Create New Machine</h3>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #999;">
            Sync your local ComfyUI setup to the cloud
          </p>
        </div>
        <button onclick="closeCreateMachineDialog()" style="
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
    
    <div id="create-machine-content" style="
      flex: 1;
      overflow-y: auto;
      padding: 16px 20px;
      background: #1a1a1a;
    ">
      <div style="text-align: center; padding: 40px; color: #666;">
        <div style="font-size: 24px; margin-bottom: 16px;">⏳</div>
        <div style="font-size: 16px; font-weight: 500;">Loading local setup...</div>
        <div style="font-size: 13px; margin-top: 8px;">Analyzing your ComfyUI installation</div>
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
      <div style="font-size: 12px; color: #999;"></div>
      <div style="display: flex; gap: 12px;">
        <button onclick="closeCreateMachineDialog()" style="
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
        <button id="create-machine-btn" onclick="createMachine()" disabled style="
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
          Create Machine
        </button>
      </div>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) {
      closeCreateMachineDialog();
    }
  });

  // Load machine creation data
  loadCreateMachineData();
};

// Close create machine dialog
window.closeCreateMachineDialog = function () {
  const overlay = document.getElementById("create-machine-dialog-overlay");
  if (overlay) {
    overlay.remove();
  }
  window.currentCreateMachineData = null;
};

// Load data for machine creation
async function loadCreateMachineData() {
  try {
    // Get current snapshot and convert to docker steps
    const snapshot = await fetchSnapshot(window.comfyDeployGetData);
    const dockerStepsResponse = await fetch(
      "/comfyui-deploy/snapshot-to-docker",
      {
        method: "POST",
        body: JSON.stringify({
          api_url: window.comfyDeployGetData().apiUrl,
          snapshot: snapshot,
        }),
        headers: {
          Authorization: `Bearer ${window.comfyDeployGetData().apiKey}`,
          "Content-Type": "application/json",
        },
      }
    ).then((x) => x.json());

    // Store data globally
    window.currentCreateMachineData = {
      snapshot,
      dockerSteps: dockerStepsResponse,
      selectedSteps: new Set(), // Track selected docker steps
    };

    // Render the machine creation form
    renderCreateMachineForm(snapshot, dockerStepsResponse);
  } catch (error) {
    console.error("Error loading machine creation data:", error);

    // Check if the error is related to snapshot fetch
    if (error.message && error.message.includes("Snapshot fetch failed")) {
      // Show toast notification to install ComfyUI Manager
      if (
        window.app &&
        window.app.extensionManager &&
        window.app.extensionManager.toast
      ) {
        window.app.extensionManager.toast.add({
          severity: "error",
          summary: "ComfyUI Manager Required",
          detail:
            "Please install ComfyUI Manager to enable machine creation features",
          life: 8000,
        });
      }
      renderCreateMachineError(
        "ComfyUI Manager is required. Please install ComfyUI Manager to continue."
      );
    } else {
      renderCreateMachineError("Failed to load local setup data");
    }
  }
}

// Render machine creation form
function renderCreateMachineForm(snapshot, dockerSteps) {
  const content = document.getElementById("create-machine-content");
  if (!content) return;

  const comfyuiVersion = snapshot.comfyui || "Unknown";
  // Filter out blacklisted steps before rendering
  const steps = filterBlacklistedSteps(dockerSteps.steps || []);

  // Initialize all steps as selected by default
  if (window.currentCreateMachineData) {
    // Update the dockerSteps with filtered steps
    window.currentCreateMachineData.dockerSteps = {
      ...dockerSteps,
      steps: steps,
    };
    window.currentCreateMachineData.selectedSteps = new Set(
      steps.map((_, index) => index)
    );
  }

  content.innerHTML = `
    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #ccc;">Machine Name:</label>
      <input 
        type="text" 
        id="machine-name-input" 
        placeholder="Local Machine"
        value="Local Machine"
        style="
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #555;
          border-radius: 4px;
          font-size: 13px;
          background: #1a1a1a;
          color: #ffffff;
          box-sizing: border-box;
        "
      />
    </div>

    <div style="margin-bottom: 20px;">
      <h4 style="
        margin: 0 0 8px 0;
        font-size: 13px;
        font-weight: 600;
        color: #3498db;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      ">ComfyUI Version</h4>
      <div style="
        display: flex;
        align-items: center;
        padding: 10px 12px;
        background: #1f2f2f;
        border-radius: 6px;
        border: 1px solid #3498db;
        opacity: 0.8;
      ">
        <div style="
          width: 20px;
          height: 20px;
          border-radius: 3px;
          background: #3498db;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          margin-right: 10px;
          flex-shrink: 0;
        ">🔧</div>
        
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 13px; color: #3498db; margin-bottom: 2px;">
            ComfyUI Core
          </div>
          <div style="font-size: 11px; color: #666; font-family: monospace;">
            ${comfyuiVersion}
          </div>
        </div>
      </div>
    </div>

    ${
      steps.length > 0
        ? `
      <div style="margin-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="
            margin: 0;
            font-size: 13px;
            font-weight: 600;
            color: #27ae60;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">Custom Nodes (${steps.length})</h4>
          <div style="display: flex; gap: 8px;">
            <button onclick="selectAllNodes()" style="
              background: #27ae60;
              color: white;
              border: none;
              border-radius: 4px;
              padding: 4px 8px;
              font-size: 11px;
              cursor: pointer;
              font-weight: 500;
            ">Select All</button>
            <button onclick="deselectAllNodes()" style="
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
        <div style="max-height: 300px; overflow-y: auto; border: 1px solid #333; border-radius: 6px; background: #252525;">
          ${steps.map((step, index) => renderNodeStep(step, index)).join("")}
        </div>
      </div>
    `
        : `
      <div style="
        text-align: center;
        padding: 20px;
        color: #666;
        background: #252525;
        border-radius: 6px;
        border: 1px solid #333;
        margin-bottom: 20px;
      ">
        <div style="font-size: 16px; margin-bottom: 8px;">📦</div>
        <div style="font-size: 13px;">No custom nodes detected</div>
      </div>
    `
    }
  `;

  // Enable the create button
  const createBtn = document.getElementById("create-machine-btn");
  if (createBtn) {
    createBtn.disabled = false;
    createBtn.style.background =
      "linear-gradient(135deg, #3498db 0%, #2980b9 100%)";
    createBtn.style.color = "white";
    createBtn.style.cursor = "pointer";
    createBtn.style.boxShadow = "0 2px 8px rgba(52, 152, 219, 0.3)";
  }
}

// Render individual node step
function renderNodeStep(step, index) {
  const name = step.data?.name || step.id || "Unknown Node";
  const isSelected =
    window.currentCreateMachineData?.selectedSteps.has(index) || false;

  return `
    <div style="
      display: flex;
      align-items: center;
      padding: 10px 12px;
      border-bottom: 1px solid #333;
    ">
      <input 
        type="checkbox" 
        id="node-${index}" 
        ${isSelected ? "checked" : ""}
        onchange="toggleNodeSelection(${index})"
        style="margin-right: 10px; cursor: pointer; width: 16px; height: 16px;"
      />
      <div style="flex: 1;">
        <div style="font-weight: 500; font-size: 13px; color: #fff;">
          ${name}
        </div>
        ${
          step.type === "custom-node" && step.data?.hash
            ? `<div style="font-size: 11px; color: #666; font-family: monospace;">${step.data.hash.substring(
                0,
                8
              )}</div>`
            : step.type === "custom-node-manager" && step.data?.version
            ? `<div style="font-size: 11px; color: #666;">v${step.data.version}</div>`
            : ""
        }
      </div>
    </div>
  `;
}

// Render error state
function renderCreateMachineError(message) {
  const content = document.getElementById("create-machine-content");
  if (!content) return;

  content.innerHTML = `
    <div style="text-align: center; padding: 40px; color: #e74c3c;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Error</div>
      <div style="font-size: 13px;">${message}</div>
    </div>
  `;
}

// Toggle node selection
window.toggleNodeSelection = function (index) {
  if (!window.currentCreateMachineData) return;

  const selectedSteps = window.currentCreateMachineData.selectedSteps;
  if (selectedSteps.has(index)) {
    selectedSteps.delete(index);
  } else {
    selectedSteps.add(index);
  }
};

// Select all nodes
window.selectAllNodes = function () {
  if (!window.currentCreateMachineData) return;

  const steps = window.currentCreateMachineData.dockerSteps.steps || [];
  window.currentCreateMachineData.selectedSteps = new Set(
    steps.map((_, index) => index)
  );

  // Update checkboxes
  steps.forEach((_, index) => {
    const checkbox = document.getElementById(`node-${index}`);
    if (checkbox) checkbox.checked = true;
  });
};

// Deselect all nodes
window.deselectAllNodes = function () {
  if (!window.currentCreateMachineData) return;

  const steps = window.currentCreateMachineData.dockerSteps.steps || [];
  window.currentCreateMachineData.selectedSteps.clear();

  // Update checkboxes
  steps.forEach((_, index) => {
    const checkbox = document.getElementById(`node-${index}`);
    if (checkbox) checkbox.checked = false;
  });
};

// Create machine
window.createMachine = async function () {
  if (!window.currentCreateMachineData) return;

  const nameInput = document.getElementById("machine-name-input");
  const machineName = nameInput?.value.trim() || "Local Machine";

  // Get create button and show loading state
  const createBtn = document.getElementById("create-machine-btn");
  let originalButtonContent = null;

  if (createBtn) {
    originalButtonContent = createBtn.innerHTML;
    createBtn.disabled = true;
    createBtn.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="animate-spin" style="margin-right: 6px;">
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
        <path d="M3 3v5h5"/>
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
        <path d="M16 16h5v5"/>
      </svg>
      Creating...
    `;
    createBtn.style.background = "#555";
    createBtn.style.cursor = "not-allowed";
  }

  try {
    // Get selected docker steps
    const allSteps = window.currentCreateMachineData.dockerSteps.steps || [];
    const selectedSteps = Array.from(
      window.currentCreateMachineData.selectedSteps
    )
      .map((index) => allSteps[index])
      .filter((step) => step);

    const dockerCommandSteps = {
      steps: selectedSteps,
    };

    const data = window.comfyDeployGetData();

    // Create machine via API
    const response = await fetch("/comfyui-deploy/machine/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: machineName,
        docker_command_steps: dockerCommandSteps,
        comfyui_version: window.currentCreateMachineData.snapshot.comfyui,
        api_url: data.apiUrl || "https://api.comfydeploy.com",
      }),
    }).then((response) => response.json());

    // Close dialog
    closeCreateMachineDialog();

    if (response.id) {
      // Save machine ID to localStorage
      localStorage.setItem(MACHINE_STORAGE_KEY, response.id);

      // Show success message
      window.app.extensionManager.toast.add({
        severity: "success",
        summary: "Machine created successfully",
        detail: `Machine "${machineName}" has been created and linked`,
        life: 3000,
      });

      // Refresh machine manager
      const machineLoading = document.querySelector("#machine-loading");
      const machineList = document.querySelector("#machine-list");

      if (machineLoading && machineList) {
        machineLoading.style.display = "flex";
        machineList.style.display = "none";
      }

      // Find the correct parent element and reinitialize
      let element = document.querySelector(".comfy-menu");
      if (!element || !element.querySelector("#machine-container")) {
        const machineContainer = document.querySelector("#machine-container");
        if (machineContainer) {
          element = machineContainer.parentElement;
        }
      }

      if (element && window.comfyDeployGetData) {
        setTimeout(() => {
          initializeMachineManager(element, window.comfyDeployGetData);
        }, 100);
      }
    } else {
      window.app.extensionManager.toast.add({
        severity: "error",
        summary: "Failed to create machine",
        detail: result.error || "Please try again",
        life: 5000,
      });
    }
  } catch (error) {
    console.error("Error creating machine:", error);

    // Restore button if there was an error and dialog is still open
    if (createBtn && originalButtonContent) {
      createBtn.disabled = false;
      createBtn.innerHTML = originalButtonContent;
      createBtn.style.background =
        "linear-gradient(135deg, #3498db 0%, #2980b9 100%)";
      createBtn.style.cursor = "pointer";
    }

    window.app.extensionManager.toast.add({
      severity: "error",
      summary: "Network error",
      detail: "Failed to connect to server. Please try again.",
      life: 5000,
    });
  }
};

// Export the main function
export { initializeMachineManager };
