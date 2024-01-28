"use client";
import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import * as React from "react";
import { z } from "zod";
import { ModelListWrapper } from "./CivitalModelSchema";
import { ModelSelector } from "./ModelSelector";

export function ComfyUIManagerModelRegistry({
  field,
  selectMultiple = true,
}: Pick<AutoFormInputComponentProps, "field"> & {
  selectMultiple?: boolean;
}) {
  const [modelList, setModelList] =
    React.useState<z.infer<typeof ModelListWrapper>>();

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(
      "https://raw.githubusercontent.com/ltdrdata/ComfyUI-Manager/main/model-list.json",
      {
        signal: controller.signal,
      },
    )
      .then((x) => x.json())
      .then((a) => {
        setModelList(ModelListWrapper.parse(a));
      });

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <ModelSelector
      selectMultiple={selectMultiple}
      field={field}
      modelList={modelList}
      label="ComfyUI Manager"
    />
  );
}
