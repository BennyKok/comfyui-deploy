import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { LoadingIcon } from "@/components/LoadingIcon";
import { ModelPickerView } from "@/components/custom-form/ModelPickerView";
// import { CaretSortIcon, CheckIcon } from "@radix-ui/react-icons";
import * as React from "react";
import { Suspense } from "react";

export default function AutoFormModelsPicker({
  label,
  isRequired,
  field,
  fieldConfigItem,
  zodItem,
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
          <ModelPickerView field={field} />
        </Suspense>
      </FormControl>
      {fieldConfigItem.description && (
        <FormDescription>{fieldConfigItem.description}</FormDescription>
      )}
      <FormMessage />
    </FormItem>
  );
}
