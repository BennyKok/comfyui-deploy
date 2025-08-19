// Machine Manager Script
// Handles local storage machine ID functionality

const MACHINE_STORAGE_KEY = 'comfy_deploy_machine_id';

// Initialize machine manager
async function initializeMachineManager(element, getData) {
  const machineContainer = element.querySelector("#machine-container");
  const machineLoading = element.querySelector("#machine-loading");
  const machineList = element.querySelector("#machine-list");
  
  // Store getData function globally for sync functionality
  window.comfyDeployGetData = getData;
  
  const data = getData();

  if (!machineContainer || !machineLoading || !machineList) {
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
      showMachineError(machineLoading, machineList, "Failed to load machine details");
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
      <div style="font-weight: 500; margin-bottom: 12px;">No machine found</div>
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
        title="Add machine"
      >
        Add Machine
      </button>
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
  const machineName = machine.name || 'Unnamed Machine';
  const machineGpu = machine.gpu || 'Unknown GPU';
  const machineStatus = machine.status || 'ready';
  const machineId = machine.id;

  // Determine status color and display for specific statuses
  const getStatusStyle = (status) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'ready') {
      return { color: '#27ae60', text: 'Ready' };
    } else if (statusLower === 'building') {
      return { color: '#f39c12', text: 'Building' };
    } else if (statusLower === 'error') {
      return { color: '#e74c3c', text: 'Error' };
    } else {
      return { color: '#95a5a6', text: 'Unknown' };
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
      api_url: data.apiUrl || "https://api.comfydeploy.com"
    });

    const response = await fetch(`/comfyui-deploy/machine?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${data.apiKey}`,
        'Content-Type': 'application/json'
      }
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
window.removeMachine = function(machineId) {
  if (confirm('Are you sure you want to remove this machine from local storage?')) {
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
window.syncMachine = async function(machineId) {
  try {
    // Get current machine elements
    const machineList = document.querySelector("#machine-list");
    const machineLoading = document.querySelector("#machine-loading");
    
    if (!machineList || !machineLoading) {
      console.error("Machine elements not found");
      return;
    }

    // Show loading state
    machineLoading.style.display = "flex";
    machineList.style.display = "none";

    // Get getData function from global scope (passed during initialization)
    if (!window.comfyDeployGetData) {
      console.error("getData function not available");
      showMachineError(machineLoading, machineList, "Configuration error");
      return;
    }

    // Fetch updated machine data
    const machineData = await fetchMachineDetails(machineId, window.comfyDeployGetData);
    
    if (machineData && !machineData.error) {
      // Get endpoint for the link
      const data = window.comfyDeployGetData();
      const endpoint = data.endpoint || 'https://app.comfydeploy.com';
      
      // Update display with fresh data
      displayMachine(machineData, machineLoading, machineList, endpoint);
      
      // Show brief success indicator (optional)
      console.log("Machine synced successfully");
    } else {
      // Show error and revert to previous state
      showMachineError(machineLoading, machineList, "Failed to sync machine data");
    }

  } catch (error) {
    console.error("Error syncing machine:", error);
    const machineList = document.querySelector("#machine-list");
    const machineLoading = document.querySelector("#machine-loading");
    if (machineList && machineLoading) {
      showMachineError(machineLoading, machineList, "Error syncing machine");
    }
  }
};

// Show add machine dialog
window.showAddMachineDialog = function(isUpdate = false) {
  const currentMachineId = localStorage.getItem(MACHINE_STORAGE_KEY);
  // Create dialog overlay
  const overlay = document.createElement('div');
  overlay.id = 'machine-dialog-overlay';
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
  const dialog = document.createElement('div');
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
      <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${isUpdate ? 'Update Machine ID' : 'Add Machine'}</h3>
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
    
    ${isUpdate && currentMachineId ? `
    <div style="margin-bottom: 12px; padding: 8px 12px; background: #1a1a1a; border-radius: 4px; border-left: 3px solid #f39c12;">
      <div style="font-size: 12px; color: #ccc; margin-bottom: 4px;">Current Machine ID:</div>
      <div style="font-size: 13px; color: #ffffff; font-family: monospace;">${currentMachineId}</div>
    </div>
    ` : ''}
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-size: 13px; color: #ccc;">${isUpdate ? 'New Machine ID:' : 'Machine ID:'}</label>
      <input 
        type="text" 
        id="dialog-machine-id-input" 
        placeholder="${isUpdate ? 'Enter new machine ID' : 'Enter your machine ID'}" 
        onkeypress="if(event.key === 'Enter') addMachineFromDialog()"
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
        background: ${isUpdate ? '#f39c12' : '#27ae60'};
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-size: 12px;
        cursor: pointer;
        font-weight: 500;
      ">${isUpdate ? 'Update Machine' : 'Add Machine'}</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Focus on input
  setTimeout(() => {
    const input = document.getElementById('dialog-machine-id-input');
    if (input) input.focus();
  }, 100);

  // Close on overlay click
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) {
      closeAddMachineDialog();
    }
  });
};

// Close add machine dialog
window.closeAddMachineDialog = function() {
  const overlay = document.getElementById('machine-dialog-overlay');
  if (overlay) {
    overlay.remove();
  }
};

// Add machine from dialog
window.addMachineFromDialog = function() {
  const input = document.getElementById('dialog-machine-id-input');
  if (!input) {
    console.error("Machine ID input not found");
    return;
  }
  
  const machineId = input.value.trim();
  if (!machineId) {
    alert('Please enter a machine ID');
    return;
  }
  
  // Close dialog
  closeAddMachineDialog();
  
  // Add the machine and refresh
  addMachine(machineId);
};

// Add machine to localStorage (utility function)
window.addMachine = function(machineId) {
  localStorage.setItem(MACHINE_STORAGE_KEY, machineId);
  
  // Show loading state immediately
  const machineLoading = document.querySelector("#machine-loading");
  const machineList = document.querySelector("#machine-list");
  
  if (machineLoading && machineList) {
    machineLoading.style.display = "flex";
    machineList.style.display = "none";
  }
  
  // Find the correct parent element that contains the machine elements
  let element = document.querySelector('.comfy-menu');
  
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

// Export the main function
export { initializeMachineManager };
