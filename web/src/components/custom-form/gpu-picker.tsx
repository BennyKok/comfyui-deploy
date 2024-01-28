import { AutoFormInputComponentProps } from "@/components/ui/auto-form/types";
import { getBaseSchema } from "@/components/ui/auto-form/utils";
import { Badge } from "@/components/ui/badge";
import {
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Lock } from "lucide-react";
import * as z from "zod";

export default function AutoFormGPUPicker({
  label,
  isRequired,
  field,
  fieldConfigItem,
  zodItem,
}: AutoFormInputComponentProps) {
  const baseValues = (getBaseSchema(zodItem) as unknown as z.ZodEnum<any>)._def
    .values;

  let values: [string, string][] = [];
  if (!Array.isArray(baseValues)) {
    values = Object.entries(baseValues);
  } else {
    values = baseValues.map((value) => [value, value]);
  }

  function findItem(value: any) {
    return values.find((item) => item[0] === value);
  }

  const plan = fieldConfigItem.inputProps?.sub?.plan;
  const enabledGPU = ["T4"];

  const planMapping: Record<string, string> = {
    A10G: "pro",
    A100: "enterprise",
  };

  if (plan == "pro") {
    enabledGPU.push("A10G");
  } else if (plan == "enterprise") {
    enabledGPU.push("A10G");
    enabledGPU.push("A100");
  }

  return (
    <FormItem>
      <FormLabel>
        {label}
        {isRequired && <span className="text-destructive"> *</span>}
      </FormLabel>
      <FormControl>
        <Select onValueChange={field.onChange} defaultValue={field.value}>
          <SelectTrigger>
            <SelectValue
              className="w-full"
              placeholder={fieldConfigItem.inputProps?.placeholder}
            >
              {field.value ? findItem(field.value)?.[1] : "Select an option"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {values.map(([value, label]) => {
              const enabled = enabledGPU.includes(value);
              return (
                <SelectItem value={label} key={value} disabled={!enabled}>
                  {label}
                  {!enabled && (
                    <span className="mx-2 inline-flex items-center justify-center gap-2">
                      <Badge className="capitalize">{planMapping[value]}</Badge>{" "}
                      plan required
                      <Lock size={14}></Lock>
                    </span>
                  )}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </FormControl>
      {fieldConfigItem.description && (
        <FormDescription>{fieldConfigItem.description}</FormDescription>
      )}
      <FormMessage />
    </FormItem>
  );
}
