import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";
// import { LGraphNode } from "../../scripts/widgets.js";
LGraphNode = LiteGraph.LGraphNode;
import { ComfyDialog, $el } from "../../scripts/ui.js";
import {
  initializeWorkflowsList,
  addWorkflowSearch,
  refreshCurrentWorkflowCard,
} from "./workflow-list.js";
import { initializeMachineManager } from "./machine-manager.js";
import { initializeModelManager } from "./model-manager.js";

const styles = `
.comfydeploy-menu-item {
    background: linear-gradient(to right, rgba(74, 144, 226, 0.9), rgba(103, 178, 111, 0.9)) !important;
    color: white !important;
    position: relative !important;
    padding-left: 20px !important;
}

.comfydeploy-menu-item:hover {
    filter: brightness(1.1) !important;
    cursor: pointer !important;
}

.comfydeploy-menu-item::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background-image: url('https://www.comfydeploy.com/icon.svg');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
}
`;

// Add stylesheet to document
const styleSheet = document.createElement("style");
styleSheet.textContent = styles;
document.head.appendChild(styleSheet);

const loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g fill="none" stroke="#888888" stroke-linecap="round" stroke-width="2"><path stroke-dasharray="60" stroke-dashoffset="60" stroke-opacity=".3" d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="1.3s" values="60;0"/></path><path stroke-dasharray="15" stroke-dashoffset="15" d="M12 3C16.9706 3 21 7.02944 21 12"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="15;0"/><animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></g></svg>`;

function sendEventToCD(event, data) {
  const message = {
    type: event,
    data: data,
  };
  window.parent.postMessage(JSON.stringify(message), "*");
}

function sendDirectEventToCD(event, data) {
  const message = {
    type: event,
    data: data,
  };
  window.parent.postMessage(message, "*");
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
        new CustomEvent("executing", { detail: msg.data.node })
      );
      break;
    case "executed":
      api.dispatchEvent(new CustomEvent("executed", { detail: msg.data }));
      break;
    case "execution_start":
      api.dispatchEvent(
        new CustomEvent("execution_start", { detail: msg.data })
      );
      break;
    case "execution_error":
      api.dispatchEvent(
        new CustomEvent("execution_error", { detail: msg.data })
      );
      break;
    case "execution_cached":
      api.dispatchEvent(
        new CustomEvent("execution_cached", { detail: msg.data })
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

const VALID_TYPES = [
  "STRING",
  "number",
  "toggle",
  "BOOLEAN",
  "text",
  "string",
  "combo",
];

function hideWidget(node, widget, suffix = "") {
  if (widget.type?.startsWith(CONVERTED_TYPE)) return;
  widget.origType = widget.type;
  widget.origComputeSize = widget.computeSize;
  widget.origSerializeValue = widget.serializeValue;
  // console.log(widget.origComputeSize);
  // console.log(LiteGraph.NODE_SLOT_HEIGHT);
  // widget.computeSize = () => [0, 0];
  widget.type = CONVERTED_TYPE + suffix;
  widget.serializeValue = () => {
    if (!node.inputs) {
      return void 0;
    }
    let node_input = node.inputs.find((i) => i.widget?.name === widget.name);
    if (!node_input || !node_input.link) {
      return void 0;
    }
    return widget.origSerializeValue
      ? widget.origSerializeValue()
      : widget.value;
  };
  if (widget.linkedWidgets) {
    for (const w of widget.linkedWidgets) {
      hideWidget(node, w, ":" + widget.name);
    }
  }
}

function getWidgetType(config) {
  let type = config[0];
  if (type instanceof Array) {
    type = "COMBO";
  }
  return { type };
}

async function convertToInput(node, widget, config) {
  const { type } = getWidgetType(config);

  console.log(node, widget, config);

  const result = await app.extensionManager.dialog.prompt({
    title: "Convert " + widget.name + " to external input",
    message: "Input name",
    defaultValue: widget.name,
  });

  if (!result) return;

  // Check for duplicate input IDs across existing external input nodes
  const existingInputIds = Object.values(app.graph.nodes)
    .filter((n) => n.type.startsWith("ComfyUIDeployExternal"))
    .map((n) => n.widgets_values?.[0])
    .filter(Boolean);

  if (existingInputIds.includes(result)) {
    app.extensionManager.toast.add({
      severity: "error",
      summary: "Input ID already exists",
      detail: "Please choose a different name.",
      life: 3000,
    });
    return;
  }

  if (node.type == "LoadImage") {
    var inputNode = LiteGraph.createNode("ComfyUIDeployExternalImage");
    console.log(widget);

    const currentOutputsLinks = node.outputs[0].links;

    // const index = node.inputs.findIndex((x) => x.name == widget.name);
    // console.log(node.widgets_values, index);
    // inputNode.configure({
    //   widgets_values: ["input_text", widget.value],
    // });
    inputNode.pos = node.pos;
    inputNode.id = ++app.graph.last_node_id;
    // inputNode.pos[0] += node.size[0] + 40;
    node.pos[0] -= inputNode.size[0] + 20;
    console.log(inputNode);
    console.log(app.graph);
    app.graph.add(inputNode);

    const links = app.graph.links;

    // console.log(currentOutputsLinks);

    if (currentOutputsLinks)
      for (let i = 0; i < currentOutputsLinks.length; i++) {
        const link = currentOutputsLinks[i];
        const llink = links[link];
        console.log(links[link]);
        setTimeout(
          () => inputNode.connect(0, llink.target_id, llink.target_slot),
          100
        );
      }

    node.connect(0, inputNode, 0);

    return null;
  }

  let externalNode = "";
  let inputId = result;

  if (type === "INT") {
    externalNode = "ComfyUIDeployExternalNumberInt";
    // inputId = "input_number";
  }

  if (type === "FLOAT") {
    externalNode = "ComfyUIDeployExternalNumberSlider";
    // inputId = "input_number";
  }

  if (type === "STRING") {
    externalNode = "ComfyUIDeployExternalText";
    // inputId = "input_text";
  }

  if (type === "COMBO") {
    externalNode = "ComfyUIDeployExternalEnum";
    // inputId = "input_enum";
  }

  if (!externalNode || !inputId) return;

  node.convertWidgetToInput(widget);

  var inputNode = LiteGraph.createNode(
    externalNode,
    "External Input: " + inputId
  );

  // if (type === "COMBO") {
  //   inputNode = LiteGraph.createNode(externalNode, "External Input: " + inputId, {
  //     dynamic_enum_options: config[0],
  //   });
  //   console.log(inputNode);
  //   const options = config[0];
  //   console.log(options);
  // } else {
  //   inputNode = LiteGraph.createNode(externalNode, "External Input: " + inputId);
  // }

  var options;

  const index = node.inputs.findIndex((x) => x.name == widget.name);
  if (type === "COMBO") {
    options = widget.options?.values ?? config[0];
    inputNode.configure({
      widgets_values: [inputId, widget.value, JSON.stringify(options)],
    });
  } else {
    inputNode.configure({
      widgets_values: [inputId, widget.value],
    });
  }
  inputNode.id = ++app.graph.last_node_id;
  inputNode.pos = node.pos;
  inputNode.pos[0] -= node.size[0] + 160;

  if (type === "COMBO") {
    console.log(inputNode);
    console.log(options);
    inputNode.widgets.find((x) => x.name == "default_value").options.values =
      options;
  }

  app.graph.add(inputNode);
  inputNode.connect(0, node, index);

  app.graph.setDirtyCanvas(true, true);

  return node.inputs.find((x) => x.name == widget.name);
}

const CONVERTED_TYPE = "converted-widget";

function getConfig(widgetName) {
  const { nodeData } = this.constructor;
  return (
    nodeData?.input?.required?.[widgetName] ??
    nodeData?.input?.optional?.[widgetName]
  );
}

function isConvertibleWidget(node, widget, config) {
  // console.log(config);
  if (
    node.type === "LoadImage" &&
    widget.type === "combo" &&
    widget.name == "image"
  ) {
    return true;
  }

  return (
    (VALID_TYPES.includes(widget.type) || VALID_TYPES.includes(config[0])) &&
    !widget.options?.forceInput
  );
}

var __defProp = Object.defineProperty;
var __name = (target, value) =>
  __defProp(target, "name", { value, configurable: true });

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
        "Please wait..."
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
            window.location.pathname
          );
        });
    }
  },

  async beforeRegisterNodeDef(nodeType, nodeData, app2) {
    const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
    nodeType.prototype.getExtraMenuOptions = function (_, options) {
      const r = origGetExtraMenuOptions
        ? origGetExtraMenuOptions.apply(this, arguments)
        : void 0;
      if (this.widgets) {
        let toInput = [];
        let toWidget = [];
        for (const w of this.widgets) {
          if (w.options?.forceInput) {
            continue;
          }
          if (w.type === CONVERTED_TYPE) {
            toWidget.push({
              content: `Convert ${w.name} to widget`,
              callback: /* @__PURE__ */ __name(
                () => convertToWidget(this, w),
                "callback"
              ),
            });
          } else {
            const config = getConfig.call(this, w.name) ?? [
              w.type,
              w.options || {},
            ];
            if (isConvertibleWidget(this, w, config)) {
              toInput.push({
                content: `Convert ${w.name} to external input`,
                callback: /* @__PURE__ */ __name(
                  async () => convertToInput(this, w, config),
                  "callback"
                ),
                className: "comfydeploy-menu-item",
              });
            }
          }
        }
        if (toInput.length) {
          if (true) {
            let optionIndex = options.findIndex(
              (o) => o && o.content === "Outputs"
            );
            if (optionIndex === -1) optionIndex = options.length;
            else optionIndex++;
            options.splice(
              0,
              0,
              // {
              //   content: "[ComfyDeploy] Convert to External Input",
              //   submenu: {
              //     options: toInput,
              //   },
              //   className: "comfydeploy-menu-item"
              // },
              ...toInput,
              null
            );
          } else {
            options.push(...toInput, null);
          }
        }
        // if (toWidget.length) {
        //   if (useConversionSubmenusSetting.value) {
        //     options.push({
        //       content: "Convert Input to Widget",
        //       submenu: {
        //         options: toWidget,
        //       },
        //     });
        //   } else {
        //     options.push(...toWidget, null);
        //   }
        // }
      }
      return r;
    };

    if (
      nodeData?.input?.optional?.default_value_url?.[1]?.image_preview === true
    ) {
      nodeData.input.optional.default_value_url = ["IMAGEPREVIEW"];
      console.log(nodeData.input.optional.default_value_url);
    }

    if (nodeData?.input?.optional?.default_value?.[1]?.dynamic_enum === true) {
      nodeData.input.optional.default_value = ["DYNAMIC_ENUM"];
      // console.log(nodeData.input.optional.default_value);
    }

    // const origonNodeCreated = nodeType.prototype.onNodeCreated;
    // nodeType.prototype.onNodeCreated = function () {
    //   const r = origonNodeCreated
    //     ? origonNodeCreated.apply(this, arguments)
    //     : void 0;

    //   if (!this.widgets) {
    //     return;
    //   }

    //   console.log(this.widgets);

    //   this.widgets.forEach(element => {
    //     if (element.type != "customtext") return

    //     console.log(element.element);

    //     const parent = element.element.parentElement

    //     console.log(element.element.parentElement)
    //     const btn = document.createElement("button");
    //     // const div = document.createElement("div");
    //     // parent.removeChild(element.element)
    //     // div.appendChild(element.element)
    //     // parent.appendChild(div)
    //     // element.element = div
    //     // console.log(element.element);
    //     // btn.style = element.element.style
    //   });

    //   return r
    // };
  },

  // async nodeCreated(node) {

  // },

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
          { multiline: false }
        );

        this.addWidget(
          "text",
          "workflow_id",
          this.properties.workflow_id,
          (v) => {
            this.properties.workflow_id = v;
          },
          { multiline: false }
        );

        this.addWidget(
          "text",
          "version",
          this.properties.version,
          (v) => {
            this.properties.version = v;
          },
          { multiline: false }
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
        // ComfyUI stores widget values in widgets_values array, not properties
        if (o.widgets_values && o.widgets_values.length >= 3) {
          // Set the widget values directly
          this.widgets[0].value = o.widgets_values[0] || "";
          this.widgets[1].value = o.widgets_values[1] || "";
          this.widgets[2].value = o.widgets_values[2] || "1";

          // Also update properties to stay in sync
          this.properties.workflow_name = o.widgets_values[0] || "";
          this.properties.workflow_id = o.widgets_values[1] || "";
          this.properties.version = o.widgets_values[2] || "1";
        } else if (o.properties) {
          // Fallback to properties if widgets_values is not available
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
      })
    );

    ComfyDeploy.category = "deploy";
  },

  getCustomWidgets() {
    return {
      IMAGEPREVIEW(node, inputName, inputData) {
        // Find or create the URL input widget
        const urlWidget = node.addWidget(
          "string",
          inputName,
          /* value=*/ "",
          () => {},
          { serialize: true }
        );

        const buttonWidget = node.addWidget(
          "button",
          "Open Assets Browser",
          /* value=*/ "",
          () => {
            sendEventToCD("assets", {
              node: node.id,
              inputName: inputName,
            });
            // console.log("load image");
          },
          { serialize: false }
        );

        console.log(node.widgets);

        console.log("urlWidget", urlWidget);

        // Add image preview functionality
        function showImage(url) {
          const img = new Image();
          img.onload = () => {
            node.imgs = [img];
            app.graph.setDirtyCanvas(true);
            node.setSizeForImage?.();
          };
          img.onerror = () => {
            node.imgs = [];
            app.graph.setDirtyCanvas(true);
          };
          img.src = url;
        }

        // Set up URL widget value handling
        let default_value = urlWidget.value;
        Object.defineProperty(urlWidget, "value", {
          set: function (value) {
            this._real_value = value;
            // Preview image when URL changes
            if (value) {
              showImage(value);
            }
          },
          get: function () {
            return this._real_value || default_value;
          },
        });

        // Show initial image if URL exists
        requestAnimationFrame(() => {
          if (urlWidget.value) {
            showImage(urlWidget.value);
          }
        });

        return { widget: urlWidget };
      },

      DYNAMIC_ENUM(node, inputName, inputData) {
        // console.log("DYNAMIC_ENUM", JSON.parse(JSON.stringify(node)), inputName, inputData);
        const enumWidget = node.addWidget("combo", inputName, "", {
          serialize: true,
          values: [],
        });

        return { widget: enumWidget };
      },
    };
  },

  async afterConfigureGraph() {
    app.graph.nodes.forEach((node) => {
      if (node.type === "ComfyUIDeployExternalEnum") {
        const default_value_index = node.widgets.findIndex(
          (x) => x.name === "default_value"
        );
        const options_index = node.widgets.findIndex(
          (x) => x.name === "options"
        );

        var dynamic_enum_options = [node.widgets[default_value_index].value];
        if (node.widgets[options_index].value) {
          dynamic_enum_options = JSON.parse(node.widgets[options_index].value);
        }
        // console.log("dynamic_enum_options", dynamic_enum_options);
        node.widgets[default_value_index].options.values = dynamic_enum_options;
      }
    });
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
                true
              );
            } catch (error) {
              console.warning(
                "Error setting validation to false, is fine to ignore this",
                error
              );
            }
            console.log("loadGraphData");
            app.loadGraphData(comfyUIWorkflow);
            sendEventToCD("graph_loaded");
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
        } else if (message.type === "configure_queue_buttons") {
          addQueueButtons(message.data);
        } else if (message.type === "configure_menu_right_buttons") {
          addMenuRightButtons(message.data);
        } else if (message.type === "configure_menu_buttons") {
          addMenuButtons(message.data);
        } else if (message.type === "get_prompt") {
          const prompt = await app.graphToPrompt();
          sendEventToCD("cd_plugin_onGetPrompt", prompt);
        } else if (message.type === "event") {
          dispatchAPIEventData(message.data);
        } else if (message.type === "update_widget") {
          // New handler for updating widget values
          const { nodeId, widgetName, value } = message.data;
          const node = app.graph.getNodeById(nodeId);

          if (!node) {
            console.warn(`Node with ID ${nodeId} not found`);
            return;
          }

          const widget = node.widgets?.find((w) => w.name === widgetName);
          if (!widget) {
            console.warn(`Widget ${widgetName} not found in node ${nodeId}`);
            return;
          }

          widget.value = value;
          app.graph.setDirtyCanvas(true);
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

    if (this.native_mode) {
      // console.log("native mode", window, window.app);
      try {
        await app.ui.settings.setSettingValueAsync("Comfy.UseNewMenu", "Top");
        await app.ui.settings.setSettingValueAsync(
          "Comfy.Sidebar.Size",
          "small"
        );
        await app.ui.settings.setSettingValueAsync(
          "Comfy.Sidebar.Location",
          "left"
        );
        await app.ui.settings.setSettingValueAsync(
          "Comfy.TutorialCompleted",
          true
        );
        console.log("native mode manmanman");
      } catch (error) {
        console.error("Error setting validation to false", error);
      }
    }

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
    `<div style="
      padding: 20px;
      background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
      border-radius: 12px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 480px;
    ">
      <div style="
        display: flex;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 16px;
        border-bottom: 1px solid #404040;
      ">
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #e74c3c, #c0392b);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="15" y1="9" x2="9" y2="15"/>
            <line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">
            ${title}
          </h3>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">
            Something went wrong
          </p>
        </div>
      </div>
      
      <div style="
        background: rgba(231, 76, 60, 0.1);
        border: 1px solid rgba(231, 76, 60, 0.3);
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      ">
        <p style="margin: 0; font-size: 14px; color: #e5e5e5; line-height: 1.5;">
          ${message}
        </p>
      </div>
    </div>`
  );
}

// Modify the existing deployWorkflow function
async function deployWorkflow() {
  const deploy = document.getElementById("deploy-button");

  /** @type {LGraph} */
  const graph = app.graph;

  let { endpoint, apiKey, apiUrl, displayName } = getData();

  if (!endpoint || !apiKey || apiKey === "" || endpoint === "" || !apiUrl) {
    configDialog.show();
    return;
  }

  let deployMeta = graph.findNodesByType("ComfyDeploy");

  if (deployMeta.length == 0) {
    const text = await inputDialog.input(
      "Create your deployment",
      "Workflow name"
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
    `Confirm Deployment`,
    `
    <div style="
      padding: 20px;
      background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
      border-radius: 12px;
      color: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 480px;
    ">
      <div style="
        display: flex;
        align-items: center;
        margin-bottom: 20px;
        padding-bottom: 16px;
        border-bottom: 1px solid #404040;
      ">
        <div style="
          width: 40px;
          height: 40px;
          background: linear-gradient(135deg, #f39c12, #e67e22);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 12px;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M7 17L17 7"/>
            <path d="M17 17H7V7"/>
          </svg>
        </div>
        <div>
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">
            Deploy New Version
          </h3>
          <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">
            Confirm your deployment settings
          </p>
        </div>
      </div>
      
      <div style="margin-bottom: 20px;">
        <p style="font-size: 14px; color: #e5e5e5; margin-bottom: 16px; line-height: 1.5;">
          A new version will be deployed with the following details:
        </p>
        
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="
            background: #1a1a1a;
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 3px solid #3b82f6;
          ">
            <div style="font-size: 12px; color: #999; margin-bottom: 4px;">WORKFLOW</div>
            <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${workflow_name}</div>
          </div>
          
          <div style="
            background: #1a1a1a;
            padding: 12px 16px;
            border-radius: 8px;
            border-left: 3px solid #8b5cf6;
          ">
            <div style="font-size: 12px; color: #999; margin-bottom: 4px;">ENDPOINT</div>
            <div style="font-size: 14px; font-weight: 600; color: #ffffff;">${endpoint}</div>
          </div>
        </div>
      </div>
    </div>
    `
  );
  if (!ok) return;

  const prompt = await app.graphToPrompt();

  console.log(prompt);

  if (workflow_id.trim() !== "") {
    const text = await inputDialog.input("Save changes", "Comment");
    if (!text) return;

    try {
      loadingDialog.showLoading("Saving changes");

      const body = {
        api_url: apiUrl,
        workflow: prompt.workflow,
        workflow_id: workflow_id,
        workflow_api: prompt.output,
        comment: text,
      };

      let data = await fetch("/comfyui-deploy/workflow/version", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
      });

      if (data.status !== 200) {
        throw new Error(await data.text());
      } else {
        data = await data.json();

        console.log(data);

        infoDialog.show(
          `<div style="
            padding: 20px;
            background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
            border-radius: 12px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 480px;
          ">
            <div style="
              display: flex;
              align-items: center;
              margin-bottom: 20px;
              padding-bottom: 16px;
              border-bottom: 1px solid #404040;
            ">
              <div style="
                width: 40px;
                height: 40px;
                background: linear-gradient(135deg, #27ae60, #229954);
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 12px;
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22,4 12,14.01 9,11.01"/>
                </svg>
              </div>
              <div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">
                  Deployment Successful
                </h3>
                <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">
                  New version created successfully
                </p>
              </div>
            </div>
            
            <div style="
              background: rgba(39, 174, 96, 0.1);
              border: 1px solid rgba(39, 174, 96, 0.3);
              border-radius: 8px;
              padding: 16px;
              margin-bottom: 16px;
            ">
              <div style="display: flex; flex-direction: column; gap: 12px;">
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 8px 0;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                ">
                  <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Workflow ID</span>
                  <span style="font-size: 14px; font-weight: 600; color: #ffffff; font-family: monospace;">${data.workflow_id}</span>
                </div>
                
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 8px 0;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                ">
                  <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Workflow Name</span>
                  <span style="font-size: 14px; font-weight: 600; color: #ffffff;">${workflow_name}</span>
                </div>
                
                <div style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  padding: 8px 0;
                ">
                  <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Version</span>
                  <span style="
                    font-size: 14px; 
                    font-weight: 600; 
                    color: #27ae60;
                    background: rgba(39, 174, 96, 0.2);
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: monospace;
                  ">v${data.version}</span>
                </div>
              </div>
            </div>
          </div>`
        );

        deployMetaNode.widgets[2].value = data.version;
        graph.change();

        if (window.refreshCurrentWorkflowCard) {
          console.log(
            "Refreshing current workflow card after version update with version",
            data.version
          );
          window.refreshCurrentWorkflowCard(workflow_id, data.version);
        }
      }
    } catch (e) {
      infoDialog.showError("Error", e.message);
      return;
    } finally {
      loadingDialog.close();
      return;
    }
  }

  if (endpoint.endsWith("/")) {
    endpoint = endpoint.slice(0, -1);
  }

  const title = deploy.querySelector("#button-title");

  loadingDialog.showLoading("Deploying...");

  title.innerText = "Deploying...";
  title.style.color = "orange";

  try {
    const body = {
      name: workflow_name,
      workflow_json: prompt.workflow,
      workflow_api: prompt.output,
      api_url: apiUrl,
    };
    const machineId = localStorage.getItem("comfy_deploy_machine_id");
    if (machineId) {
      body.machine_id = machineId;
    }
    console.log(body);
    let data = await fetch("/comfyui-deploy/workflow", {
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
      await refreshWorkflowListIfOpen();
    }

    loadingDialog.close();

    title.textContent = "Done";
    title.style.color = "green";

    deployMetaNode.widgets[1].value = data.workflow_id;
    deployMetaNode.widgets[2].value = 2;
    graph.change();

    if (data.workflow_id) {
      const prompt_with_workflow_id = await app.graphToPrompt();

      const body = {
        api_url: apiUrl,
        workflow: prompt_with_workflow_id.workflow,
        workflow_id: data.workflow_id,
        workflow_api: prompt_with_workflow_id.output,
        comment: "chore: apply workflow id",
      };

      let new_version_data = await fetch("/comfyui-deploy/workflow/version", {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + apiKey,
        },
      });

      if (new_version_data.status !== 200) {
        throw new Error(await new_version_data.text());
      } else {
        // Parse the JSON response to get the actual version data
        const versionData = await new_version_data.json();

        if (window.refreshCurrentWorkflowCard) {
          console.log(
            "Refreshing current workflow card with new version",
            versionData.version
          );
          window.refreshCurrentWorkflowCard(
            data.workflow_id,
            versionData.version
          );
        }
      }
    }

    infoDialog.show(
      `<div style="
        padding: 20px;
        background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
        border-radius: 12px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        max-width: 480px;
      ">
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #404040;
        ">
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #10b981, #059669);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M7 17L17 7"/>
              <path d="M17 17H7V7"/>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">
              Deployed Successfully!
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">
              Your workflow is now live
            </p>
          </div>
        </div>
        
        <div style="
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        ">
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            ">
              <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Workflow ID</span>
              <span style="font-size: 14px; font-weight: 600; color: #ffffff; font-family: monospace;">${data.workflow_id}</span>
            </div>
            
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            ">
              <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Workflow Name</span>
              <span style="font-size: 14px; font-weight: 600; color: #ffffff;">${workflow_name}</span>
            </div>
            
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            ">
              <span style="font-size: 12px; color: #999; text-transform: uppercase; letter-spacing: 0.5px;">Version</span>
              <span style="
                font-size: 14px; 
                font-weight: 600; 
                color: #10b981;
                background: rgba(16, 185, 129, 0.2);
                padding: 4px 8px;
                border-radius: 4px;
                font-family: monospace;
              ">v2</span>
            </div>
            
            <div style="
              display: flex;
              justify-content: center;
              padding-top: 12px;
            ">
              <a 
                href="${endpoint}/workflows/${data.workflow_id}" 
                target="_blank" 
                style="
                  display: inline-flex;
                  align-items: center;
                  gap: 8px;
                  background: linear-gradient(135deg, #10b981, #059669);
                  color: white;
                  padding: 10px 20px;
                  border-radius: 8px;
                  text-decoration: none;
                  font-size: 14px;
                  font-weight: 600;
                  transition: all 0.2s ease;
                "
                onmouseover="this.style.background='linear-gradient(135deg, #059669, #047857)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(16, 185, 129, 0.3)'"
                onmouseout="this.style.background='linear-gradient(135deg, #10b981, #059669)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15,3 21,3 21,9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View Workflow
              </a>
            </div>
          </div>
        </div>
      </div>`
    );

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

  showError(title, message) {
    this.show(`
      <div style="width: 100%; max-width: 600px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px; color: #ff4444; display: flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          ${title}
        </h3>
        <div style="padding: 12px;">
          ${message}
        </div>
      </div>
    `);
    // Set higher z-index to appear above config dialog
    this.element.style.zIndex = 1010;
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
            gap: "12px",
            justifyContent: "flex-end",
            width: "100%",
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid #404040",
          },
        },
        [
          $el("button", {
            type: "button",
            textContent: "Cancel",
            onclick: () => {
              this.callback?.(undefined);
              this.close();
            },
            style: {
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1.5px solid #525252",
              background: "transparent",
              color: "#e5e5e5",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "80px",
            },
            onmouseenter: (e) => {
              e.target.style.borderColor = "#6b7280";
              e.target.style.background = "#374151";
            },
            onmouseleave: (e) => {
              e.target.style.borderColor = "#525252";
              e.target.style.background = "transparent";
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
            style: {
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #3b82f6, #2563eb)",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "80px",
            },
            onmouseenter: (e) => {
              e.target.style.background =
                "linear-gradient(135deg, #2563eb, #1d4ed8)";
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.3)";
            },
            onmouseleave: (e) => {
              e.target.style.background =
                "linear-gradient(135deg, #3b82f6, #2563eb)";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            },
          }),
        ]
      ),
    ];
  }

  input(title, message) {
    return new Promise((resolve, reject) => {
      this.callback = resolve;
      this.show(`
      <div style="
        width: 480px;
        padding: 24px;
        background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
        border-radius: 12px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      ">
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #404040;
        ">
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #3b82f6, #2563eb);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">
              ${title}
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">
              Enter the required information
            </p>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 16px;">
          <label style="
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: #e5e5e5;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${message}</label>
          <input 
            id="input" 
            type="text" 
            placeholder="Enter your input here..."
            style="
              width: 100%;
              height: 48px;
              padding: 0 16px;
              border: 1px solid #404040;
              border-radius: 8px;
              background: #1a1a1a;
              color: #ffffff;
              font-size: 14px;
              transition: all 0.2s ease;
              box-sizing: border-box;
            "
            onfocus="this.style.borderColor='#3b82f6'; this.style.background='#252525'; this.style.boxShadow='0 0 0 3px rgba(59, 130, 246, 0.1)'"
            onblur="this.style.borderColor='#404040'; this.style.background='#1a1a1a'; this.style.boxShadow='none'"
            onmouseover="this.style.borderColor='#525252'"
            onmouseout="if(document.activeElement !== this) this.style.borderColor='#404040'"
          >
        </div>
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
            gap: "12px",
            justifyContent: "flex-end",
            width: "100%",
            marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid #404040",
          },
        },
        [
          $el("button", {
            type: "button",
            textContent: "Cancel",
            onclick: () => {
              this.callback?.(false);
              this.close();
            },
            style: {
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1.5px solid #525252",
              background: "transparent",
              color: "#e5e5e5",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "80px",
            },
            onmouseenter: (e) => {
              e.target.style.borderColor = "#6b7280";
              e.target.style.background = "#374151";
            },
            onmouseleave: (e) => {
              e.target.style.borderColor = "#525252";
              e.target.style.background = "transparent";
            },
          }),
          $el("button", {
            type: "button",
            textContent: "Confirm",
            onclick: () => {
              this.callback?.(true);
              this.close();
            },
            style: {
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "80px",
            },
            onmouseenter: (e) => {
              e.target.style.background =
                "linear-gradient(135deg, #d97706, #b45309)";
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 12px rgba(245, 158, 11, 0.3)";
            },
            onmouseleave: (e) => {
              e.target.style.background =
                "linear-gradient(135deg, #f59e0b, #d97706)";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            },
          }),
        ]
      ),
    ];
  }

  confirm(title, message) {
    return new Promise((resolve, reject) => {
      this.callback = resolve;
      this.show(`
      <div style="
        width: 100%;
        max-width: 600px;
        padding: 24px;
        background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
        border-radius: 12px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      ">
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #404040;
        ">
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #ffffff;">
              ${title}
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #999;">
              Please confirm your action
            </p>
          </div>
        </div>
        
        <div style="
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
        ">
          ${message}
        </div>
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
        endpoint: "https://app.comfydeploy.com",
        apiUrl: "https://api.comfydeploy.com",
        apiKey: "",
      };
    else
      return {
        endpoint: "http://localhost:3001",
        apiUrl: "http://localhost:3011",
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
    JSON.stringify(data)
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
            gap: "12px",
            justifyContent: "flex-end",
            width: "100%",
            // marginTop: "24px",
            paddingTop: "20px",
            borderTop: "1px solid #404040",
          },
        },
        [
          $el("button", {
            type: "button",
            textContent: "Close",
            onclick: () => this.close(),
            style: {
              padding: "10px 20px",
              borderRadius: "8px",
              border: "1.5px solid #525252",
              background: "transparent",
              color: "#e5e5e5",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "80px",
            },
            onmouseenter: (e) => {
              e.target.style.borderColor = "#6b7280";
              e.target.style.background = "#374151";
            },
            onmouseleave: (e) => {
              e.target.style.borderColor = "#525252";
              e.target.style.background = "transparent";
            },
          }),
          $el("button", {
            type: "button",
            textContent: "Save",
            onclick: () => {
              this.save();
              this.close();
            },
            style: {
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "linear-gradient(135deg, #0ea5e9, #3b82f6)",
              color: "white",
              fontSize: "14px",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s ease",
              minWidth: "80px",
            },
            onmouseenter: (e) => {
              e.target.style.background =
                "linear-gradient(135deg, #0284c7, #2563eb)";
              e.target.style.transform = "translateY(-1px)";
              e.target.style.boxShadow = "0 4px 12px rgba(14, 165, 233, 0.3)";
            },
            onmouseleave: (e) => {
              e.target.style.background =
                "linear-gradient(135deg, #0ea5e9, #3b82f6)";
              e.target.style.transform = "translateY(0)";
              e.target.style.boxShadow = "none";
            },
          }),
        ]
      ),
    ];
  }

  close() {
    this.element.style.display = "none";
    clearInterval(this.poll);
    clearTimeout(this.timeout);
  }

  async save(api_key, displayName) {
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
      apiUrl: getData(deployOption).apiUrl,
      apiKey,
      displayName,
      environment: deployOption,
    });

    // Refresh workflow list and machine manager after saving configuration
    await refreshWorkflowListIfOpen();
    await refreshMachineManagerIfOpen();
  }

  show() {
    this.container.style.color = "white";

    const data = getData();

    this.container.innerHTML = `
      <div style="
        width: 480px;
        padding: 24px;
        background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
        border-radius: 12px;
        color: #ffffff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
      ">
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid #404040;
        ">
          <div style="
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, #0ea5e9, #3b82f6);
            border-radius: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14,2 14,8 20,8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10,9 9,9 8,9"/>
            </svg>
          </div>
          <div>
            <h3 style="margin: 0; font-size: 20px; font-weight: 600; color: #ffffff;">
              ComfyDeploy Configuration
            </h3>
            <p style="margin: 4px 0 0 0; font-size: 13px; color: #999; font-weight: 400;">
              Configure your deployment settings
            </p>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 20px;">
          <div>
            <label style="
              display: block;
              font-size: 13px;
              font-weight: 600;
              color: #e5e5e5;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">Environment</label>
            <div style="position: relative;">
              <select id="deployOption" style="
                width: 100%;
                height: 48px;
                padding: 0 40px 0 16px;
                border: 1px solid #404040;
                border-radius: 8px;
                background: #1a1a1a;
                color: #ffffff;
                font-size: 14px;
                cursor: pointer;
                appearance: none;
                -webkit-appearance: none;
                -moz-appearance: none;
                transition: all 0.2s ease;
                box-sizing: border-box;
              " onfocus="this.style.borderColor='#0ea5e9'; this.style.background='#252525'; this.style.boxShadow='0 0 0 3px rgba(14, 165, 233, 0.1)'" onblur="this.style.borderColor='#404040'; this.style.background='#1a1a1a'; this.style.boxShadow='none'" onmouseover="this.style.borderColor='#525252'" onmouseout="if(document.activeElement !== this) this.style.borderColor='#404040'">
                <option value="cloud" ${
                  data.environment === "cloud" ? "selected" : ""
                }>☁️ Cloud Deployment</option>
                <option value="local" ${
                  data.environment === "local" ? "selected" : ""
                }>🏠 Local Development</option>
              </select>
              <div style="
                position: absolute;
                right: 16px;
                top: 50%;
                transform: translateY(-50%);
                pointer-events: none;
                color: #999;
              ">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="6,9 12,15 18,9"></polyline>
                </svg>
              </div>
            </div>
          </div>
          
          <div>
            <label style="
              display: block;
              font-size: 13px;
              font-weight: 600;
              color: #e5e5e5;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            ">Endpoint URL</label>
            <input 
              id="endpoint" 
              type="text" 
              value="${data.endpoint}"
              placeholder="https://api.comfydeploy.com"
              style="
                width: 100%;
                height: 48px;
                padding: 0 16px;
                border: 1px solid #404040;
                border-radius: 8px;
                background: #1a1a1a;
                color: #ffffff;
                font-size: 14px;
                transition: all 0.2s ease;
                box-sizing: border-box;
              "
              onfocus="this.style.borderColor='#0ea5e9'; this.style.background='#252525'; this.style.boxShadow='0 0 0 3px rgba(14, 165, 233, 0.1)'"
              onblur="this.style.borderColor='#404040'; this.style.background='#1a1a1a'; this.style.boxShadow='none'"
              onmouseover="this.style.borderColor='#525252'"
              onmouseout="if(document.activeElement !== this) this.style.borderColor='#404040'"
            >
          </div>
          
          <div>
            <div style="
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-bottom: 8px;
            ">
              <label style="
                font-size: 13px;
                font-weight: 600;
                color: #e5e5e5;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              ">API Key</label>
              ${
                data.displayName
                  ? `
                <div style="
                  background: linear-gradient(135deg, #0ea5e9, #3b82f6);
                  color: white;
                  padding: 4px 10px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: 600;
                  display: flex;
                  align-items: center;
                  gap: 4px;
                ">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  ${data.displayName}
                </div>
              `
                  : ""
              }
            </div>
            <input 
              id="apiKey" 
              type="password" 
              value="${data.apiKey}"
              placeholder="Enter your API key"
              style="
                width: 100%;
                height: 48px;
                padding: 0 16px;
                border: 1px solid #404040;
                border-radius: 8px;
                background: #1a1a1a;
                color: #ffffff;
                font-size: 14px;
                transition: all 0.2s ease;
                box-sizing: border-box;
                margin-bottom: 12px;
              "
              onfocus="this.style.borderColor='#0ea5e9'; this.style.background='#252525'; this.style.boxShadow='0 0 0 3px rgba(14, 165, 233, 0.1)'"
              onblur="this.style.borderColor='#404040'; this.style.background='#1a1a1a'; this.style.boxShadow='none'"
              onmouseover="this.style.borderColor='#525252'"
              onmouseout="if(document.activeElement !== this) this.style.borderColor='#404040'"
            >
            <button id="loginButton" style="
              width: 100%;
              height: 48px;
              background: linear-gradient(135deg, #0ea5e9, #3b82f6);
              color: white;
              border: none;
              border-radius: 8px;
              font-size: 14px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s ease;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 8px;
            " onmouseover="this.style.background='linear-gradient(135deg, #0284c7, #2563eb)'; this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(14, 165, 233, 0.3)'" onmouseout="this.style.background='linear-gradient(135deg, #0ea5e9, #3b82f6)'; this.style.transform='translateY(0)'; this.style.boxShadow='none'" onmousedown="this.style.transform='translateY(0)'" onmouseup="this.style.transform='translateY(-1px)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
                <polyline points="10,17 15,12 10,7"/>
                <line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
              ${
                data.apiKey
                  ? "Re-authenticate with ComfyDeploy"
                  : "Login with ComfyDeploy"
              }
            </button>
          </div>
        </div>
      </div>
    `;

    const button = this.container.querySelector("#loginButton");
    button.onclick = () => {
      this.save();
      const data = getData();

      const uuid = crypto.randomUUID();
      window.open(data.endpoint + "/auth/request/" + uuid, "_blank");

      this.timeout = setTimeout(() => {
        clearInterval(this.poll);
        infoDialog.showError(
          "Timeout",
          "Wait too long for the response, please try re-login"
        );
      }, 30000); // Stop polling after 30 seconds

      this.poll = setInterval(() => {
        fetch(
          `/comfyui-deploy/auth-response?request_id=${uuid}&api_url=${encodeURIComponent(
            data.apiUrl
          )}`
        )
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
                `<div>You will be able to upload workflow to <button style="font-size: 18px; width: fit;">${json.name}</button></div>`
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
const referrer = document.referrer;

const isComfyDeployDashboard =
  currentOrigin.includes("comfydeploy.com") ||
  (referrer && referrer.includes("comfydeploy.com"));

if (!isComfyDeployDashboard) {
  app.extensionManager.registerSidebarTab({
    id: "search",
    icon: "pi pi-cloud-upload",
    title: "Deploy",
    tooltip: "Deploy and Configure",
    type: "custom",
    render: async (el) => {
      el.innerHTML = `
        <div style="padding: 20px;">
          <h3>Comfy Deploy</h3>
          <div id="deploy-container" style="margin-bottom: 20px;"></div>
          <div id="machine-container" style="margin-bottom: 20px;">
            <div style="
              display: flex;
              border-bottom: 1px solid #333;
              margin-bottom: 16px;
              position: relative;
            ">
              <button 
                id="machine-tab" 
                onclick="switchTab('machine')" 
                style="
                  background: transparent;
                  color: white;
                  border: none;
                  padding: 12px 16px 8px 16px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  position: relative;
                  transition: all 0.2s ease;
                  border-bottom: 2px solid #3498db;
                "
                onmouseover="this.style.color='#fff'"
                onmouseout="if(this.style.borderBottomColor !== 'rgb(52, 152, 219)') this.style.color='#999'"
              >
                Machine
              </button>
              <button 
                id="model-tab" 
                onclick="switchTab('model')" 
                style="
                  background: transparent;
                  color: #999;
                  border: none;
                  padding: 12px 16px 8px 16px;
                  font-size: 13px;
                  font-weight: 600;
                  cursor: pointer;
                  position: relative;
                  transition: all 0.2s ease;
                  border-bottom: 2px solid transparent;
                "
                onmouseover="this.style.color='#fff'"
                onmouseout="if(this.style.borderBottomColor !== 'rgb(52, 152, 219)') this.style.color='#999'"
              >
                Model
              </button>
            </div>
            
            <div id="machine-tab-content">
              <div id="machine-loading" style="display: flex; justify-content: center; align-items: center; height: 100px;">
                ${loadingIcon}
              </div>
              <ul id="machine-list" style="list-style-type: none; padding: 0; display: none;"></ul>
            </div>
            
            <div id="model-tab-content" style="display: none;">
              <div id="model-loading" style="display: flex; justify-content: center; align-items: center; height: 100px;">
                ${loadingIcon}
              </div>
              <ul id="model-list" style="list-style-type: none; padding: 0; display: none;"></ul>
            </div>
          </div>
          <div id="workflows-container" style="display: none;">
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
        // refreshWorkflowsList(el);
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

      // Initialize machine and model managers
      const data = getData();
      if (data.apiKey) {
        await initializeMachineManager(el, getData);
        await initializeModelManager(el, getData);

        // Add tab switching functionality
        window.switchTab = function (tabName) {
          const machineTab = el.querySelector("#machine-tab");
          const modelTab = el.querySelector("#model-tab");
          const machineContent = el.querySelector("#machine-tab-content");
          const modelContent = el.querySelector("#model-tab-content");

          if (tabName === "machine") {
            // Active machine tab
            machineTab.style.color = "white";
            machineTab.style.borderBottomColor = "#3498db";
            // Inactive model tab
            modelTab.style.color = "#999";
            modelTab.style.borderBottomColor = "transparent";
            // Show/hide content
            machineContent.style.display = "block";
            modelContent.style.display = "none";
          } else if (tabName === "model") {
            // Active model tab
            modelTab.style.color = "white";
            modelTab.style.borderBottomColor = "#3498db";
            // Inactive machine tab
            machineTab.style.color = "#999";
            machineTab.style.borderBottomColor = "transparent";
            // Show/hide content
            modelContent.style.display = "block";
            machineContent.style.display = "none";
          }
        };
      } else {
        // Hide machine container when no API key
        const machineContainer = el.querySelector("#machine-container");
        if (machineContainer) {
          machineContainer.style.display = "none";
        }
      }

      // Initialize workflows list and search
      if (data.apiKey) {
        addWorkflowSearch(el, getData, getTimeAgo);
        await initializeWorkflowsList(el, getData, getTimeAgo);
      }
    },
  });
}

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

// async function loadWorkflowApi(versionId) {
//   try {
//     const response = await client.comfyui.getWorkflowVersionVersionId({
//       versionId: versionId,
//     });
//     // Implement the logic to load the workflow API into the ComfyUI interface
//     console.log("Workflow API loaded:", response);
//     await window["app"].ui.settings.setSettingValueAsync(
//       "Comfy.Validation.Workflows",
//       true,
//     );
//     app.loadGraphData(response.workflow);
//     // You might want to update the UI or trigger some action in ComfyUI here
//   } catch (error) {
//     console.error("Error loading workflow API:", error);
//     // Show an error message to the user
//   }
// }

const orginal_fetch_api = api.fetchApi;
api.fetchApi = async (route, options) => {
  // console.log("Fetch API called with args:", route, options, ext.native_mode);

  if (ext.native_mode) {
    if (route.startsWith("/prompt")) {
      const info = await getSelectedWorkflowInfo();

      if (!info.workflow_id) {
        console.log("No workflow id found, fallback to original fetch");
        return await orginal_fetch_api.call(api, route, options);
      }

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
          gpu: info.gpu,
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
    } else if (route.startsWith("/interrupt")) {
      const info = await getSelectedWorkflowInfo();

      if (!info.workflow_id) {
        console.log("No workflow id found, fallback to original fetch");
        return await orginal_fetch_api.call(api, route, options);
      }
      const body = JSON.parse(options.body);
      const data = {
        prompt_id: body.prompt_id,
      };
      const original_response = await orginal_fetch_api.call(
        api,
        route,
        options
      );
      await fetch("/comfyui-deploy/interrupt", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${info.cd_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      return original_response;
    }
  }

  return await orginal_fetch_api.call(api, route, options);
};

// Intercept window drag and drop events
const originalDropHandler = document.ondrop;
document.ondrop = async (e) => {
  console.log("Drop event intercepted:", e);

  // Prevent default browser behavior
  e.preventDefault();

  // Handle files if present
  if (e.dataTransfer?.files?.length > 0) {
    const files = Array.from(e.dataTransfer.files);

    // Send file data to parent directly as JSON
    sendDirectEventToCD("file_drop", {
      files: files,
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now(),
    });
  }

  // Call original handler if exists
  if (originalDropHandler) {
    originalDropHandler(e);
  }
};

const originalDragEnterHandler = document.ondragenter;
document.ondragenter = (e) => {
  // Prevent default to allow drop
  e.preventDefault();

  // Send dragenter event to parent directly as JSON
  sendDirectEventToCD("file_dragenter", {
    x: e.clientX,
    y: e.clientY,
    timestamp: Date.now(),
  });

  if (originalDragEnterHandler) {
    originalDragEnterHandler(e);
  }
};

const originalDragLeaveHandler = document.ondragleave;
document.ondragleave = (e) => {
  // Prevent default to allow drop
  e.preventDefault();

  // Send dragleave event to parent directly as JSON
  sendDirectEventToCD("file_dragleave", {
    x: e.clientX,
    y: e.clientY,
    timestamp: Date.now(),
  });

  if (originalDragLeaveHandler) {
    originalDragLeaveHandler(e);
  }
};

const originalDragOverHandler = document.ondragover;
document.ondragover = (e) => {
  // Prevent default to allow drop
  e.preventDefault();

  // Send dragover event to parent directly as JSON
  sendDirectEventToCD("file_dragover", {
    x: e.clientX,
    y: e.clientY,
    timestamp: Date.now(),
  });

  if (originalDragOverHandler) {
    originalDragOverHandler(e);
  }
};

// Function to create a single button
function createQueueButton(config) {
  const button = document.createElement("button");
  button.id = `cd-button-${config.id}`;
  button.className =
    "p-button p-component p-button-icon-only p-button-secondary p-button-text";
  button.innerHTML = `
    <span class="p-button-icon pi ${config.icon}"></span>
    <span class="p-button-label">&nbsp;</span>
  `;
  button.onclick = () => {
    const eventData =
      typeof config.eventData === "function"
        ? config.eventData()
        : config.eventData || {};
    sendEventToCD(config.event, eventData);
  };
  button.setAttribute("data-pd-tooltip", config.tooltip);
  return button;
}

// Function to add buttons to queue group
function addQueueButtons(buttonConfigs = DEFAULT_BUTTONS) {
  const queueButtonGroup = document.querySelector(".queue-button-group.flex");
  if (!queueButtonGroup) return;

  // Remove any existing CD buttons
  const existingButtons =
    queueButtonGroup.querySelectorAll('[id^="cd-button-"]');
  existingButtons.forEach((button) => button.remove());

  // Add new buttons
  buttonConfigs.forEach((config) => {
    const button = createQueueButton(config);
    queueButtonGroup.appendChild(button);
  });
}

// addMenuRightButtons([
//   {
//     id: "cd-button-save-image",
//     icon: "pi-save",
//     label: "Snapshot",
//     tooltip: "Save the current image to your output directory.",
//     event: "save_image",
//     eventData: () => ({}),
//   },
// ]);

// addMenuLeftButtons([
//   {
//     id: "cd-button-back",
//     icon: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
//       <path d="M15 18L9 12L15 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
//     </svg>`,
//     tooltip: "Go back to the previous page.",
//     event: "back",
//     eventData: () => ({}),
//   },
// ]);

// addMenuButtons({
//   containerSelector: "body > div.comfyui-body-top > div",
//   buttonConfigs: [
//     {
//       id: "cd-button-workflow-1",
//       icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16 3l4 4l-4 4m-6-4h10M8 13l-4 4l4 4m-4-4h9"/></svg>`,
//       label: "Workflow",
//       tooltip: "Go to Workflow 1",
//       event: "workflow_1",
//       // btnClasses: "",
//       eventData: () => ({}),
//     },
//     {
//       id: "cd-button-workflow-3",
//       // icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m16 3l4 4l-4 4m-6-4h10M8 13l-4 4l4 4m-4-4h9"/></svg>`,
//       label: "v1",
//       tooltip: "Go to Workflow 1",
//       event: "workflow_1",
//       // btnClasses: "",
//       eventData: () => ({}),
//     },
//     {
//       id: "cd-button-workflow-2",
//       icon: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M12 3v6"/><circle cx="12" cy="12" r="3"/><path d="M12 15v6"/></g></svg>`,
//       label: "Commit",
//       tooltip: "Commit the current workflow",
//       event: "commit",
//       style: {
//         backgroundColor: "oklch(.476 .114 61.907)",
//       },
//       eventData: () => ({}),
//     },
//   ],
//   buttonIdPrefix: "cd-button-workflow-",
//   insertBefore:
//     "body > div.comfyui-body-top > div > div.flex-grow.min-w-0.app-drag.h-full",
//   // containerStyle: { order: "3" }
// });

// addMenuButtons({
//   containerSelector:
//     "body > div.comfyui-body-top > div > div.flex-grow.min-w-0.app-drag.h-full",
//   clearContainer: true,
//   buttonConfigs: [],
//   buttonIdPrefix: "cd-button-p-",
//   containerStyle: { order: "-1" },
// });

// Function to add buttons to a menu container
function addMenuButtons(options) {
  const {
    containerSelector,
    buttonConfigs,
    buttonIdPrefix = "cd-button-",
    containerClass = "comfyui-button-group",
    containerStyle = {},
    clearContainer = false,
    insertBefore = null, // New option to specify selector for insertion point
  } = options;

  const menuContainer = document.querySelector(containerSelector);

  if (!menuContainer) return;

  // Remove any existing CD buttons
  const existingButtons = document.querySelectorAll(
    `[id^="${buttonIdPrefix}"]`
  );
  existingButtons.forEach((button) => button.remove());

  const container = document.createElement("div");
  container.className = containerClass;

  // Apply container styles
  Object.assign(container.style, containerStyle);

  // Clear existing content if specified
  if (clearContainer) {
    menuContainer.innerHTML = "";
  }

  // Create and add buttons
  buttonConfigs.forEach((config) => {
    const button = createMenuButton({
      ...config,
      idPrefix: buttonIdPrefix,
    });
    container.appendChild(button);
  });

  // Insert before specified element if provided, otherwise append
  if (insertBefore) {
    const targetElement = menuContainer.querySelector(insertBefore);
    if (targetElement) {
      menuContainer.insertBefore(container, targetElement);
    } else {
      menuContainer.appendChild(container);
    }
  } else {
    menuContainer.appendChild(container);
  }
}

function createMenuButton(config) {
  const {
    id,
    icon,
    label,
    btnClasses = "",
    tooltip,
    event,
    eventData,
    idPrefix,
    style = {},
  } = config;

  const button = document.createElement("button");
  button.id = `${idPrefix}${id}`;
  button.className = `comfyui-button ${btnClasses}`;
  Object.assign(button.style, style);

  // Only add icon if provided
  const iconHtml = icon
    ? icon.startsWith("<svg")
      ? icon
      : `<span class="p-button-icon pi ${icon}"></span>`
    : "";

  button.innerHTML = `
    ${iconHtml}
    ${label ? `<span class="p-button-label text-sm">${label}</span>` : ""}
  `;

  button.onclick = () => {
    const data =
      typeof eventData === "function" ? eventData() : eventData || {};
    sendEventToCD(event, data);
  };

  if (tooltip) {
    button.setAttribute("data-pd-tooltip", tooltip);
  }
  return button;
}

// Refactored menu button functions
function addMenuLeftButtons(buttonConfigs) {
  addMenuButtons({
    containerSelector: "body > div.comfyui-body-top > div",
    buttonConfigs,
    buttonIdPrefix: "cd-button-left-",
    containerStyle: { order: "-1" },
  });
}

function addMenuRightButtons(buttonConfigs) {
  addMenuButtons({
    containerSelector: ".comfyui-menu-right .flex",
    buttonConfigs,
    buttonIdPrefix: "cd-button-",
    containerStyle: {},
  });
}

// Function to refresh workflow list if sidebar is open
async function refreshWorkflowListIfOpen() {
  try {
    const workflowsContainer = document.querySelector("#workflows-container");
    const workflowsList = document.querySelector("#workflows-list");

    // Only refresh if workflows container is visible and has been initialized
    if (!workflowsContainer || !workflowsList) {
      return;
    }

    // Import the functions we need
    const { initializeWorkflowsList } = await import("./workflow-list.js");

    // Clear existing workflows and reset state safely
    workflowsList.innerHTML = "";
    if (window.workflowsState) {
      window.workflowsState.initialized = false;
      window.workflowsState.workflows = [];
      window.workflowsState.offset = 0;
      window.workflowsState.hasMore = true;
    }
    // Reinitialize the workflow list
    await initializeWorkflowsList(document, getData, getTimeAgo);

    // Also refresh the current workflow card
    refreshCurrentWorkflowCard();

    console.log("Workflow list refreshed successfully");
  } catch (error) {
    console.error("Error refreshing workflow list:", error);
  }
}

// Function to refresh machine manager if sidebar is open
async function refreshMachineManagerIfOpen() {
  try {
    const machineContainer = document.querySelector("#machine-container");

    // Only refresh if machine container exists
    if (!machineContainer) {
      return;
    }

    const data = getData();

    if (data.apiKey) {
      // Show machine container if it was hidden
      machineContainer.style.display = "block";

      // Find the parent element that contains the machine elements
      let element = document.querySelector(".comfy-menu");
      if (!element || !element.querySelector("#machine-container")) {
        element = machineContainer.parentElement;
      }

      // Import and reinitialize machine manager
      const { initializeMachineManager } = await import("./machine-manager.js");
      await initializeMachineManager(element, getData);

      console.log("Machine manager refreshed successfully");
    } else {
      // Hide machine container when no API key
      machineContainer.style.display = "none";
    }
  } catch (error) {
    console.error("Error refreshing machine manager:", error);
  }
}
