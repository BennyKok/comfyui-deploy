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
    console.error("Machine container elements not found");
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
    console.error("Error initializing machine manager:", error);
    showMachineError(machineLoading, machineList, "Error loading machine");
  }
}

// Show message when no machine is found
function showNoMachineMessage(machineLoading, machineList) {
  machineLoading.style.display = "none";
  machineList.style.display = "block";
  machineList.innerHTML = `
    <li style="text-align: center; padding: 12px; color: #666; font-size: 13px;">
      <div style="margin-bottom: 6px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="20" height="8" x="2" y="2" rx="2" ry="2"/>
          <rect width="20" height="8" x="2" y="14" rx="2" ry="2"/>
          <line x1="6" x2="6.01" y1="6" y2="6"/>
          <line x1="6" x2="6.01" y1="18" y2="18"/>
        </svg>
      </div>
      <div style="font-weight: 500;">No machine found</div>
    </li>
  `;
}

// Show error message
function showMachineError(machineLoading, machineList, errorMessage) {
  machineLoading.style.display = "none";
  machineList.style.display = "block";
  machineList.innerHTML = `
    <li style="text-align: center; padding: 12px; color: #e74c3c; font-size: 13px;">
      <div style="margin-bottom: 4px;">⚠️</div>
      <div>${errorMessage}</div>
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

// Add machine to localStorage (utility function)
window.addMachine = function(machineId) {
  localStorage.setItem(MACHINE_STORAGE_KEY, machineId);
  
  // Reinitialize the machine manager to show the new machine
  const element = document.querySelector('.comfy-menu');
  if (element && window.comfyDeployGetData) {
    initializeMachineManager(element, window.comfyDeployGetData);
  }
};

// Export the main function
export { initializeMachineManager };
