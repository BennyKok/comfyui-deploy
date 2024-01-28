"use client";

import type { AutoFormInputComponentProps } from "../ui/auto-form/types";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import * as React from "react";
import { CivitaiModelRegistry } from "./CivitaiModelRegistry";
import { ComfyUIManagerModelRegistry } from "./ComfyUIManagerModelRegistry";

export function ModelPickerView({
  field,
}: Pick<AutoFormInputComponentProps, "field">) {
  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="item-1">
        <AccordionTrigger className="text-sm">
          Models (ComfyUI Manager & Civitai)
        </AccordionTrigger>
        <AccordionContent>
          <div className="flex gap-2 flex-col px-1">
            <ComfyUIManagerModelRegistry field={field} />
            <CivitaiModelRegistry field={field} />
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
