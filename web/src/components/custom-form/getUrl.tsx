"use client";
import { z } from "zod";
import {
  CivitalModelSchema,
  ModelListWrapper,
  Model,
} from "./CivitalModelSchema";

function mapType(type: string) {
  switch (type) {
    case "checkpoint":
      return "checkpoints";
  }
  return type;
}
export function mapModelsList(
  models: z.infer<typeof CivitalModelSchema>,
): z.infer<typeof ModelListWrapper> {
  return {
    models: models.items.flatMap((item) => {
      return item.modelVersions.map((v) => {
        return {
          name: `${item.name} ${v.name} (${v.files[0].name})`,
          type: mapType(item.type.toLowerCase()),
          base: v.baseModel,
          save_path: "default",
          description: item.description,
          reference: "",
          filename: v.files[0].name,
          // Quick hack to get the download url back as normal url
          url: `https://civitai.com/models/${v.modelId}?modelVersionId=${v.id}`, //v.files[0].downloadUrl,
        } as z.infer<typeof Model>;
      });
    }),
  };
}
export function getUrl(search?: string) {
  const baseUrl = "https://civitai.com/api/v1/models";
  const searchParams = {
    limit: 5,
  } as any;
  searchParams["sort"] = "Most Downloaded";

  if (search) {
    searchParams["query"] = search;
  } else {
    // sort: "Highest Rated",
  }

  const url = new URL(baseUrl);
  Object.keys(searchParams).forEach((key) =>
    url.searchParams.append(key, searchParams[key]),
  );

  return url;
}
