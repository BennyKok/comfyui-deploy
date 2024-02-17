import { insertMachineSchema, machinesTable } from "@/db/schema";
import { createInsertSchema } from "drizzle-zod";

export const addMachineSchema = insertMachineSchema.pick({
  name: true,
  endpoint: true,
  type: true,
  auth_token: true,
});

export const insertCustomMachineSchema = createInsertSchema(machinesTable, {
  name: (schema) => schema.name.default("My Machine"),
  type: (schema) => schema.type.default("comfy-deploy-serverless"),
  gpu: (schema) => schema.gpu.default("T4"),
  snapshot: (schema) =>
    schema.snapshot.default({
      comfyui: "d0165d819afe76bd4e6bdd710eb5f3e571b6a804",
      git_custom_nodes: {
        "https://github.com/BennyKok/comfyui-deploy.git": {
          hash: "43fe0a384aa5fa9e141d4a264b2ed40a73b817bc",
          disabled: false,
        },
      },
      file_custom_nodes: [],
    }),
  models: (schema) =>
    schema.models.default([
      {
        name: "v1-5-pruned-emaonly.ckpt",
        type: "checkpoints",
        base: "SD1.5",
        save_path: "default",
        description: "Stable Diffusion 1.5 base model",
        reference: "https://huggingface.co/runwayml/stable-diffusion-v1-5",
        filename: "v1-5-pruned-emaonly.ckpt",
        url: "https://huggingface.co/runwayml/stable-diffusion-v1-5/resolve/main/v1-5-pruned-emaonly.ckpt",
      },
    ]),
});

export const addCustomMachineSchema = insertCustomMachineSchema.pick({
  name: true,
  type: true,
  snapshot: true,
  models: true,
  gpu: true,
});
