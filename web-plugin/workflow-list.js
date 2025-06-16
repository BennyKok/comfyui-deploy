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

function createWorkflowItem(workflow, getTimeAgo) {
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

  const updatedDate = new Date(workflow.updated_at);
  const timeAgo = getTimeAgo(updatedDate);

  li.innerHTML = `
      <div style="padding: 12px 16px;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          ${
            workflow.cover_image
              ? `
            <div style="flex-shrink: 0;">
              <img src="${workflow.cover_image}" 
                   style="width: 48px; height: 48px; border-radius: 6px; object-fit: cover; background: #333;" 
                   alt="Workflow cover"
                   onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
              <div style="display: none; width: 48px; height: 48px; border-radius: 6px; background: #333; align-items: center; justify-content: center; color: #aaa; font-size: 20px;">
                📄
              </div>
            </div>
          `
              : `
            <div style="flex-shrink: 0; width: 48px; height: 48px; border-radius: 6px; background: #333; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 20px;">
              📄
            </div>
          `
          }
          
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <h5 style="margin: 0; font-size: 14px; font-weight: 400; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1;">
                ${workflow.name}
              </h5>
              ${
                workflow.pinned
                  ? '<span style="color: #f39c12; font-size: 12px;">📌</span>'
                  : ""
              }
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
              <span style="font-size: 11px; color: #888;">
                Updated ${timeAgo}
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
        const workflowItem = createWorkflowItem(workflow, getTimeAgo);
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

  if (workflowsState.initialized) return;

  try {
    // Reset state
    workflowsState = {
      workflows: [],
      offset: 0,
      limit: 20,
      loading: false,
      hasMore: true,
      initialized: true,
      currentSearch: "",
    };

    // Show container and loading
    workflowsContainer.style.display = "block";
    workflowsLoading.style.display = "flex";

    // Style the workflows list for full height scrolling
    workflowsList.style.cssText = `
        list-style-type: none;
        padding: 0;
        margin: 0;
        height: calc(100vh - 400px);
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
