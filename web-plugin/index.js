import { app } from "./app.js";
import { api } from "./api.js";
import { ComfyWidgets, LGraphNode } from "./widgets.js";
import { generateDependencyGraph } from "https://esm.sh/comfyui-json@0.1.8";

/** @typedef {import('../../../web/types/comfy.js').ComfyExtension} ComfyExtension*/
/** @type {ComfyExtension} */
const ext = {
  name: "BennyKok.ComfyUIDeploy",

  init(app) {
    addButton();

    const queryParams = new URLSearchParams(window.location.search);
    const workflow_version_id = queryParams.get("workflow_version_id");
    const auth_token = queryParams.get("auth_token");
    const org_display = queryParams.get("org_display");
    const origin = queryParams.get("origin");

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

          // Adding a delay to wait for the intial graph to load
          await new Promise((resolve) => setTimeout(resolve, 2000));

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
    class ComfyDeploy {
      color = LGraphCanvas.node_colors.yellow.color;
      bgcolor = LGraphCanvas.node_colors.yellow.bgcolor;
      groupcolor = LGraphCanvas.node_colors.yellow.groupcolor;
      constructor() {
        if (!this.properties) {
          this.properties = {};
          this.properties.workflow_name = "";
          this.properties.workflow_id = "";
          this.properties.version = "";
        }

        ComfyWidgets.STRING(
          this,
          "workflow_name",
          ["", { default: this.properties.workflow_name, multiline: false }],
          app,
        );

        ComfyWidgets.STRING(
          this,
          "workflow_id",
          ["", { default: this.properties.workflow_id, multiline: false }],
          app,
        );

        ComfyWidgets.STRING(
          this,
          "version",
          ["", { default: this.properties.version, multiline: false }],
          app,
        );

        // this.widgets.forEach((w) => {
        //   // w.computeSize = () => [200,10]
        //   w.computedHeight = 2;
        // })

        this.widgets_start_y = 10;
        this.setSize(this.computeSize());

        // const config = {  };

        // console.log(this);
        this.serialize_widgets = true;
        this.isVirtualNode = true;
      }
    }

    // Load default visibility

    LiteGraph.registerNodeType(
      "ComfyDeploy",
      Object.assign(ComfyDeploy, {
        title_mode: LiteGraph.NORMAL_TITLE,
        title: "Comfy Deploy",
        collapsable: true,
      }),
    );

    ComfyDeploy.category = "deploy";
  },

  async setup() {
    // const graphCanvas = document.getElementById("graph-canvas");

    window.addEventListener("message", (event) => {
      if (!event.data.flow || Object.entries(event.data.flow).length <= 0)
        return;
      //   updateBlendshapesPrompts(event.data.flow);
    });

    api.addEventListener("executed", (evt) => {
      const images = evt.detail?.output.images;
      //   if (images?.length > 0 && images[0].type === "output") {
      //     generatedImages[evt.detail.node] = images[0].filename;
      //   }
      //   if (evt.detail?.output.gltfFilename) {

      //   }
    });
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
    '<div style="max-width: 1024px; margin: 14px auto; display: flex; flex-direction: column; gap: 24px;">';
  const bgcolor = "var(--comfy-input-bg)";
  const textColor = "var(--input-text)";

  // Custom Nodes
  html += `<div style="background-color: ${bgcolor}; padding: 24px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);">`;
  html +=
    '<h2 style="margin-top: 0px; font-size: 24px; font-weight: bold; margin-bottom: 16px;">Custom Nodes</h2>';
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

function addButton() {
  const menu = document.querySelector(".comfy-menu");

  const deploy = document.createElement("button");
  deploy.style.position = "relative";
  deploy.style.display = "block";
  deploy.innerHTML = "<div id='button-title'>Deploy</div>";
  deploy.onclick = async () => {
    /** @type {LGraph} */
    const graph = app.graph;

    let { endpoint, apiKey, displayName } = getData();

    if (!endpoint || !apiKey || apiKey === "" || endpoint === "") {
      configDialog.show();
      return;
    }

    const ok = await confirmDialog.confirm(
      "Confirm deployment -> " + displayName,
      `A new version will be deployed, are you conform? <br><br><input id="include-deps" type="checkbox" checked>Include dependence</input>`,
    );
    if (!ok) return;

    const includeDeps = document.getElementById("include-deps").checked;

    if (endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }
    loadingDialog.showLoading("Generating snapshot", "Please wait...");

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

    const prompt = await app.graphToPrompt();
    let deps = undefined;

    if (includeDeps) {
      loadingDialog.showLoading("Fetching existing version", "Please wait...");

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

      loadingDialog.showLoading(
        "Generating dependency graph",
        "Please wait...",
      );
      deps = await generateDependencyGraph(
        prompt.output,
        snapshot,
        async (file) => {
          console.log(file);
          loadingDialog.showLoading("Generating hash", file);
          const hash = await fetch(
            `/comfyui-deploy/get-file-hash?file_path=${encodeURIComponent(
              file,
            )}`,
          ).then((x) => x.json());
          loadingDialog.showLoading("Generating hash", file);
          console.log(hash);
          return hash.file_hash;
        },
        async (file, hash, prevhash) => {
          console.log("Uploading ", file);
          loadingDialog.showLoading("Uploading file", file);
          try {
            const { download_url } = await fetch(
              `/comfyui-deploy/upload-file`,
              {
                method: "POST",
                body: JSON.stringify({
                  file_path: file,
                  token: apiKey,
                  url: endpoint + "/api/upload-url",
                }),
              },
            )
              .then((x) => x.json())
              .catch(() => {
                loadingDialog.close();
                confirmDialog.confirm("Error", "Unable to upload file " + file);
              });
            loadingDialog.showLoading("Uploaded file", file);
            console.log(download_url);
            return download_url;
          } catch (error) {
            return undefined;
          }
        },
        existing_workflow.dependencies,
      );

      loadingDialog.close();

      const depsOk = await confirmDialog.confirm(
        "Check dependencies",
        // JSON.stringify(deps, null, 2),
        createDynamicUIHtml(deps),
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

  loadingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24"><g fill="none" stroke="#888888" stroke-linecap="round" stroke-width="2"><path stroke-dasharray="60" stroke-dashoffset="60" stroke-opacity=".3" d="M12 3C16.9706 3 21 7.02944 21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3Z"><animate fill="freeze" attributeName="stroke-dashoffset" dur="1.3s" values="60;0"/></path><path stroke-dasharray="15" stroke-dashoffset="15" d="M12 3C16.9706 3 21 7.02944 21 12"><animate fill="freeze" attributeName="stroke-dashoffset" dur="0.3s" values="15;0"/><animateTransform attributeName="transform" dur="1.5s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/></path></g></svg>`;

  showLoading(title, message) {
    this.show(`
      <div style="width: 400px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px; display: flex; align-items: center; justify-content: center;">${title} ${this.loadingIcon}</h3>
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
          ${message ? `<label>${message}</label>` : ""}
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
      <div style="width: 100%; max-width: 600px; display: flex; gap: 18px; flex-direction: column; overflow: unset">
        <h3 style="margin: 0px;">${title}</h3>
        <label>
          ${message}
        </label>
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
          onclick: () => this.save(),
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
            onclick: () => this.save(),
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
    if (!displayName) displayName = getData().displayName;

    const deployOption = this.container.querySelector("#deployOption").value;
    localStorage.setItem("comfy_deploy_env", deployOption);

    const endpoint = this.container.querySelector("#endpoint").value;
    const apiKey = api_key ?? this.container.querySelector("#apiKey").value;
    saveData({
      endpoint,
      apiKey,
      displayName,
      environment: deployOption,
    });
    this.close();
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
      <label style="color: white;">
        API Key: ${data.displayName ?? ""}
        <input id="apiKey" style="margin-top: 8px; width: 100%; height:40px; box-sizing: border-box; padding: 0px 6px;" type="password" value="${
          data.apiKey
        }">
        <button id="loginButton" style="margin-top: 8px; width: 100%; height:40px; box-sizing: border-box; padding: 0px 6px;">
          ${
            data.apiKey ? "Re-login with ComfyDeploy" : "Login with ComfyDeploy"
          }
        </button>
      </label>
      </div>
    `;

    const button = this.container.querySelector("#loginButton");
    button.onclick = () => {
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
          .then((json) => {
            if (json.api_key) {
              this.save(json.api_key, json.name);
              this.container.querySelector("#apiKey").value = json.api_key;
              infoDialog.show();
              clearInterval(this.poll);
              clearTimeout(this.timeout);
              infoDialog.showMessage(
                "Authenticated",
                "You will be able to upload workflow to " + json.name,
              );
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
