// Workflow list management
let workflowsState = {
  workflows: [],
  offset: 0,
  limit: 20,
  loading: false,
  hasMore: true,
  initialized: false,
  currentSearch: "",
};

// Make workflowsState accessible globally
window.workflowsState = workflowsState;

async function fetchWorkflows(getData, offset = 0, limit = 20, search = "") {
  try {
    const data = getData();
    if (!data.apiKey) {
      throw new Error("API key not configured");
    }

    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
      api_url: data.apiUrl || "https://api.comfydeploy.com",
      ...(search && { search }),
    });

    const response = await fetch(`/comfyui-deploy/workflows?${params}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${data.apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch workflows: ${response.status}`);
    }

    const result = await response.json();
    console.log("result", result);
    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error fetching workflows:", error);
    return [];
  }
}

function createWorkflowItem(workflow, getTimeAgo, getData) {
  const li = document.createElement("li");
  li.style.cssText = `
      border-bottom: 1px solid #444;
      background: transparent;
      transition: all 0.2s ease;
      cursor: pointer;
    `;

  li.addEventListener("mouseenter", () => {
    li.style.background = "#333";
  });

  li.addEventListener("mouseleave", () => {
    li.style.background = "transparent";
  });

  // Add click handler to fetch and load workflow data
  li.addEventListener("click", async () => {
    try {
      const data = getData();
      if (!data.apiKey) {
        console.error("No API key configured");
        return;
      }

      // Show loading toast
      const loadingToast = window.app.extensionManager.toast.add({
        severity: "info",
        summary: "Loading workflow...",
        detail: `Loading "${workflow.name}"`,
        life: 3000,
      });

      const params = new URLSearchParams({
        workflow_id: workflow.id,
        api_url: data.apiUrl || "https://api.comfydeploy.com",
      });

      const response = await fetch(`/comfyui-deploy/workflow?${params}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${data.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch workflow: ${response.status}`);
      }

      const workflowData = await response.json();
      console.log("Workflow data:", workflowData);

      // Load the workflow into the graph
      if (workflowData.versions && workflowData.versions.length > 0) {
        const latestVersion = workflowData.versions[0];
        if (latestVersion.workflow && window.app) {
          // Load the workflow
          window.app.loadGraphData(latestVersion.workflow);

          // Show success toast
          window.app.extensionManager.toast.add({
            severity: "success",
            summary: "Workflow loaded successfully",
            detail: `Loaded "${workflow.name}" v${latestVersion.version}`,
            life: 3000,
          });
        }
      }
    } catch (error) {
      console.error("Error loading workflow:", error);
      // Show error toast
      window.app.extensionManager.toast.add({
        severity: "error",
        summary: "Failed to load workflow",
        detail: error.message,
        life: 5000,
      });
    } finally {
      loadingToast.close();
    }
  });

  const updatedDate = new Date(workflow.updated_at);
  const timeAgo = getTimeAgo(updatedDate);

  li.innerHTML = `
      <div style="padding: 12px 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          ${
            workflow.cover_image
              ? `<img src="${workflow.cover_image}" 
                     style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover; flex-shrink: 0;"
                     onerror="this.style.display='none'">`
              : `<div style="width: 40px; height: 40px; border-radius: 4px; background: #444; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 14px; color: #888;">
                   ${workflow.name.charAt(0).toUpperCase()}
                 </div>`
          }
          
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h4 style="margin: 0; font-size: 14px; font-weight: 400; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${workflow.name}
              </h4>
              ${
                workflow.pinned
                  ? `<span style="color: #ffd700; font-size: 12px;">📌</span>`
                  : ""
              }
            </div>
            
            ${
              workflow.description
                ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #bbb; line-height: 1.3; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                     ${workflow.description}
                   </p>`
                : ""
            }
            
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 8px;">
              <img src="${workflow.user_icon}" 
                   style="width: 16px; height: 16px; border-radius: 50%;"
                   onerror="this.style.display='none'">
              <span style="font-size: 11px; color: #888;">
                ${workflow.user_name} • Updated ${timeAgo}
              </span>
            </div>
          </div>
        </div>
      </div>
    `;

  return li;
}

async function loadMoreWorkflows(element, getData, getTimeAgo) {
  if (workflowsState.loading || !workflowsState.hasMore) return;

  workflowsState.loading = true;

  const workflowsList = element.querySelector("#workflows-list");
  const workflowsLoading = element.querySelector("#workflows-loading");

  // Show loading indicator
  workflowsLoading.style.display = "flex";

  try {
    const newWorkflows = await fetchWorkflows(
      getData,
      workflowsState.offset,
      workflowsState.limit,
      workflowsState.currentSearch
    );

    if (newWorkflows.length === 0) {
      workflowsState.hasMore = false;
    } else {
      workflowsState.workflows.push(...newWorkflows);
      workflowsState.offset += newWorkflows.length;

      // Render new workflow items
      newWorkflows.forEach((workflow) => {
        const workflowItem = createWorkflowItem(workflow, getTimeAgo, getData);
        workflowsList.appendChild(workflowItem);
      });
    }
  } catch (error) {
    console.error("Error loading more workflows:", error);
  } finally {
    workflowsState.loading = false;
    workflowsLoading.style.display = "none";
  }
}

function setupInfiniteScroll(container, element, getData, getTimeAgo) {
  let isScrolling = false;

  container.addEventListener("scroll", () => {
    if (isScrolling) return;

    const { scrollTop, scrollHeight, clientHeight } = container;

    // Load more when scrolled to bottom (with 100px threshold)
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      isScrolling = true;
      loadMoreWorkflows(element, getData, getTimeAgo).finally(() => {
        isScrolling = false;
      });
    }
  });
}

async function initializeWorkflowsList(element, getData, getTimeAgo) {
  const workflowsContainer = element.querySelector("#workflows-container");
  const workflowsList = element.querySelector("#workflows-list");
  const workflowsLoading = element.querySelector("#workflows-loading");

  // Check if already initialized AND the DOM elements still exist
  if (
    workflowsState.initialized &&
    workflowsList &&
    workflowsList.children.length > 0
  )
    return;

  try {
    // Reset state (always reset when reinitializing)
    workflowsState = {
      workflows: [],
      offset: 0,
      limit: 20,
      loading: false,
      hasMore: true,
      initialized: true,
      currentSearch: "",
    };

    // Clear existing content in case of reinitialization
    if (workflowsList) {
      workflowsList.innerHTML = "";
    }

    // Show container and loading
    workflowsContainer.style.display = "block";
    workflowsLoading.style.display = "flex";

    // Style the workflows list for full height scrolling
    workflowsList.style.cssText = `
        list-style-type: none;
        padding: 0;
        margin: 0;
        height: calc(100vh - 350px);
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #666 transparent;
        border-top: 1px solid #444;
      `;

    // Add webkit scrollbar styles
    const style = document.createElement("style");
    style.textContent = `
        #workflows-list::-webkit-scrollbar {
          width: 6px;
        }
        #workflows-list::-webkit-scrollbar-track {
          background: transparent;
        }
        #workflows-list::-webkit-scrollbar-thumb {
          background: #666;
          border-radius: 3px;
        }
        #workflows-list::-webkit-scrollbar-thumb:hover {
          background: #777;
        }
      `;
    document.head.appendChild(style);

    // Setup infinite scroll
    setupInfiniteScroll(workflowsList, element, getData, getTimeAgo);

    // Load initial workflows
    await loadMoreWorkflows(element, getData, getTimeAgo);

    // Show the list
    workflowsList.style.display = "block";
  } catch (error) {
    console.error("Error initializing workflows list:", error);
    workflowsLoading.innerHTML = `
        <div style="text-align: center; color: #e74c3c; font-size: 12px; padding: 20px;">
          <div>Failed to load workflows</div>
          <button onclick="initializeWorkflowsList(this.closest('.comfy-menu'), getData, getTimeAgo)" 
                  style="margin-top: 8px; padding: 4px 8px; font-size: 11px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 4px; cursor: pointer;">
            Retry
          </button>
        </div>
      `;
  }
}

// Search functionality
function addWorkflowSearch(element, getData, getTimeAgo) {
  const workflowsContainer = element.querySelector("#workflows-container");
  const h4 = workflowsContainer.querySelector("h4");

  const searchContainer = document.createElement("div");
  searchContainer.style.cssText = "margin-bottom: 12px;";

  const searchInput = document.createElement("input");
  searchInput.type = "text";
  searchInput.placeholder = "Search workflows...";
  searchInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #555;
      border-radius: 6px;
      font-size: 12px;
      box-sizing: border-box;
      background: #333;
      color: #fff;
    `;

  let searchTimeout;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(async () => {
      const searchTerm = e.target.value.trim();

      // Update the tracked search term
      workflowsState.currentSearch = searchTerm;

      // Reset state for new search
      workflowsState.workflows = [];
      workflowsState.offset = 0;
      workflowsState.hasMore = true;

      // Clear current list
      const workflowsList = element.querySelector("#workflows-list");
      workflowsList.innerHTML = "";

      // Load with search term
      workflowsState.loading = false;
      await loadMoreWorkflows(element, getData, getTimeAgo);
    }, 300);
  });

  searchContainer.appendChild(searchInput);
  h4.after(searchContainer);
}

// Export the functions
export {
  initializeWorkflowsList,
  addWorkflowSearch,
  workflowsState,
  fetchWorkflows,
  loadMoreWorkflows,
};
