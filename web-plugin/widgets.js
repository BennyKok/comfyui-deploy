// /** @typedef {import('../../../web/scripts/api.js').api} API*/
// import { api as _api } from "../../scripts/api.js";
// /** @type {API} */
// export const api = _api;

/** @typedef {typeof import('../../../web/scripts/widgets.js').ComfyWidgets} Widgets*/
import { ComfyWidgets as _ComfyWidgets } from "../../scripts/widgets.js";

/**
 * @type {Widgets}
 */
export const ComfyWidgets = _ComfyWidgets;

// import { LGraphNode as _LGraphNode } from "../../types/litegraph.js";

/** @typedef {typeof import('../../../web/types/litegraph.js').LGraphNode} LGraphNode*/
/** @type {LGraphNode}*/
export const LGraphNode = LiteGraph.LGraphNode;
