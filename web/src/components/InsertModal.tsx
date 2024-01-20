"use client";

import { LoadingIcon } from "./LoadingIcon";
import { callServerPromise } from "@/components/callServerPromise";
import AutoForm, { AutoFormSubmit } from "@/components/ui/auto-form";
import type { FieldConfig } from "@/components/ui/auto-form/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import * as React from "react";
import { useState } from "react";
import type { UnknownKeysParam, ZodObject, ZodRawShape, z } from "zod";

export function InsertModal<
  K extends ZodRawShape,
  Y extends UnknownKeysParam,
  Z extends ZodObject<K, Y>
>(props: {
  tooltip?: string;
  disabled?: boolean;
  title: string;
  description: string;
  dialogClassName?: string;
  serverAction: (data: z.infer<Z>) => Promise<unknown>;
  formSchema: Z;
  fieldConfig?: FieldConfig<z.infer<Z>>;
}) {
  const [open, setOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* <DialogTrigger disabled={props.disabled}> */}
      {props.tooltip ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              className={props.disabled ? "opacity-50" : ""}
              onClick={() => {
                if (props.disabled) return;
                setOpen(true);
              }}
            >
              {props.title}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{props.tooltip}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button
          variant="default"
          disabled={props.disabled}
          onClick={() => {
            setOpen(true);
          }}
        >
          {props.title}
        </Button>
      )}
      {/* </DialogTrigger> */}
      <DialogContent className={cn("sm:max-w-[425px]", props.dialogClassName)}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        {/* <ScrollArea> */}
        <AutoForm
          fieldConfig={props.fieldConfig}
          formSchema={props.formSchema}
          onSubmit={async (data) => {
            setIsLoading(true);
            await callServerPromise(props.serverAction(data));
            setIsLoading(false);
            setOpen(false);
          }}
        >
          <div className="flex justify-end">
            <AutoFormSubmit>
              Save Changes
              {isLoading && <LoadingIcon />}
            </AutoFormSubmit>
          </div>
        </AutoForm>
        {/* </ScrollArea> */}
      </DialogContent>
    </Dialog>
  );
}

export function UpdateModal<
  K extends ZodRawShape,
  Y extends UnknownKeysParam,
  Z extends ZodObject<K, Y>
>(props: {
  open?: boolean;
  setOpen?: (open: boolean) => void;
  title: string;
  description: string;
  dialogClassName?: string;
  data: z.infer<Z> & {
    id: string;
  };
  serverAction: (
    data: z.infer<Z> & {
      id: string;
    }
  ) => Promise<unknown>;
  formSchema: Z;
  fieldConfig?: FieldConfig<z.infer<Z>>;
  trigger?: React.ReactNode;
  extraButtons?: React.ReactNode;
}) {
  const [_open, _setOpen] = React.useState(false);
  const open = props.open ?? _open;
  const setOpen = props.setOpen ?? _setOpen;

  const [values, setValues] = useState<Partial<z.infer<Z>>>({});
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    setValues(props.data);
  }, [props.data]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {props.trigger ?? (
        <DialogTrigger
          className="appearance-none hover:cursor-pointer"
          asChild
          onClick={() => {
            setOpen(true);
          }}
        >
          {props.trigger}
        </DialogTrigger>
      )}
      <DialogContent className={cn("sm:max-w-[425px]", props.dialogClassName)}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          <DialogDescription>{props.description}</DialogDescription>
        </DialogHeader>
        <AutoForm
          values={values}
          onValuesChange={setValues}
          fieldConfig={props.fieldConfig}
          formSchema={props.formSchema}
          onSubmit={async (data) => {
            setIsLoading(true);
            await callServerPromise(
              props.serverAction({
                ...data,
                id: props.data.id,
              })
            );
            setIsLoading(false);
            setOpen(false);
          }}
        >
          <div className="flex justify-end flex-wrap gap-2">
            {props.extraButtons}
            <AutoFormSubmit>
              Save Changes
              {isLoading && <LoadingIcon />}
            </AutoFormSubmit>
          </div>
        </AutoForm>
      </DialogContent>
    </Dialog>
  );
}
