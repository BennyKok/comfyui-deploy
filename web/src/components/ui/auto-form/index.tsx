"use client";

import { Button } from "../button";
import { Form } from "../form";
import type { FieldConfig } from "./types";
import type { ZodObjectOrWrapped } from "./utils";
import { getDefaultValues, getObjectFormSchema } from "./utils";
import AutoFormObject from "@/components/ui/auto-form/fields/object";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import type { DefaultValues } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export function AutoFormSubmit({
  children,
  disabled,
}: {
  children?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={disabled} className="flex gap-2">
      {children ?? "Submit"}
    </Button>
  );
}

function AutoForm<SchemaType extends ZodObjectOrWrapped>({
  formSchema,
  values: valuesProp,
  onValuesChange: onValuesChangeProp,
  onParsedValuesChange,
  onSubmit: onSubmitProp,
  fieldConfig,
  children,
  className,
}: {
  formSchema: SchemaType;
  values?: Partial<z.infer<SchemaType>>;
  onValuesChange?: (values: Partial<z.infer<SchemaType>>) => void;
  onParsedValuesChange?: (values: Partial<z.infer<SchemaType>>) => void;
  onSubmit?: (values: z.infer<SchemaType>) => void;
  fieldConfig?: FieldConfig<z.infer<SchemaType>>;
  children?: React.ReactNode;
  className?: string;
}) {
  const objectFormSchema = getObjectFormSchema(formSchema);
  const defaultValues: DefaultValues<z.infer<typeof objectFormSchema>> =
    getDefaultValues(objectFormSchema);

  const form = useForm<z.infer<typeof objectFormSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
    values: valuesProp,
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    const parsedValues = formSchema.safeParse(values);
    if (parsedValues.success) {
      onSubmitProp?.(parsedValues.data);
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={(e) => {
          form.handleSubmit(onSubmit)(e);
        }}
        onChange={() => {
          const values = form.getValues();
          onValuesChangeProp?.(values);
          const parsedValues = formSchema.safeParse(values);
          if (parsedValues.success) {
            onParsedValuesChange?.(parsedValues.data);
          }
        }}
        className={cn("space-y-5", className)}
      >
        <ScrollArea>
          <div className="max-h-[400px] px-1 w-full">
            <AutoFormObject
              schema={objectFormSchema}
              form={form}
              fieldConfig={fieldConfig}
            />
          </div>
        </ScrollArea>

        {children}
      </form>
    </Form>
  );
}

export default AutoForm;
