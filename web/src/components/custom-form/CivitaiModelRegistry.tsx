"use client";
import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import * as React from "react";
import { useDebouncedCallback } from "use-debounce";
import { z } from "zod";
import { CivitalModelSchema, ModelListWrapper } from "./CivitalModelSchema";
import { getUrl, mapModelsList } from "./getUrl";
import { ModelSelector } from "./ModelSelector";

export function CivitaiModelRegistry({
  field,
  selectMultiple = true,
}: Pick<AutoFormInputComponentProps, "field"> & {
  selectMultiple?: boolean;
}) {
  const [modelList, setModelList] =
    React.useState<z.infer<typeof ModelListWrapper>>();

  const [loading, setLoading] = React.useState(false);

  const handleSearch = useDebouncedCallback((search) => {
    console.log(`Searching... ${search}`);

    setLoading(true);

    const controller = new AbortController();
    fetch(getUrl(search), {
      signal: controller.signal,
    })
      .then((x) => x.json())
      .then((a) => {
        const list = CivitalModelSchema.parse(a);
        console.log(a);

        setModelList(mapModelsList(list));
        setLoading(false);
      });

    return () => {
      controller.abort();
      setLoading(false);
    };
  }, 300);

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(getUrl(), {
      signal: controller.signal,
    })
      .then((x) => x.json())
      .then((a) => {
        const list = CivitalModelSchema.parse(a);
        setModelList(mapModelsList(list));
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
      label="Civitai"
      onSearch={handleSearch}
      shouldFilter={false}
      isLoading={loading}
    />
  );
}
