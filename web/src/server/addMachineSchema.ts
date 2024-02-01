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
        "https://github.com/bennykok/comfyui-deploy": {
          hash: "a838cb7ad425e5652c3931fbafdc886b53c48a22",
          disabled: false,
        },
      },
      file_custom_nodes: [],
    }),
  models: (schema) => schema.models.default([]),
});

export const addCustomMachineSchema = insertCustomMachineSchema.pick({
  name: true,
  type: true,
  snapshot: true,
  models: true,
  gpu: true,
});
