import { app } from "./app.js";
import { api } from "./api.js";
import { ComfyWidgets, LGraphNode } from "./widgets.js";
import { generateDependencyGraph } from "https://esm.sh/comfyui-json@0.1.25";
import { ComfyDeploy } from "https://esm.sh/comfydeploy@0.0.19-beta.30";

const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g fill="none" stroke="#888888" stroke-linecap="round" stroke-width="2"><path stroke-dasharray="60" stroke-dashoffset="60" stroke-opacity=".3" d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="1.3s" values="60;0"/></path><path stroke-dasharray="15" stroke-dashoffset="15" d="M12 3C16.9706 3 21 7.02944 21 12"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="15;0"/><animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></g></svg>`;

function sendEventToCD(event, data) {
  const message = {
    type: event,
    data: data,
  };
  window.parent.postMessage(JSON.stringify(message), "*");
}

function dispatchAPIEventData(data) {
  const msg = JSON.parse(data);

  // Custom parse error
  if (msg.error) {
    let message = msg.error.message;
    if (msg.error.details) message += ": " + msg.error.details;
    for (const [nodeID, nodeError] of Object.entries(msg.node_errors)) {
      message += "\n" + nodeError.class_type + ":";
      for (const errorReason of nodeError.errors) {
        message +=
          "\n    - " + errorReason.message + ": " + errorReason.details;
      }
    }

    app.ui.dialog.show(message);
    if (msg.node_errors) {
      app.lastNodeErrors = msg.node_errors;
      app.canvas.draw(true, true);
    }
  }

  switch (msg.event) {
    case "error":
      break;
    case "status":
      if (msg.data.sid) {
        // this.clientId = msg.data.sid;
        // window.name = this.clientId; // use window name so it isnt reused when duplicating tabs
        // sessionStorage.setItem("clientId", this.clientId); // store in session storage so duplicate tab can load correct workflow
      }
      api.dispatchEvent(new CustomEvent("status", { detail: msg.data.status }));
      break;
    case "progress":
      api.dispatchEvent(new CustomEvent("progress", { detail: msg.data }));
      break;
    case "executing":
      api.dispatchEvent(
        new CustomEvent("executing", { detail: msg.data.node }),
      );
      break;
    case "executed":
      api.dispatchEvent(new CustomEvent("executed", { detail: msg.data }));
      break;
    case "execution_start":
      api.dispatchEvent(
        new CustomEvent("execution_start", { detail: msg.data }),
      );
      break;
    case "execution_error":
      api.dispatchEvent(
        new CustomEvent("execution_error", { detail: msg.data }),
      );
      break;
    case "execution_cached":
      api.dispatchEvent(
        new CustomEvent("execution_cached", { detail: msg.data }),
      );
      break;
    default:
      api.dispatchEvent(new CustomEvent(msg.type, { detail: msg.data }));
    // default:
    // if (this.#registered.has(msg.type)) {
    // } else {
    // throw new Error(`Unknown message type ${msg.type}`);
    // }
  }
}

const context = {
  selectedWorkflowInfo: null,
};
// let selectedWorkflowInfo = {
//   workflow_id: "05da8f2b-63af-4c0c-86dd-08d01ec512b7",
//   machine_id: "45ac5f85-b7b6-436f-8d97-2383b25485f3",
//   native_run_api_endpoint: "http://localhost:3011/api/run",
// };

async function getSelectedWorkflowInfo() {
  const workflow_info_promise = new Promise((resolve) => {
    try {
      const handleMessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "workflow_info") {
            resolve(message.data);
            window.removeEventListener("message", handleMessage);
          }
        } catch (error) {
          console.error(error);
          resolve(undefined);
        }
      };
      window.addEventListener("message", handleMessage);
      sendEventToCD("workflow_info");
    } catch (error) {
      console.error(error);
      resolve(undefined);
    }
  });

  return workflow_info_promise;
}

function setSelectedWorkflowInfo(info) {
  context.selectedWorkflowInfo = info;
}

/** @typedef {import('../../../web/types/comfy.js').ComfyExtension} ComfyExtension*/
/** @type {ComfyExtension} */
const ext = {
  name: "BennyKok.ComfyUIDeploy",

  native_mode: false,

  init(app) {
    addButton();

    const queryParams = new URLSearchParams(window.location.search);
    const workflow_version_id = queryParams.get("workflow_version_id");
    const auth_token = queryParams.get("auth_token");
    const org_display = queryParams.get("org_display");
    const origin = queryParams.get("origin");
    const workspace_mode = queryParams.get("workspace_mode");
    this.native_mode = queryParams.get("native_mode") === "true";

    if (workspace_mode) {
      document.querySelector(".comfy-menu").style.display = "none";

      sendEventToCD("cd_plugin_onInit");

      // app.queuePrompt = ((originalFunction) => async () => {
      //   // const prompt = await app.graphToPrompt();
      //   sendEventToCD("cd_plugin_onQueuePromptTrigger");
      // })(app.queuePrompt);

      // // Intercept the onkeydown event
      // window.addEventListener(
      //   "keydown",
      //   (event) => {
      //     // Check for specific keys if necessary
      //     console.log("hi");
      //     if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      //       event.preventDefault();
      //       event.stopImmediatePropagation();
      //       event.stopPropagation();
      //       sendEventToCD("cd_plugin_onQueuePrompt", prompt);
      //     }
      //   },
      //   true,
      // );
    }

    const data = getData();
    let endpoint = data.endpoint;
    let apiKey = data.apiKey;

    // If there is auth token override it
    if (auth_token) {
      apiKey = auth_token;
      endpoint = origin;
      saveData({
        displayName: org_display,
        endpoint: origin,
        apiKey: auth_token,
        displayName: org_display,
        environment: "cloud",
      });
      localStorage.setItem("comfy_deploy_env", "cloud");
    }

    if (!workflow_version_id) {
      console.error("No workflow_version_id provided in query parameters.");
    } else {
      loadingDialog.showLoading(
        "Loading workflow from " + org_display,
        "Please wait...",
      );
      fetch(endpoint + "/api/workflow-version/" + workflow_version_id, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
      })
        .then(async (res) => {
          const data = await res.json();
          const { workflow, workflow_id, error } = data;
          if (error) {
            infoDialog.showMessage("Unable to load this workflow", error);
            return;
          }

          // // Adding a delay to wait for the intial graph to load
          // await new Promise((resolve) => setTimeout(resolve, 2000));

          workflow?.nodes.forEach((x) => {
            if (x?.type === "ComfyDeploy") {
              x.widgets_values[1] = workflow_id;
              // x.widgets_values[2] = workflow_version.version;
            }
          });

          /** @type {LGraph} */
          app.loadGraphData(workflow);
        })
        .catch((e) => infoDialog.showMessage("Error", e.message))
        .finally(() => {
          loadingDialog.close();
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        });
    }
  },

  registerCustomNodes() {
    /** @type {LGraphNode}*/
    class ComfyDeploy extends LGraphNode {
      constructor() {
        super();
        this.color = LGraphCanvas.node_colors.yellow.color;
        this.bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
        this.groupcolor = LGraphCanvas.node_colors.yellow.groupcolor;

        if (!this.properties) {
          this.properties = {};
          this.properties.workflow_name = "";
          this.properties.workflow_id = "";
          this.properties.version = "";
        }

        this.addWidget(
          "text",
          "workflow_name",
          this.properties.workflow_name,
          (v) => {
            this.properties.workflow_name = v;
          },
          { multiline: false },
        );

        this.addWidget(
          "text",
          "workflow_id",
          this.properties.workflow_id,
          (v) => {
            this.properties.workflow_id = v;
          },
          { multiline: false },
        );

        this.addWidget(
          "text",
          "version",
          this.properties.version,
          (v) => {
            this.properties.version = v;
          },
          { multiline: false },
        );

        this.widgets_start_y = 10;
        this.serialize_widgets = true;
        this.isVirtualNode = true;
      }

      onExecute() {
        // This method is called when the node is executed
        // You can add any necessary logic here
      }

      onSerialize(o) {
        // This method is called when the node is being serialized
        // Ensure all necessary data is saved
        if (!o.properties) {
          o.properties = {};
        }
        o.properties.workflow_name = this.properties.workflow_name;
        o.properties.workflow_id = this.properties.workflow_id;
        o.properties.version = this.properties.version;
      }

      onConfigure(o) {
        // This method is called when the node is being configured (e.g., when loading a saved graph)
        // Ensure all necessary data is restored
        if (o.properties) {
          this.properties = { ...this.properties, ...o.properties };
          this.widgets[0].value = this.properties.workflow_name || "";
          this.widgets[1].value = this.properties.workflow_id || "";
          this.widgets[2].value = this.properties.version || "1";
        }
      }
    }

    // Register the node type
    LiteGraph.registerNodeType(
      "ComfyDeploy",
      Object.assign(ComfyDeploy, {
        title: "Comfy Deploy",
        title_mode: LiteGraph.NORMAL_TITLE,
        collapsable: true,
      }),
    );

    ComfyDeploy.category = "deploy";
  },

  async setup() {
    // const graphCanvas = document.getElementById("graph-canvas");

    window.addEventListener("message", async (event) => {
      //   console.log("message", event);
      try {
        const message = JSON.parse(event.data);
        if (message.type === "graph_load") {
          const comfyUIWorkflow = message.data;
          // console.log("recieved: ", comfyUIWorkflow);
          // Assuming there's a method to load the workflow data into the ComfyUI
          // This part of the code would depend on how the ComfyUI expects to receive and process the workflow data
          // For demonstration, let's assume there's a loadWorkflow method in the ComfyUI API
          if (comfyUIWorkflow && app && app.loadGraphData) {
            try {
              await window["app"].ui.settings.setSettingValueAsync(
                "Comfy.Validation.Workflows",
                false,
              );
            } catch (error) {
              console.warning(
                "Error setting validation to false, is fine to ignore this",
                error,
              );
            }
            console.log("loadGraphData");
            app.loadGraphData(comfyUIWorkflow);
          }
        } else if (message.type === "deploy") {
          // deployWorkflow();
          const prompt = await app.graphToPrompt();
          // api.handlePromptGenerated(prompt);
          sendEventToCD("cd_plugin_onDeployChanges", prompt);
        } else if (message.type === "queue_prompt") {
          const prompt = await app.graphToPrompt();
          if (typeof api.handlePromptGenerated === "function") {
            api.handlePromptGenerated(prompt);
          } else {
            console.warn("api.handlePromptGenerated is not a function");
          }
          sendEventToCD("cd_plugin_onQueuePrompt", prompt);
        } else if (message.type === "get_prompt") {
          const prompt = await app.graphToPrompt();
          sendEventToCD("cd_plugin_onGetPrompt", prompt);
        } else if (message.type === "event") {
          dispatchAPIEventData(message.data);
        } else if (message.type === "add_node") {
          console.log("add node", message.data);
          app.graph.beforeChange();
          var node = LiteGraph.createNode(message.data.type);
          node.configure({
            widgets_values: message.data.widgets_values,
          });

          console.log("node", node);

          const graphMouse = app.canvas.graph_mouse;

          node.pos = [graphMouse[0], graphMouse[1]];

          app.graph.add(node);
          app.graph.afterChange();
        } else if (message.type === "zoom_to_node") {
          const nodeId = message.data.nodeId;
          const position = message.data.position;

          const node = app.graph.getNodeById(nodeId);
          if (!node) return;

          const canvas = app.canvas;
          const targetScale = 1;
          const targetOffsetX =
            canvas.canvas.width / 4 - position[0] - node.size[0] / 2;
          const targetOffsetY =
            canvas.canvas.height / 4 - position[1] - node.size[1] / 2;

          const startScale = canvas.ds.scale;
          const startOffsetX = canvas.ds.offset[0];
          const startOffsetY = canvas.ds.offset[1];

          const duration = 400; // Animation duration in milliseconds
          const startTime = Date.now();

          function easeOutCubic(t) {
            return 1 - Math.pow(1 - t, 3);
          }

          function lerp(start, end, t) {
            return start * (1 - t) + end * t;
          }

          function animate() {
            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime;
            const t = Math.min(elapsedTime / duration, 1);

            const easedT = easeOutCubic(t);

            const currentScale = lerp(startScale, targetScale, easedT);
            const currentOffsetX = lerp(startOffsetX, targetOffsetX, easedT);
            const currentOffsetY = lerp(startOffsetY, targetOffsetY, easedT);

            canvas.setZoom(currentScale);
            canvas.ds.offset = [currentOffsetX, currentOffsetY];
            canvas.draw(true, true);

            if (t < 1) {
              requestAnimationFrame(animate);
            }
          }

          animate();
        } else if (message.type === "workflow_info") {
          setSelectedWorkflowInfo(message.data);
        }
        // else if (message.type === "refresh") {
        //   sendEventToCD("cd_plugin_onRefresh");
        // }
      } catch (error) {
        // console.error("Error processing message:", error);
      }
    });

    api.addEventListener("executed", (evt) => {
      const images = evt.detail?.output.images;
      //   if (images?.length > 0 && images[0].type === "output") {
      //     generatedImages[evt.detail.node] = images[0].filename;
      //   }
      //   if (evt.detail?.output.gltfFilename) {

      //   }
    });

    app.graph.onAfterChange = ((originalFunction) =>
      async function () {
        const prompt = await app.graphToPrompt();
        sendEventToCD("cd_plugin_onAfterChange", prompt);

        if (typeof originalFunction === "function") {
          originalFunction.apply(this, arguments);
        }
      })(app.graph.onAfterChange);

    sendEventToCD("cd_plugin_setup");
  },
};

/**
 * @typedef {import('../../../web/types/litegraph.js').LGraph} LGraph
 * @typedef {import('../../../web/types/litegraph.js').LGraphNode} LGraphNode
 */

function showError(title, message) {
  infoDialog.show(
    `<h3 style="margin: 0px; color: red;">${title}</h3><br><span>${message}</span> `,
  );
}

function createDynamicUIHtml(data) {
  console.log(data);
  let html =
    '<div style="min-width: 600px; max-width: 1024px; margin: 14px auto; display: flex; flex-direction: column; gap: 24px;">';
  const bgcolor = "var(--comfy-input-bg)";
  const evenBg = "var(--border-color)";
  const textColor = "var(--input-text)";

  // Custom Nodes
  html += `<div style="background-color: ${bgcolor}; padding: 24px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">`;
  html +=
    '<h2 style="margin-top: 0px; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Custom Nodes</h2>';

  if (data.missing_nodes?.length > 0) {
    html += `
      <div style="border-bottom: 1px solid #e2e8f0; padding: 4px 12px; background-color: ${evenBg}">
          <h3 style="font-size: 14px; font-weight: semibold; margin-bottom: 8px;">Missing Nodes</h3>
          <p style="font-size: 12px;">These nodes are not found with any matching custom_nodes in the ComfyUI Manager Database</p>
          ${data.missing_nodes
            .map((node) => {
              return `<p style="font-size: 14px; color: #d69e2e;">${node}</p>`;
            })
            .join("")}
      </div>
  `;
  }

  Object.values(data.custom_nodes).forEach((node) => {
    html += `
          <div style="border-bottom: 1px solid #e2e8f0; padding-top: 16px;">
              <a href="${
                node.url
              }" target="_blank" style="font-size: 18px; font-weight: semibold; color: white; text-decoration: none;">${
                node.name
              }</a>
              <p style="font-size: 14px; color: #4b5563;">${node.hash}</p>
              ${
                node.warning
                  ? `<p style="font-size: 14px; color: #d69e2e;">${node.warning}</p>`
                  : ""
              }
          </div>
      `;
  });
  html += "</div>";

  // Models
  html += `<div style="background-color: ${bgcolor}; padding: 24px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">`;
  html +=
    '<h2 style="margin-top: 0px; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Models</h2>';

  Object.entries(data.models).forEach(([section, items]) => {
    html += `
    <div style="border-bottom: 1px solid #e2e8f0; padding-top: 8px; padding-bottom: 8px;">
        <h3 style="font-size: 18px; font-weight: semibold; margin-bottom: 8px;">${
          section.charAt(0).toUpperCase() + section.slice(1)
        }</h3>`;
    items.forEach((item) => {
      html += `<p style="font-size: 14px; color: ${textColor};">${item.name}</p>`;
    });
    html += "</div>";
  });
  html += "</div>";

  // Models
  html += `<div style="background-color: ${bgcolor}; padding: 24px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">`;
  html +=
    '<h2 style="margin-top: 0px; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Files</h2>';

  Object.entries(data.files).forEach(([section, items]) => {
    html += `
    <div style="border-bottom: 1px solid #e2e8f0; padding-top: 8px; padding-bottom: 8px;">
        <h3 style="font-size: 18px; font-weight: semibold; margin-bottom: 8px;">${
          section.charAt(0).toUpperCase() + section.slice(1)
        }</h3>`;
    items.forEach((item) => {
      html += `<p style="font-size: 14px; color: ${textColor};">${item.name}</p>`;
    });
    html += "</div>";
  });
  html += "</div>";

  html += "</div>";
  return html;
}

// Modify the existing deployWorkflow function
async function deployWorkflow() {
  const deploy = document.getElementById("deploy-button");

  /** @type {LGraph} */
  const graph = app.graph;

  let { endpoint, apiKey, displayName } = getData();

  if (!endpoint || !apiKey || apiKey === "" || endpoint === "") {
    configDialog.show();
    return;
  }

  let deployMeta = graph.findNodesByType("ComfyDeploy");

  if (deployMeta.length == 0) {
    const text = await inputDialog.input(
      "Create your deployment",
      "Workflow name",
    );
    if (!text) return;
    console.log(text);
    app.graph.beforeChange();
    var node = LiteGraph.createNode("ComfyDeploy");
    node.configure({
      widgets_values: [text],
    });
    node.pos = [0, 0];
    app.graph.add(node);
    app.graph.afterChange();
    deployMeta = [node];
  }

  const deployMetaNode = deployMeta[0];

  const workflow_name = deployMetaNode.widgets[0].value;
  const workflow_id = deployMetaNode.widgets[1].value;

  const ok = await confirmDialog.confirm(
    `Confirm deployment`,
    `
    <div>

    A new version of <button style="font-size: 18px;">${workflow_name}</button> will be deployed, do you confirm? 
    <br><br>

    <button style="font-size: 18px;">${displayName}</button>
    <br>
    <button style="font-size: 18px;">${endpoint}</button>

    <br><br>
    <label>
    <input id="include-deps" type="checkbox" checked>Include dependency</input>
    </label>
    <br>
    <label>
    <input id="reuse-hash" type="checkbox" checked>Reuse hash from last version</input>
    </label>
    </div>
    `,
  );
  if (!ok) return;

  const includeDeps = document.getElementById("include-deps").checked;
  const reuseHash = document.getElementById("reuse-hash").checked;

  if (endpoint.endsWith("/")) {
    endpoint = endpoint.slice(0, -1);
  }
  loadingDialog.showLoading("Generating snapshot");

  const snapshot = await fetch("/snapshot/get_current").then((x) => x.json());
  // console.log(snapshot);
  loadingDialog.close();

  if (!snapshot) {
    showError(
      "Error when deploying",
      "Unable to generate snapshot, please install ComfyUI Manager",
    );
    return;
  }

  const title = deploy.querySelector("#button-title");

  const prompt = await app.graphToPrompt();
  let deps = undefined;

  if (includeDeps) {
    loadingDialog.showLoading("Fetching existing version");

    const existing_workflow = await fetch(
      endpoint + "/api/workflow/" + workflow_id,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
      },
    )
      .then((x) => x.json())
      .catch(() => {
        return {};
      });

    loadingDialog.close();

    loadingDialog.showLoading("Generating dependency graph");
    deps = await generateDependencyGraph({
      workflow_api: prompt.output,
      snapshot: snapshot,
      computeFileHash: async (file) => {
        console.log(existing_workflow?.dependencies?.models);

        // Match previous hash for models
        if (reuseHash && existing_workflow?.dependencies?.models) {
          const previousModelHash = Object.entries(
            existing_workflow?.dependencies?.models,
          ).flatMap(([key, value]) => {
            return Object.values(value).map((x) => ({
              ...x,
              name: "models/" + key + "/" + x.name,
            }));
          });
          console.log(previousModelHash);

          const match = previousModelHash.find((x) => {
            console.log(file, x.name);
            return file == x.name;
          });
          console.log(match);
          if (match && match.hash) {
            console.log("cached hash used");
            return match.hash;
          }
        }
        console.log(file);
        loadingDialog.showLoading("Generating hash", file);
        const hash = await fetch(
          `/comfyui-deploy/get-file-hash?file_path=${encodeURIComponent(file)}`,
        ).then((x) => x.json());
        loadingDialog.showLoading("Generating hash", file);
        console.log(hash);
        return hash.file_hash;
      },
      //   handleFileUpload: async (file, hash, prevhash) => {
      //     console.log("Uploading ", file);
      //     loadingDialog.showLoading("Uploading file", file);
      //     try {
      //       const { download_url } = await fetch(`/comfyui-deploy/upload-file`, {
      //         method: "POST",
      //         body: JSON.stringify({
      //           file_path: file,
      //           token: apiKey,
      //           url: endpoint + "/api/upload-url",
      //         }),
      //       })
      //         .then((x) => x.json())
      //         .catch(() => {
      //           loadingDialog.close();
      //           confirmDialog.confirm("Error", "Unable to upload file " + file);
      //         });
      //       loadingDialog.showLoading("Uploaded file", file);
      //       console.log(download_url);
      //       return download_url;
      //     } catch (error) {
      //       return undefined;
      //     }
      //   },
      existingDependencies: existing_workflow.dependencies,
    });

    // Need to find a way to include this if this is not included in comfyui-json level
    if (
      !deps.custom_nodes["https://github.com/BennyKok/comfyui-deploy"] &&
      !deps.custom_nodes["https://github.com/BennyKok/comfyui-deploy.git"]
    )
      deps.custom_nodes["https://github.com/BennyKok/comfyui-deploy"] = {
        url: "https://github.com/BennyKok/comfyui-deploy",
        install_type: "git-clone",
        hash:
          snapshot?.git_custom_nodes?.[
            "https://github.com/BennyKok/comfyui-deploy"
          ]?.hash ?? "HEAD",
        name: "ComfyUI Deploy",
      };

    loadingDialog.close();

    const depsOk = await confirmDialog.confirm(
      "Check dependencies",
      // JSON.stringify(deps, null, 2),
      `
      <div>
        You will need to create a cloud machine with the following configuration on ComfyDeploy
        <ol style="text-align: left; margin-top: 10px;">
            <li>Review the dependencies listed in the graph below</li>
            <li>Create a new cloud machine with the required configuration</li>
            <li>Install missing models and check missing files</li>
            <li>Deploy your workflow to the newly created machine</li>
        </ol>
      </div>
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);">${loadingIcon}</div>
      <iframe 
      style="z-index: 10; min-width: 600px; max-width: 1024px; min-height: 600px; border: none; background-color: transparent;"
      src="https://www.comfydeploy.com/dependency-graph?deps=${encodeURIComponent(
        JSON.stringify(deps),
      )}" />`,
      // createDynamicUIHtml(deps),
    );
    if (!depsOk) return;

    console.log(deps);
  }

  loadingDialog.showLoading("Deploying...");

  title.innerText = "Deploying...";
  title.style.color = "orange";

  // console.log(prompt);

  // TODO trim the ending / from endpoint is there is
  if (endpoint.endsWith("/")) {
    endpoint = endpoint.slice(0, -1);
  }

  // console.log(prompt.workflow);

  const apiRoute = endpoint + "/api/workflow";
  // const userId = apiKey
  try {
    const body = {
      workflow_name,
      workflow_id,
      workflow: prompt.workflow,
      workflow_api: prompt.output,
      snapshot: snapshot,
      dependencies: deps,
    };
    console.log(body);
    let data = await fetch(apiRoute, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
    });

    console.log(data);

    if (data.status !== 200) {
      throw new Error(await data.text());
    } else {
      data = await data.json();
    }

    loadingDialog.close();

    title.textContent = "Done";
    title.style.color = "green";

    deployMetaNode.widgets[1].value = data.workflow_id;
    deployMetaNode.widgets[2].value = data.version;
    graph.change();

    infoDialog.show(
      `<span style="color:green;">Deployed successfully!</span>  <a style="color:white;" target="_blank" href=${endpoint}/workflows/${data.workflow_id}>-> View here</a> <br/> <br/> Workflow ID: ${data.workflow_id} <br/> Workflow Name: ${workflow_name} <br/> Workflow Version: ${data.version} <br/>`,
    );

    // // Refresh the workflows list in the sidebar
    // const sidebarEl = document.querySelector(
    //   '.comfy-sidebar-tab[data-id="search"]',
    // );
    // if (sidebarEl) {
    //   refreshWorkflowsList(sidebarEl);
    // }

    setTimeout(() => {
      title.textContent = "Deploy";
      title.style.color = "white";
    }, 1000);
  } catch (e) {
    loadingDialog.close();
    app.ui.dialog.show(e);
    console.error(e);
    title.textContent = "Error";
    title.style.color = "red";
    setTimeout(() => {
      title.textContent = "Deploy";
      title.style.color = "white";
    }, 1000);
  }
}

// Add this function to refresh the workflows list
function refreshWorkflowsList(el) {
  const workflowsList = el.querySelector("#workflows-list");
  const workflowsLoading = el.querySelector("#workflows-loading");

  workflowsLoading.style.display = "flex";
  workflowsList.style.display = "none";
  workflowsList.innerHTML = "";

  client.workflows
    .getAll({
      page: "1",
      pageSize: "10",
    })
    .then((result) => {
      workflowsLoading.style.display = "none";
      workflowsList.style.display = "block";

      if (result.length === 0) {
        workflowsList.innerHTML =
          "<li style='color: #bdbdbd;'>No workflows found</li>";
        return;
      }

      result.forEach((workflow) => {
        const li = document.createElement("li");
        li.style.marginBottom = "15px";
        li.style.padding = "15px";
        li.style.backgroundColor = "#2a2a2a";
        li.style.borderRadius = "8px";
        li.style.boxShadow = "0 2px 4px rgba(0,0,0,0.1)";

        const lastRun = workflow.runs[0];
        const lastRunStatus = lastRun ? lastRun.status : "No runs";
        const statusColor =
          lastRunStatus === "success"
            ? "#4CAF50"
            : lastRunStatus === "error"
              ? "#F44336"
              : "#FFC107";

        const timeAgo = getTimeAgo(new Date(workflow.updatedAt));

        li.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <strong style="font-size: 18px; color: #e0e0e0;">${workflow.name}</strong>
            </div>
            <span style="font-size: 12px; color: ${statusColor}; margin-left: 10px;">Last run: ${lastRunStatus}</span>
          </div>
          <div style="font-size: 14px; color: #bdbdbd; margin-bottom: 10px;">Last updated ${timeAgo}</div>
          <div style="display: flex; gap: 10px;">
            <button class="open-cloud-btn" style="padding: 5px 10px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">Open in Cloud</button>
            <button class="load-api-btn" style="padding: 5px 10px; background-color: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">Load Workflow</button>
          </div>
        `;

        const openCloudBtn = li.querySelector(".open-cloud-btn");
        openCloudBtn.onclick = () =>
          window.open(
            `${getData().endpoint}/workflows/${workflow.id}?workspace=true`,
            "_blank",
          );

        const loadApiBtn = li.querySelector(".load-api-btn");
        loadApiBtn.onclick = () => loadWorkflowApi(workflow.versions[0].id);

        workflowsList.appendChild(li);
      });
    })
    .catch((error) => {
      console.error("Error fetching workflows:", error);
      workflowsLoading.style.display = "none";
      workflowsList.style.display = "block";
      workflowsList.innerHTML =
        "<li style='color: #F44336;'>Error fetching workflows</li>";
    });
}

function addButton() {
  const menu = document.querySelector(".comfy-menu");

  const deploy = document.createElement("button");
  deploy.id = "deploy-button";
  deploy.style.position = "relative";
  deploy.style.display = "block";
  deploy.innerHTML = "<div id='button-title'>Deploy</div>";
  deploy.onclick = async () => {
    await deployWorkflow();
  };

  const config = document.createElement("img");
  // config.style.padding = "0px 10px";
  config.style.height = "100%";
  config.style.position = "absolute";
  config.style.right = "10px";
  config.style.top = "0px";

  // set aspect ratio to square
  config.style.width = "20px";
  config.src =
    "https://api.iconify.design/material-symbols-light:settings.svg?color=%23888888";
  config.onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    configDialog.show();
  };

  deploy.append(config);

  deploy.style.order = "99";

  menu.append(deploy);
}

app.registerExtension(ext);

import { ComfyDialog, $el } from "../../scripts/ui.js";

export class InfoDialog extends ComfyDialog {
  constructor() {
    super();
    this.element.classList.add("comfy-normal-modal");
    this.element.style.paddingBottom = "20px";
  }

  button = undefined;

  createButtons() {
    this.button = $el("button", {
      type: "button",
      textContent: "Close",
      onclick: () => this.close(),
    });
    return [this.button];
  }

  close() {
    this.element.style.display = "none";
  }

  show(html) {
    this.textElement.style["white-space"] = "normal";
    this.textElement.style.color = "white";
    this.textElement.style.marginTop = "0px";
    if (typeof html === "string") {
      this.textElement.innerHTML = html;
    } else {
      this.textElement.replaceChildren(html);
    }
    this.element.style.display = "flex";
    this.element.style.zIndex = 1001;
  }

  showMessage(title, message) {
    this.show(`
      <div style="width: 100%; max-width: 600px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px;">${title}</h3>
        <label>
          ${message}
        </label>
        </div>
      `);
  }

  showLoading(title, message) {
    this.show(`
      <div style="width: 400px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px; display: flex; align-items: center; justify-content: center;">${title} ${loadingIcon}</h3>
        <label>
          ${message}
        </label>
        </div>
      `);
  }
}

export class LoadingDialog extends ComfyDialog {
  constructor() {
    super();
    this.element.classList.add("comfy-normal-modal");
    // this.element.style.paddingBottom = "20px";
  }

  createButtons() {
    return [];
  }

  close() {
    this.element.style.display = "none";
  }

  show(html) {
    this.textElement.style["white-space"] = "normal";
    this.textElement.style.color = "white";
    this.textElement.style.marginTop = "0px";
    if (typeof html === "string") {
      this.textElement.innerHTML = html;
    } else {
      this.textElement.replaceChildren(html);
    }
    this.element.style.display = "flex";
    this.element.style.zIndex = 1001;
  }

  loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g fill="none" stroke="#888888" stroke-linecap="round" stroke-width="2"><path stroke-dasharray="60" stroke-dashoffset="60" stroke-opacity=".3" d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="1.3s" values="60;0"/></path><path stroke-dasharray="15" stroke-dashoffset="15" d="M12 3C16.9706 3 21 7.02944 21 12"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="15;0"/><animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></g></svg>`;

  showLoading(title, message) {
    this.show(`
      <div style="width: 400px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px; display: flex; align-items: center; justify-content: center; gap: 12px;">${title} ${
          this.loadingIcon
        }</h3>
          ${
            message
              ? `<label style="max-width: 100%; white-space: pre-wrap; word-wrap: break-word;">${message}</label>`
              : ""
          }
        </div>
      `);
  }
}

export class InputDialog extends InfoDialog {
  callback = undefined;

  constructor() {
    super();
  }

  createButtons() {
    return [
      $el(
        "div",
        {
          type: "div",
          style: {
            display: "flex",
            gap: "6px",
            justifyContent: "flex-end",
            width: "100%",
          },
        },
        [
          $el("button", {
            type: "button",
            textContent: "Close",
            onclick: () => {
              this.callback?.(undefined);
              this.close();
            },
          }),
          $el("button", {
            type: "button",
            textContent: "Save",
            onclick: () => {
              const input = this.textElement.querySelector("#input").value;
              if (input.trim() === "") {
                showError("Input validation", "Input cannot be empty");
              } else {
                this.callback?.(input);
                this.close();
                this.textElement.querySelector("#input").value = "";
              }
            },
          }),
        ],
      ),
    ];
  }

  input(title, message) {
    return new Promise((resolve, reject) => {
      this.callback = resolve;
      this.show(`
      <div style="width: 400px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px;">${title}</h3>
        <label>
          ${message}
          <input id="input" style="margin-top: 8px; width: 100%; height:40px; padding: 0px 6px; box-sizing: border-box; outline-offset: -1px;">
        </label>
        </div>
      `);
    });
  }
}

export class ConfirmDialog extends InfoDialog {
  callback = undefined;

  constructor() {
    super();
  }

  createButtons() {
    return [
      $el(
        "div",
        {
          type: "div",
          style: {
            display: "flex",
            gap: "6px",
            justifyContent: "flex-end",
            width: "100%",
          },
        },
        [
          $el("button", {
            type: "button",
            textContent: "Close",
            onclick: () => {
              this.callback?.(false);
              this.close();
            },
          }),
          $el("button", {
            type: "button",
            textContent: "Confirm",
            style: {
              color: "green",
            },
            onclick: () => {
              this.callback?.(true);
              this.close();
            },
          }),
        ],
      ),
    ];
  }

  confirm(title, message) {
    return new Promise((resolve, reject) => {
      this.callback = resolve;
      this.show(`
      <div style="width: 100%; max-width: 600px; display: flex; gap: 18px; flex-direction: column; overflow: unset; position: relative;">
        <h3 style="margin: 0px;">${title}</h3>
        ${message}
        </div>
      `);
    });
  }
}

export const inputDialog = new InputDialog();
export const loadingDialog = new LoadingDialog();
export const infoDialog = new InfoDialog();
export const confirmDialog = new ConfirmDialog();

/**
 * Retrieves deployment data from local storage or defaults.
 * @param {string} [environment] - The environment to get the data for.
 * @returns {{endpoint: string, apiKey: string, displayName: string, environment?: string}} The deployment data.
 */
function getData(environment) {
  const deployOption =
    environment || localStorage.getItem("comfy_deploy_env") || "cloud";
  const data = localStorage.getItem("comfy_deploy_env_data_" + deployOption);
  if (!data) {
    if (deployOption == "cloud")
      return {
        endpoint: "https://www.comfydeploy.com",
        apiKey: "",
      };
    else
      return {
        endpoint: "http://localhost:3000",
        apiKey: "",
      };
  }
  return {
    ...JSON.parse(data),
    environment: deployOption,
  };
}

/**
 * Retrieves deployment data from local storage or defaults.
 * @param {{endpoint: string, apiKey: string, displayName: string, environment?: string}} [data] - The environment to get the data for.
 */
function saveData(data) {
  localStorage.setItem(
    "comfy_deploy_env_data_" + data.environment,
    JSON.stringify(data),
  );
}

export class ConfigDialog extends ComfyDialog {
  container = null;
  poll = null;
  timeout = null;

  constructor() {
    super();
    this.element.classList.add("comfy-normal-modal");
    this.element.style.paddingBottom = "20px";

    this.container = document.createElement("div");
    this.element.querySelector(".comfy-modal-content").prepend(this.container);
  }

  createButtons() {
    return [
      $el(
        "div",
        {
          type: "div",
          style: {
            display: "flex",
            gap: "6px",
            justifyContent: "flex-end",
            width: "100%",
          },
          onclick: () => {
            this.save();
            this.close();
          },
        },
        [
          $el("button", {
            type: "button",
            textContent: "Close",
            onclick: () => this.close(),
          }),
          $el("button", {
            type: "button",
            textContent: "Save",
            onclick: () => {
              this.save();
              this.close();
            },
          }),
        ],
      ),
    ];
  }

  close() {
    this.element.style.display = "none";
    clearInterval(this.poll);
    clearTimeout(this.timeout);
  }

  save(api_key, displayName) {
    const deployOption = this.container.querySelector("#deployOption").value;
    localStorage.setItem("comfy_deploy_env", deployOption);

    const endpoint = this.container.querySelector("#endpoint").value;
    const apiKey = api_key ?? this.container.querySelector("#apiKey").value;

    if (!displayName) {
      if (apiKey != getData().apiKey) {
        displayName = "Custom";
      } else {
        displayName = getData().displayName;
      }
    }

    saveData({
      endpoint,
      apiKey,
      displayName,
      environment: deployOption,
    });
  }

  show() {
    this.container.style.color = "white";

    const data = getData();

    this.container.innerHTML = `
    <div style="width: 400px; display: flex; gap: 18px; flex-direction: column;">
    <h3 style="margin: 0px;">Comfy Deploy Config</h3>
    <label style="color: white; width: 100%;">
      <select id="deployOption" style="margin: 8px 0px; width: 100%; height:30px; box-sizing: border-box;" >
        <option value="cloud" ${data.environment === "cloud" ? "selected" : ""}>Cloud</option>
        <option value="local" ${data.environment === "local" ? "selected" : ""}>Local</option>
      </select>
    </label>
      <label style="color: white; width: 100%;">
        Endpoint:
        <input id="endpoint" style="margin-top: 8px; width: 100%; height:40px; box-sizing: border-box; padding: 0px 6px;" type="text" value="${
          data.endpoint
        }">
      </label>
      <div style="color: white;">
        API Key: User / Org <button style="font-size: 18px;">${
          data.displayName ?? ""
        }</button>
        <input id="apiKey" style="margin-top: 8px; width: 100%; height:40px; box-sizing: border-box; padding: 0px 6px;" type="password" value="${
          data.apiKey
        }">
        <button id="loginButton" style="margin-top: 8px; width: 100%; height:40px; box-sizing: border-box; padding: 0px 6px;">
          ${
            data.apiKey ? "Re-login with ComfyDeploy" : "Login with ComfyDeploy"
          }
        </button>
      </div>
      </div>
    `;

    const button = this.container.querySelector("#loginButton");
    button.onclick = () => {
      this.save();
      const data = getData();

      const uuid =
        Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15);
      window.open(data.endpoint + "/auth-request/" + uuid, "_blank");

      this.timeout = setTimeout(() => {
        clearInterval(poll);
        infoDialog.showMessage(
          "Timeout",
          "Wait too long for the response, please try re-login",
        );
      }, 30000); // Stop polling after 30 seconds

      this.poll = setInterval(() => {
        fetch(data.endpoint + "/api/auth-response/" + uuid)
          .then((response) => response.json())
          .then(async (json) => {
            if (json.api_key) {
              this.save(json.api_key, json.name);
              this.close();
              this.container.querySelector("#apiKey").value = json.api_key;
              // infoDialog.show();
              clearInterval(this.poll);
              clearTimeout(this.timeout);
              // Refresh dialog
              const a = await confirmDialog.confirm(
                "Authenticated",
                `<div>You will be able to upload workflow to <button style="font-size: 18px; width: fit;">${json.name}</button></div>`,
              );
              configDialog.show();
            }
          })
          .catch((error) => {
            console.error("Error:", error);
            clearInterval(this.poll);
            clearTimeout(this.timeout);
            infoDialog.showMessage("Error", error);
          });
      }, 2000);
    };

    const apiKeyInput = this.container.querySelector("#apiKey");
    apiKeyInput.addEventListener("paste", (e) => {
      e.stopPropagation();
    });

    const deployOption = this.container.querySelector("#deployOption");
    const container = this.container;
    deployOption.addEventListener("change", function () {
      const selectedOption = this.value;
      const data = getData(selectedOption);
      localStorage.setItem("comfy_deploy_env", selectedOption);

      container.querySelector("#endpoint").value = data.endpoint;
      container.querySelector("#apiKey").value = data.apiKey;
    });

    this.element.style.display = "flex";
    this.element.style.zIndex = 1001;
  }
}

export const configDialog = new ConfigDialog();

const currentOrigin = window.location.origin;
const client = new ComfyDeploy({
  bearerAuth: getData().apiKey,
  serverURL: `${currentOrigin}/comfydeploy/api/`,
});

app.extensionManager.registerSidebarTab({
  id: "search",
  icon: "pi pi-cloud-upload",
  title: "Deploy",
  tooltip: "Deploy and Configure",
  type: "custom",
  render: (el) => {
    el.innerHTML = `
      <div style="padding: 20px;">
        <h3>Comfy Deploy</h3>
        <div id="deploy-container" style="margin-bottom: 20px;"></div>
        <div id="workflows-container">
          <h4>Your Workflows</h4>
          <div id="workflows-loading" style="display: flex; justify-content: center; align-items: center; height: 100px;">
            ${loadingIcon}
          </div>
          <ul id="workflows-list" style="list-style-type: none; padding: 0; display: none;"></ul>
        </div>
        <div id="config-container"></div>
      </div>
    `;

    // Add deploy button
    const deployContainer = el.querySelector("#deploy-container");
    const deployButton = document.createElement("button");
    deployButton.id = "sidebar-deploy-button";
    deployButton.style.display = "flex";
    deployButton.style.alignItems = "center";
    deployButton.style.justifyContent = "center";
    deployButton.style.width = "100%";
    deployButton.style.marginBottom = "10px";
    deployButton.style.padding = "10px";
    deployButton.style.fontSize = "16px";
    deployButton.style.fontWeight = "bold";
    deployButton.style.backgroundColor = "#4CAF50";
    deployButton.style.color = "white";
    deployButton.style.border = "none";
    deployButton.style.borderRadius = "5px";
    deployButton.style.cursor = "pointer";
    deployButton.innerHTML = `<i class="pi pi-cloud-upload" style="margin-right: 8px;"></i><div id='sidebar-button-title'>Deploy</div>`;
    deployButton.onclick = async () => {
      await deployWorkflow();
      // Refresh the workflows list after deployment
      refreshWorkflowsList(el);
    };
    deployContainer.appendChild(deployButton);

    // Add config button
    const configContainer = el.querySelector("#config-container");
    const configButton = document.createElement("button");
    configButton.style.display = "flex";
    configButton.style.alignItems = "center";
    configButton.style.justifyContent = "center";
    configButton.style.width = "100%";
    configButton.style.padding = "8px";
    configButton.style.fontSize = "14px";
    configButton.style.backgroundColor = "#f0f0f0";
    configButton.style.color = "#333";
    configButton.style.border = "1px solid #ccc";
    configButton.style.borderRadius = "5px";
    configButton.style.cursor = "pointer";
    configButton.innerHTML = `<i class="pi pi-cog" style="margin-right: 8px;"></i>Configure`;
    configButton.onclick = () => {
      configDialog.show();
    };
    deployContainer.appendChild(configButton);

    // Fetch and display workflows
    const workflowsList = el.querySelector("#workflows-list");
    const workflowsLoading = el.querySelector("#workflows-loading");

    refreshWorkflowsList(el);
  },
});

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " years ago";
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " months ago";
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " days ago";
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " hours ago";
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " minutes ago";
  return Math.floor(seconds) + " seconds ago";
}

async function loadWorkflowApi(versionId) {
  try {
    const response = await client.comfyui.getWorkflowVersionVersionId({
      versionId: versionId,
    });
    // Implement the logic to load the workflow API into the ComfyUI interface
    console.log("Workflow API loaded:", response);
    await window["app"].ui.settings.setSettingValueAsync(
      "Comfy.Validation.Workflows",
      false,
    );
    app.loadGraphData(response.workflow);
    // You might want to update the UI or trigger some action in ComfyUI here
  } catch (error) {
    console.error("Error loading workflow API:", error);
    // Show an error message to the user
  }
}

const orginal_fetch_api = api.fetchApi;
api.fetchApi = async (route, options) => {
  console.log("Fetch API called with args:", route, options, ext.native_mode);

  if (route.startsWith("/prompt") && ext.native_mode) {
    const info = await getSelectedWorkflowInfo();
    console.log("info", info);
    if (info) {
      const body = JSON.parse(options.body);

      const data = {
        client_id: body.client_id,
        workflow_api_json: body.prompt,
        workflow: body?.extra_data?.extra_pnginfo?.workflow,
        is_native_run: true,
        machine_id: info.machine_id,
        workflow_id: info.workflow_id,
        native_run_api_endpoint: info.native_run_api_endpoint,
        gpu_event_id: info.gpu_event_id,
      };

      return await fetch("/comfyui-deploy/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${info.cd_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
    }
  }

  return await orginal_fetch_api.call(api, route, options);
};
