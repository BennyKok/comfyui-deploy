import { app } from "./app.js";
import { api } from "./api.js";
import { ComfyWidgets, LGraphNode } from "./widgets.js";

/** @typedef {import('../../../web/types/comfy.js').ComfyExtension} ComfyExtension*/
/** @type {ComfyExtension} */
const ext = {
  name: "BennyKok.ComfyUIDeploy",

  init(app) {
    addButton();
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

function addButton() {
  const menu = document.querySelector(".comfy-menu");

  const deploy = document.createElement("button");
  deploy.style.position = "relative";
  deploy.style.display = "block";
  deploy.innerHTML = "<div id='button-title'>Deploy</div>";
  deploy.onclick = async () => {
    /** @type {LGraph} */
    const graph = app.graph;

    const title = deploy.querySelector("#button-title")

    const deployMeta = graph.findNodesByType("ComfyDeploy");
    const deployMetaNode = deployMeta[0];

    console.log(deployMetaNode);

    const workflow_name = deployMetaNode.widgets[0].value;
    const workflow_id = deployMetaNode.widgets[1].value;

    console.log(workflow_name, workflow_id);

    const prompt = await app.graphToPrompt();
    console.log(graph);
    console.log(prompt);

    // const endpoint = localStorage.getItem("endpoint") ?? "";
    // const apiKey = localStorage.getItem("apiKey");

    const {
      endpoint,
      apiKey,
    } = getData();

    if (!endpoint || !apiKey || apiKey === "" || endpoint === "") {
      configDialog.show();
      return;
    }

    title.innerText = "Deploying...";
    title.style.color = "orange";

    console.log(prompt);

    // TODO trim the ending / from endpoint is there is
    if (endpoint.endsWith("/")) {
      endpoint = endpoint.slice(0, -1);
    }

    const apiRoute = endpoint + "/api/upload"
    // const userId = apiKey
    try {
      let data = await fetch(apiRoute, {
        method: "POST",
        body: JSON.stringify({
          workflow_name,
          workflow_id,
          workflow: prompt.workflow,
          workflow_api: prompt.output,
        }),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey,
        },
      });

      console.log(data);

      if (data.status !== 200) {
        throw new Error(await data.text());
      } else {
        data = await data.json();
      }

      title.textContent = "Done";
      title.style.color = "green";

      deployMetaNode.widgets[1].value = data.workflow_id;
      deployMetaNode.widgets[2].value = data.version;
      graph.change();

      infoDialog.show(
        `<span style="color:green;">Deployed successfully!</span> <br/> <br/> Workflow ID: ${data.workflow_id} <br/> Workflow Name: ${workflow_name} <br/> Workflow Version: ${data.version}`,
      );

      setTimeout(() => {
        title.textContent = "Deploy";
        title.style.color = "white";
      }, 1000);
    } catch (e) {
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
  config.src = "https://api.iconify.design/material-symbols-light:settings.svg?color=%23888888";
  config.onclick = (e) => {
    e.preventDefault()
    e.stopPropagation()
    configDialog.show();
  };

  deploy.append(
    config
  )

  deploy.style.order = "99";

  menu.append(deploy);
}

app.registerExtension(ext);


import { ComfyDialog, $el } from '../../scripts/ui.js';

export class InfoDialog extends ComfyDialog {
	constructor() {
		super();
		this.element.classList.add("comfy-normal-modal");
	}
	createButtons() {
		return [
			$el("button", {
				type: "button",
				textContent: "Close",
				onclick: () => this.close(),
			}),
		];
	}

	close() {
		this.element.style.display = "none";
	}

	show(html) {
    this.textElement.style.color = "white";
		if (typeof html === "string") {
			this.textElement.innerHTML = html;
		} else {
			this.textElement.replaceChildren(html);
		}
		this.element.style.display = "flex";
		this.element.style.zIndex = 1001;
	}
}

export const infoDialog = new InfoDialog()

function getData(environment) {
  const deployOption = environment || localStorage.getItem("comfy_deploy_env") || "cloud";
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

export class ConfigDialog extends ComfyDialog {

  container = null;

  constructor() {
    super();
    this.element.classList.add("comfy-normal-modal");

    this.container = document.createElement("div");
    this.element.querySelector(".comfy-modal-content").prepend(this.container);
  }

  createButtons() {
    return [
      $el("div", {
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
            textContent: "Save",
            onclick: () => this.save(),
          }),
          $el("button", {
            type: "button",
            textContent: "Close",
            onclick: () => this.close(),
          })
        ]
      ),
    ];
  }

  close() {
    this.element.style.display = "none";
  }

  save() {
    const deployOption = this.container.querySelector("#deployOption").value;
    localStorage.setItem("comfy_deploy_env", deployOption);

    const endpoint = this.container.querySelector("#endpoint").value;
    const apiKey = this.container.querySelector("#apiKey").value;
    const data = {
      endpoint,
      apiKey,
    }
    localStorage.setItem("comfy_deploy_env_data_" + deployOption, JSON.stringify(data));
    this.close();
  }

  show() {
    this.container.style.color = "white";

    const data = getData();
    
    this.container.innerHTML = `
    <div style="width: 400px; display: flex; gap: 18px; flex-direction: column;">
    <h3 style="margin: 0px;">Comfy Deploy Config</h3>
    <label style="color: white; width: 100%;">
      <select id="deployOption" style="margin-top: 8px; width: 100%; height:30px;" >
        <option value="cloud" ${data.environment === 'cloud' ? 'selected' : ''}>Cloud</option>
        <option value="local" ${data.environment === 'local' ? 'selected' : ''}>Local</option>
      </select>
    </label>
      <label style="color: white; width: 100%;">
        Endpoint:
        <input id="endpoint" style="margin-top: 8px; width: 100%; height:30px;" type="text" value="${data.endpoint}">
      </label>
      <label style="color: white;">
        API Key:
        <input id="apiKey" style="margin-top: 8px; width: 100%; height:30px;" type="password" value="${data.apiKey}">
      </label>
      </div>
    `;

    const apiKeyInput = this.container.querySelector("#apiKey");
    apiKeyInput.addEventListener("paste", function(e) {
      e.stopPropagation();
    });

    const deployOption = this.container.querySelector("#deployOption");
    const container = this.container
    deployOption.addEventListener("change", function() {
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