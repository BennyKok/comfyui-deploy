// NOTE: this is WIP for doing client side validation for civitai model downloading
import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import { FormControl, FormItem, FormLabel } from "../ui/form";
import { LoadingIcon } from "@/components/LoadingIcon";
import * as React from "react";
import AutoFormInput from "../ui/auto-form/fields/input";
import { useDebouncedCallback } from "use-debounce";
import { CivitaiModelResponse } from "@/types/civitai";
import { z } from "zod";
import { insertCivitaiModelSchema } from "@/db/schema";

function getUrl(civitai_url: string) {
  // expect to be a URL to be https://civitai.com/models/36520
  // possiblity with slugged name and query-param modelVersionId

  const baseUrl = "https://civitai.com/api/v1/models/";
  const url = new URL(civitai_url);
  const pathSegments = url.pathname.split("/");
  const modelId = pathSegments[pathSegments.indexOf("models") + 1];
  const modelVersionId = url.searchParams.get("modelVersionId");

  return { url: baseUrl + modelId, modelVersionId };
}

export default function AutoFormCheckpointInput(
  props: AutoFormInputComponentProps
) {
  const [loading, setLoading] = React.useState(false);
  const [modelRes, setModelRes] =
    React.useState<z.infer<typeof CivitaiModelResponse>>();
  const [modelVersionid, setModelVersionId] = React.useState<string | null>();
  const { label, isRequired, fieldProps, zodItem, fieldConfigItem } = props;

  const handleSearch = useDebouncedCallback((search) => {
    const validationResult =
      insertCivitaiModelSchema.shape.civitai_url.safeParse(search);
    if (!validationResult.success) {
      console.error(validationResult.error);
      // Optionally set an error state here
      return;
    }

    setLoading(true);

    const controller = new AbortController();
    const { url, modelVersionId: versionId } = getUrl(search);
    setModelVersionId(versionId);
    fetch(url, {
      signal: controller.signal,
    })
      .then((x) => x.json())
      .then((a) => {
        const res = CivitaiModelResponse.parse(a);
        console.log(a);
        console.log(res);
        setModelRes(res);
        setLoading(false);
      });

    return () => {
      controller.abort();
      setLoading(false);
    };
  }, 300);

  const modifiedField = {
    ...fieldProps,
    // onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
    //   handleSearch(event.target.value);
    // },
  };

  return (
    <FormItem>
      {fieldConfigItem.inputProps?.showLabel && (
        <FormLabel>
          {label}
          {isRequired && <span className="text-destructive">*</span>}
        </FormLabel>
      )}
      <FormControl>
        <AutoFormInput {...props} fieldProps={modifiedField} />
      </FormControl>
    </FormItem>
  );
}
