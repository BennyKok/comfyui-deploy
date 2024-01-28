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
import { ExternalLink } from "lucide-react";

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
      <FormDescription>
        {" "}
        <div className="text-sm">
          Models are moving to{" "}
          <a
            href="/storage"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 underline"
          >
            <ExternalLink size={12} />
            Storage
          </a>
        </div>
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
}

function ModelPickerView({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger className="text-sm">
          Models (ComfyUI Manager)
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex gap-2 flex-col px-1">
            <ComfyUIManagerModelRegistry field={field} />
            {/* <CivitaiModelRegistry field={field} /> */}
            {/* <span>{field.value.length} selected</span> */}
            {field.value && (
              <ScrollArea className="w-full bg-gray-100 mx-auto rounded-lg mt-2">
                <Textarea
                  className="min-h-[150px] max-h-[300px] p-2 rounded-lg text-xs w-full"
                  value={JSON.stringify(field.value, null, 2)}
                  onChange={(e) => {
                    field.onChange(JSON.parse(e.target.value));
                  }}
                />
              </ScrollArea>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
