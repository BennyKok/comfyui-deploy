"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { LoadingIcon } from "@/components/LoadingIcon";
// import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import * as React from "react";
import { Suspense } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { CivitaiModelRegistry } from "./CivitaiModelRegistry";
import { ComfyUIManagerModelRegistry } from "./ComfyUIManagerModelRegistry";
import { Input } from "@/components/ui/input";
import { ModelList } from "@/components/custom-form/CivitalModelSchema";
import { z } from "zod";

export default function AutoFormModelsPickerUrl({
  label,
  isRequired,
  field,
  fieldConfigItem,
  zodItem,
  fieldProps,
}: AutoFormInputComponentProps) {
  return (
    <FormItem>
      {fieldConfigItem.inputProps?.showLabel && (
        <FormLabel>
          {label}
          {isRequired && <span className="text-destructive"> *</span>}
        </FormLabel>
      )}
      <FormControl>
        <Suspense fallback={<LoadingIcon />}>
          <ModelPickerView field={field} fieldProps={fieldProps} />
        </Suspense>
      </FormControl>
      {fieldConfigItem.description && (
        <FormDescription>{fieldConfigItem.description}</FormDescription>
      )}
      <FormMessage />
    </FormItem>
  );
}

function ModelPickerView({
  field,
  fieldProps,
}: Pick<AutoFormInputComponentProps, "field" | "fieldProps">) {
  const customOverride = React.useMemo(() => {
    const customOnChange = (value: z.infer<typeof ModelList>) => {
      field.onChange(value[0]?.url);
    };
    return {
      ...field,
      onChange: customOnChange,
      value: field.value
        ? [
            {
              url: field.value,
            },
          ]
        : [],
    };
  }, [field]);

  return (
    <div className="flex gap-2 flex-col px-1">
      <ComfyUIManagerModelRegistry
        field={customOverride}
        selectMultiple={false}
      />
      <CivitaiModelRegistry field={customOverride} selectMultiple={false} />
      <Input
        // className="min-h-[150px] max-h-[300px] p-2 rounded-lg text-xs w-full"
        value={field.value ?? ""}
        onChange={(e) => {
          field.onChange(e.target.value);
        }}
        type="text"
      />
    </div>
  );
}
