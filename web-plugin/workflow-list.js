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

// Helper: ensure a `ComfyDeploy` node exists and is updated with correct version
function ensureComfyDeployNode({ name, id, version }) {
  if (!window.app || !window.app.graph) {
    console.warn("ComfyDeploy: App or graph not available");
    return;
  }

  const graph = window.app.graph;
  let nodes = graph.findNodesByType("ComfyDeploy");

  graph.beforeChange();

  if (nodes.length === 0) {
    // Create new ComfyDeploy node
    console.log("ComfyDeploy: Creating new ComfyDeploy node", {
      name,
      id,
      version,
    });
    const node = LiteGraph.createNode("ComfyDeploy");
    node.configure({ widgets_values: [name || "", id || "", version || 1] });
    node.pos = [0, 0];
    graph.add(node);
  } else {
    // Update existing node - always sync all values to ensure consistency
    const node = nodes[0];
    const currentValues = node.widgets_values || [];
    const newValues = [
      name || currentValues[0] || "",
      id || currentValues[1] || "",
      version || currentValues[2] || 1,
    ];

    // Check if any values changed
    const valuesChanged =
      JSON.stringify(currentValues) !== JSON.stringify(newValues);

    if (valuesChanged) {
      console.log("ComfyDeploy: Updating ComfyDeploy node", {
        from: {
          name: currentValues[0],
          id: currentValues[1],
          version: currentValues[2],
        },
        to: { name: newValues[0], id: newValues[1], version: newValues[2] },
      });

      node.widgets_values = newValues;

      // Force widget updates if they exist
      if (node.widgets) {
        node.widgets.forEach((widget, index) => {
          if (widget && newValues[index] !== undefined) {
            widget.value = newValues[index];
          }
        });
      }
    } else {
      console.log("ComfyDeploy: ComfyDeploy node already up to date", {
        name,
        id,
        version,
      });
    }
  }

  graph.afterChange();
}

// Helper: automatically ensure ComfyDeploy node after workflow loading
async function ensureComfyDeployNodeAfterLoad(
  { name, id, version },
  delayMs = 200
) {
  // Wait for workflow to be fully loaded
  await new Promise((resolve) => setTimeout(resolve, delayMs));

  // Ensure the ComfyDeploy node is present and correct
  ensureComfyDeployNode({ name, id, version });

  // Also refresh the workflow card if it's visible
  if (window.refreshCurrentWorkflowCard) {
    setTimeout(() => {
      window.refreshCurrentWorkflowCard(id, version);
    }, 100);
  }
}

function getComfyDeployMeta() {
  if (!window.app || !window.app.graph) return null;
  const graph = window.app.graph;
  const nodes = graph.findNodesByType("ComfyDeploy");
  if (nodes.length === 0) return null;
  const v = nodes[0].widgets_values || [];
  const meta = { name: v[0], id: v[1], version: v[2] };
  console.log("Current ComfyDeploy meta:", meta);
  return meta;
}

async function fetchWorkflowVersions(
  getData,
  workflowId,
  offset = 0,
  limit = 20,
  search = ""
) {
  const data = getData();
  const params = new URLSearchParams({
    workflow_id: workflowId,
    offset: String(offset),
    limit: String(limit),
    api_url: data.apiUrl || "https://api.comfydeploy.com",
    ...(search && { search }),
  });
  const res = await fetch(`/comfyui-deploy/workflow/versions?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${data.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) return [];
  const versions = await res.json();
  return Array.isArray(versions) ? versions : [];
}

async function fetchWorkflowVersionData(getData, workflowId, version) {
  const data = getData();
  const params = new URLSearchParams({
    workflow_id: workflowId,
    version: String(version),
    api_url: data.apiUrl || "https://api.comfydeploy.com",
  });
  const res = await fetch(`/comfyui-deploy/workflow/version?${params}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${data.apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch workflow version ${version}`);
  return await res.json();
}

// Shared function to create workflow card HTML template
function createWorkflowCardHTML(workflowName, version) {
  return `
    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
      <div style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
          <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);"></div>
          <span style="font-size: 8px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Current Workflow</span>
        </div>
        <h3 style="font-size: 14px; font-weight: 500; margin: 0 0 6px 0; color: #f9fafb; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${workflowName}
        </h3>
        <div id="cd-current-comment" style="font-size: 10px; color: #d1d5db; line-height: 1.4; margin-top: 4px; display: none; font-style: italic;"></div>
      </div>
      <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0;">
        <div style="position: relative;">
          <span id="cd-version-badge" style="
            display: inline-flex; 
            align-items: center; 
            font-size: 11px; 
            background: linear-gradient(135deg, #3b82f6, #1d4ed8); 
            color: white; 
            padding: 6px 10px; 
            border-radius: 8px; 
            font-weight: 600;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
          ">v${version}</span>
        </div>
        <button id="cd-version-btn" style="
          padding: 8px 12px; 
          border: 1px solid #4b5563; 
          border-radius: 8px; 
          background: linear-gradient(135deg, #374151, #1f2937); 
          color: #f3f4f6; 
          cursor: pointer; 
          font-size: 12px; 
          font-weight: 500;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          gap: 4px;
        " onmouseover="this.style.background='linear-gradient(135deg, #4b5563, #374151)'; this.style.borderColor='#6b7280';" onmouseout="this.style.background='linear-gradient(135deg, #374151, #1f2937)'; this.style.borderColor='#4b5563';">
          <span>Change</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6"/>
          </svg>
        </button>
      </div>
    </div>
    
    <div id="cd-version-panel" style="display: none; position: absolute; top: 100%; right: 0; z-index: 1000; margin-top: 8px;">
      <div id="cd-version-dropdown" style="
        width: 320px; 
        max-height: 300px; 
        overflow: hidden;
        background: #1f2937; 
        border: 1px solid #4b5563; 
        border-radius: 12px; 
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
        backdrop-filter: blur(8px);
      ">
        <div style="
          position: sticky; 
          top: 0; 
          padding: 12px 16px; 
          background: linear-gradient(135deg, #374151, #1f2937); 
          border-bottom: 1px solid #4b5563; 
          font-size: 12px; 
          color: #d1d5db; 
          font-weight: 600;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        ">Select Version</div>
        <div id="cd-version-list" style="
          max-height: 240px; 
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: #4b5563 transparent;
        "></div>
        <div id="cd-version-loading" style="
          display: none; 
          padding: 16px; 
          text-align: center; 
          color: #9ca3af;
          font-size: 12px;
        ">Loading versions...</div>
      </div>
    </div>
  `;
}

function renderCurrentWorkflowCard(element, getData) {
  const container = element.querySelector("#workflows-container");
  if (!container) return;

  // Remove old card if any
  const old = container.querySelector("#cd-current-workflow-card");
  if (old) old.remove();

  const meta = getComfyDeployMeta();
  if (!meta || !meta.id) {
    console.log("No ComfyDeploy meta found, not showing workflow card");
    return; // Only show when node exists
  }

  console.log("Rendering workflow card with meta:", meta);

  const card = document.createElement("div");
  card.id = "cd-current-workflow-card";
  card.style.cssText = `
    margin: 8px 0 16px 0;
    padding: 16px;
    border: 1px solid #374151;
    border-radius: 12px;
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    color: #f9fafb;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;
    position: relative;
  `;

  // Add hover effect
  card.addEventListener("mouseenter", () => {
    card.style.transform = "translateY(-1px)";
    card.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.5)";
    card.style.borderColor = "#4b5563";
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "translateY(0)";
    card.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
    card.style.borderColor = "#374151";
  });

  // Use the shared template
  card.innerHTML = createWorkflowCardHTML(
    meta.name || "Unnamed Workflow",
    meta.version || 1
  );

  // Add custom scrollbar styles
  const scrollbarStyle = document.createElement("style");
  scrollbarStyle.textContent = `
    #cd-version-list::-webkit-scrollbar {
      width: 6px;
    }
    #cd-version-list::-webkit-scrollbar-track {
      background: transparent;
    }
    #cd-version-list::-webkit-scrollbar-thumb {
      background: #4b5563;
      border-radius: 3px;
    }
    #cd-version-list::-webkit-scrollbar-thumb:hover {
      background: #6b7280;
    }
  `;
  document.head.appendChild(scrollbarStyle);

  const btn = card.querySelector("#cd-version-btn");
  const panel = card.querySelector("#cd-version-panel");
  const dropdown = card.querySelector("#cd-version-dropdown");
  const list = card.querySelector("#cd-version-list");
  const loading = card.querySelector("#cd-version-loading");

  const state = {
    offset: 0,
    limit: 20,
    loading: false,
    hasMore: true,
    isOpen: false,
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (!card.contains(event.target)) {
      closeDropdown();
    }
  };

  const openDropdown = () => {
    state.isOpen = true;
    panel.style.display = "block";
    btn.querySelector("svg").style.transform = "rotate(180deg)";
    document.addEventListener("click", handleClickOutside);

    // Add opening animation
    dropdown.style.opacity = "0";
    dropdown.style.transform = "translateY(-8px)";
    setTimeout(() => {
      dropdown.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      dropdown.style.opacity = "1";
      dropdown.style.transform = "translateY(0)";
    }, 10);
  };

  const closeDropdown = () => {
    state.isOpen = false;
    panel.style.display = "none";
    btn.querySelector("svg").style.transform = "rotate(0deg)";
    document.removeEventListener("click", handleClickOutside);
  };

  async function loadMore() {
    if (state.loading || !state.hasMore) return;

    state.loading = true;
    loading.style.display = "block";

    try {
      const items = await fetchWorkflowVersions(
        getData,
        meta.id,
        state.offset,
        state.limit
      );

      if (items.length === 0) {
        state.hasMore = false;
        // If this is the first load and no items, show a message
        if (state.offset === 0) {
          const noVersionsMsg = document.createElement("div");
          noVersionsMsg.style.cssText = `
            padding: 16px;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
          `;
          noVersionsMsg.textContent = "No versions found";
          list.appendChild(noVersionsMsg);
        }
      } else {
        items.forEach((v, index) => {
          const row = document.createElement("div");
          const isCurrentVersion = v.version === meta.version;

          row.style.cssText = `
            padding: 12px 16px;
            border-bottom: 1px solid #374151;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
            ${
              isCurrentVersion
                ? "background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6;"
                : ""
            }
          `;

          row.innerHTML = `
            <div>
              <div style="font-size: 13px; font-weight: 500; color: ${
                isCurrentVersion ? "#3b82f6" : "#f3f4f6"
              }; margin-bottom: 2px;">
                v${v.version} ${isCurrentVersion ? "(Current)" : ""}
              </div>
              ${
                v.comment
                  ? `<div style="font-size: 11px; color: #9ca3af; line-height: 1.3;">${v.comment}</div>`
                  : ""
              }
            </div>
            ${
              isCurrentVersion
                ? '<div style="color: #3b82f6; font-size: 12px;">✓</div>'
                : ""
            }
          `;

          if (!isCurrentVersion) {
            row.addEventListener("mouseenter", () => {
              row.style.background = "#374151";
            });

            row.addEventListener("mouseleave", () => {
              row.style.background = "transparent";
            });
          }

          row.onclick = async () => {
            if (isCurrentVersion) return;

            try {
              // Add loading state to the row
              row.style.opacity = "0.6";
              row.style.cursor = "wait";

              const data = await fetchWorkflowVersionData(
                getData,
                meta.id,
                v.version
              );

              if (data?.workflow) {
                window.app.loadGraphData(data.workflow);

                // Ensure ComfyDeploy node is correct and refresh UI
                await ensureComfyDeployNodeAfterLoad({
                  name: meta.name,
                  id: meta.id,
                  version: v.version,
                });

                renderCurrentWorkflowCard(element, getData);

                window.app.extensionManager.toast.add({
                  severity: "success",
                  summary: "Version loaded",
                  detail: `Loaded v${v.version}${
                    v.comment ? ` - ${v.comment}` : ""
                  }`,
                  life: 3000,
                });

                closeDropdown();
              }
            } catch (e) {
              row.style.opacity = "1";
              row.style.cursor = "pointer";

              window.app.extensionManager.toast.add({
                severity: "error",
                summary: "Failed to load version",
                detail: e.message,
                life: 4000,
              });
            }
          };

          list.appendChild(row);
        });

        state.offset += items.length;
      }
    } catch (error) {
      console.error("Error loading versions:", error);

      // Show error message in dropdown if it's the first load
      if (state.offset === 0) {
        const errorMsg = document.createElement("div");
        errorMsg.style.cssText = `
          padding: 16px;
          text-align: center;
          color: #ef4444;
          font-size: 12px;
          line-height: 1.4;
        `;
        errorMsg.innerHTML = `
          <div style="margin-bottom: 4px;">Failed to load versions</div>
          <div style="font-size: 11px; color: #9ca3af;">Check your connection and try again</div>
        `;
        list.appendChild(errorMsg);
      }

      // Don't set hasMore to false on error, allow retry
    } finally {
      state.loading = false;
      loading.style.display = "none";
    }
  }

  btn.onclick = async (e) => {
    e.stopPropagation();

    if (state.isOpen) {
      closeDropdown();
    } else {
      openDropdown();
      // Always clear and reload to get fresh data
      list.innerHTML = "";
      // Reset state for fresh load
      state.offset = 0;
      state.hasMore = true;
      state.loading = false;
      await loadMore();
    }
  };

  list.addEventListener("scroll", () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 10) {
      loadMore();
    }
  });

  // Populate current comment
  (async () => {
    try {
      const vdata = await fetchWorkflowVersionData(
        getData,
        meta.id,
        meta.version
      );
      const commentEl = card.querySelector("#cd-current-comment");
      if (commentEl && vdata?.comment) {
        commentEl.style.display = "block";
        commentEl.textContent = vdata.comment;
      }
    } catch (error) {
      console.warn(
        `Could not fetch version ${meta.version} data:`,
        error.message
      );
      // Don't show error to user for comment fetching, just log it
      const commentEl = card.querySelector("#cd-current-comment");
      if (commentEl) {
        commentEl.style.display = "none";
      }
    }
  })();

  const searchEl = container.querySelector("#cd-search-container");
  if (searchEl) {
    container.insertBefore(card, searchEl);
  } else {
    container.prepend(card);
  }
}

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
  let loadingToast = null;
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
      loadingToast = window.app.extensionManager.toast.add({
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

          // Ensure ComfyDeploy node is correct with latest version
          await ensureComfyDeployNodeAfterLoad({
            name: workflow.name,
            id: workflow.id,
            version: latestVersion.version,
          });

          // Show success toast
          window.app.extensionManager.toast.add({
            severity: "success",
            summary: "Workflow loaded successfully",
            detail: `Loaded "${workflow.name}" v${latestVersion.version}`,
            life: 3000,
          });

          // Re-render header card to reflect newly selected workflow
          renderCurrentWorkflowCard(document, getData);
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
      if (loadingToast) {
        loadingToast.close();
      }
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
        height: calc(100vh - 650px);
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

    // Render current workflow card if a ComfyDeploy node exists
    try {
      renderCurrentWorkflowCard(element, getData);
    } catch (e) {
      console.error("Render current workflow card failed", e);
    }

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
  searchContainer.id = "cd-search-container";
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

// Function to refresh current workflow card after deployment
function refreshCurrentWorkflowCard(workflowId = null, version = null) {
  try {
    console.log("Refreshing current workflow card...", { workflowId, version });

    // Find the current workflow card container
    const container = document.querySelector("#workflows-container");
    if (container) {
      const getDataFunction = window.comfyDeployGetData;

      // If specific workflow ID and version are provided, use those
      if (workflowId && version) {
        console.log("Using provided workflow ID and version:", {
          workflowId,
          version,
        });

        // Create a custom renderCurrentWorkflowCard that uses the provided data
        renderCurrentWorkflowCardWithData(
          document,
          getDataFunction,
          workflowId,
          version
        );
      } else {
        // Fallback to getting meta from ComfyDeploy node
        const currentMeta = getComfyDeployMeta();
        console.log("Meta from node:", currentMeta);

        // Re-render the current workflow card with updated version
        renderCurrentWorkflowCard(document, getDataFunction);
      }

      console.log("Current workflow card refreshed after deployment");
    } else {
      console.log("Workflows container not found, skipping refresh");
    }
  } catch (error) {
    console.error("Error refreshing current workflow card:", error);
  }
}

// Function to render workflow card with specific data (not from ComfyDeploy node)
function renderCurrentWorkflowCardWithData(
  element,
  getData,
  workflowId,
  version
) {
  const container = element.querySelector("#workflows-container");
  if (!container) return;

  // Remove old card if any
  const old = container.querySelector("#cd-current-workflow-card");
  if (old) old.remove();

  // Get the workflow name from the ComfyDeploy node if available
  const meta = getComfyDeployMeta();
  const workflowName = meta?.name || "Unnamed Workflow";

  console.log("Rendering workflow card with provided data:", {
    workflowId,
    version,
    workflowName,
  });

  const card = document.createElement("div");
  card.id = "cd-current-workflow-card";
  card.style.cssText = `
    margin: 8px 0 16px 0;
    padding: 16px;
    border: 1px solid #374151;
    border-radius: 12px;
    background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
    color: #f9fafb;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
    transition: all 0.2s ease;
    position: relative;
  `;

  // Add hover effect
  card.addEventListener("mouseenter", () => {
    card.style.transform = "translateY(-1px)";
    card.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.5)";
    card.style.borderColor = "#4b5563";
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "translateY(0)";
    card.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.4)";
    card.style.borderColor = "#374151";
  });

  // Use the shared template
  card.innerHTML = createWorkflowCardHTML(workflowName, version);

  // Add the same dropdown functionality as the original card
  setupVersionDropdown(card, getData, workflowId, version, workflowName);

  // Populate current comment using the provided version
  (async () => {
    try {
      const vdata = await fetchWorkflowVersionData(
        getData,
        workflowId,
        version
      );
      const commentEl = card.querySelector("#cd-current-comment");
      if (commentEl && vdata?.comment) {
        commentEl.style.display = "block";
        commentEl.textContent = vdata.comment;
      }
    } catch (error) {
      console.warn(`Could not fetch version ${version} data:`, error.message);
      // Don't show error to user for comment fetching, just log it
      const commentEl = card.querySelector("#cd-current-comment");
      if (commentEl) {
        commentEl.style.display = "none";
      }
    }
  })();

  const searchEl = container.querySelector("#cd-search-container");
  if (searchEl) {
    container.insertBefore(card, searchEl);
  } else {
    container.prepend(card);
  }
}

// Extract dropdown setup logic to reuse
function setupVersionDropdown(
  card,
  getData,
  workflowId,
  currentVersion,
  workflowName
) {
  const btn = card.querySelector("#cd-version-btn");
  const panel = card.querySelector("#cd-version-panel");
  const dropdown = card.querySelector("#cd-version-dropdown");
  const list = card.querySelector("#cd-version-list");
  const loading = card.querySelector("#cd-version-loading");

  const state = {
    offset: 0,
    limit: 20,
    loading: false,
    hasMore: true,
    isOpen: false,
  };

  // Close dropdown when clicking outside
  const handleClickOutside = (event) => {
    if (!card.contains(event.target)) {
      closeDropdown();
    }
  };

  const openDropdown = () => {
    state.isOpen = true;
    panel.style.display = "block";
    btn.querySelector("svg").style.transform = "rotate(180deg)";
    document.addEventListener("click", handleClickOutside);

    // Add opening animation
    dropdown.style.opacity = "0";
    dropdown.style.transform = "translateY(-8px)";
    setTimeout(() => {
      dropdown.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      dropdown.style.opacity = "1";
      dropdown.style.transform = "translateY(0)";
    }, 10);
  };

  const closeDropdown = () => {
    state.isOpen = false;
    panel.style.display = "none";
    btn.querySelector("svg").style.transform = "rotate(0deg)";
    document.removeEventListener("click", handleClickOutside);
  };

  async function loadMore() {
    if (state.loading || !state.hasMore) return;

    state.loading = true;
    loading.style.display = "block";

    try {
      const items = await fetchWorkflowVersions(
        getData,
        workflowId,
        state.offset,
        state.limit
      );

      if (items.length === 0) {
        state.hasMore = false;
        if (state.offset === 0) {
          const noVersionsMsg = document.createElement("div");
          noVersionsMsg.style.cssText = `
            padding: 16px;
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
          `;
          noVersionsMsg.textContent = "No versions found";
          list.appendChild(noVersionsMsg);
        }
      } else {
        items.forEach((v, index) => {
          const row = document.createElement("div");
          const isCurrentVersion = v.version == currentVersion; // Use == for type coercion

          row.style.cssText = `
            padding: 12px 16px;
            border-bottom: 1px solid #374151;
            cursor: pointer;
            transition: all 0.15s ease;
            display: flex;
            justify-content: space-between;
            align-items: center;
            ${
              isCurrentVersion
                ? "background: rgba(59, 130, 246, 0.1); border-left: 3px solid #3b82f6;"
                : ""
            }
          `;

          row.innerHTML = `
            <div>
              <div style="font-size: 13px; font-weight: 500; color: ${
                isCurrentVersion ? "#3b82f6" : "#f3f4f6"
              }; margin-bottom: 2px;">
                v${v.version} ${isCurrentVersion ? "(Current)" : ""}
              </div>
              ${
                v.comment
                  ? `<div style="font-size: 11px; color: #9ca3af; line-height: 1.3;">${v.comment}</div>`
                  : ""
              }
            </div>
            ${
              isCurrentVersion
                ? '<div style="color: #3b82f6; font-size: 12px;">✓</div>'
                : ""
            }
          `;

          if (!isCurrentVersion) {
            row.addEventListener("mouseenter", () => {
              row.style.background = "#374151";
            });

            row.addEventListener("mouseleave", () => {
              row.style.background = "transparent";
            });
          }

          row.onclick = async () => {
            if (isCurrentVersion) return;

            try {
              row.style.opacity = "0.6";
              row.style.cursor = "wait";

              const data = await fetchWorkflowVersionData(
                getData,
                workflowId,
                v.version
              );

              if (data?.workflow) {
                window.app.loadGraphData(data.workflow);

                // Ensure ComfyDeploy node is correct and refresh UI
                await ensureComfyDeployNodeAfterLoad({
                  name: workflowName,
                  id: workflowId,
                  version: v.version,
                });

                window.app.extensionManager.toast.add({
                  severity: "success",
                  summary: "Version loaded",
                  detail: `Loaded v${v.version}${
                    v.comment ? ` - ${v.comment}` : ""
                  }`,
                  life: 3000,
                });

                closeDropdown();
              } else {
                throw new Error(
                  data === null
                    ? `Version ${v.version} not found or no longer exists`
                    : `Version ${v.version} has no workflow data`
                );
              }
            } catch (e) {
              row.style.opacity = "1";
              row.style.cursor = "pointer";

              window.app.extensionManager.toast.add({
                severity: "error",
                summary: "Failed to load version",
                detail: e.message || `Could not load version ${v.version}`,
                life: 4000,
              });
            }
          };

          list.appendChild(row);
        });

        state.offset += items.length;
      }
    } catch (error) {
      console.error("Error loading versions:", error);

      if (state.offset === 0) {
        const errorMsg = document.createElement("div");
        errorMsg.style.cssText = `
          padding: 16px;
          text-align: center;
          color: #ef4444;
          font-size: 12px;
          line-height: 1.4;
        `;
        errorMsg.innerHTML = `
          <div style="margin-bottom: 4px;">Failed to load versions</div>
          <div style="font-size: 11px; color: #9ca3af;">Check your connection and try again</div>
        `;
        list.appendChild(errorMsg);
      }
    } finally {
      state.loading = false;
      loading.style.display = "none";
    }
  }

  btn.onclick = async (e) => {
    e.stopPropagation();

    if (state.isOpen) {
      closeDropdown();
    } else {
      openDropdown();
      // Always clear and reload to get fresh data
      list.innerHTML = "";
      state.offset = 0;
      state.hasMore = true;
      state.loading = false;
      await loadMore();
    }
  };

  list.addEventListener("scroll", () => {
    if (list.scrollTop + list.clientHeight >= list.scrollHeight - 10) {
      loadMore();
    }
  });
}

// Make the refresh function available globally
window.refreshCurrentWorkflowCard = refreshCurrentWorkflowCard;

// Export the functions
export {
  initializeWorkflowsList,
  addWorkflowSearch,
  workflowsState,
  fetchWorkflows,
  loadMoreWorkflows,
  refreshCurrentWorkflowCard,
};
