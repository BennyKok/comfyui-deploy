import { DefaultValues } from "react-hook-form";
import { z } from "zod";

// TODO: This should support recursive ZodEffects but TypeScript doesn't allow circular type definitions.
export type ZodObjectOrWrapped =
  | z.ZodObject<any, any>
  | z.ZodEffects<z.ZodObject<any, any>>;

/**
 * Beautify a camelCase string.
 * e.g. "myString" -> "My String"
 */
export function beautifyObjectName(string: string) {
  let output = string.replace(/([A-Z])/g, " $1");
  output = output.charAt(0).toUpperCase() + output.slice(1);
  return output;
}

/**
 * Get the lowest level Zod type.
 * This will unpack optionals, refinements, etc.
 */
export function getBaseSchema<
  ChildType extends z.ZodAny | z.AnyZodObject = z.ZodAny,
>(schema: ChildType | z.ZodEffects<ChildType>): ChildType {
  if ("innerType" in schema._def) {
    return getBaseSchema(schema._def.innerType as ChildType);
  }
  if ("schema" in schema._def) {
    return getBaseSchema(schema._def.schema as ChildType);
  }
  return schema as ChildType;
}

/**
 * Get the type name of the lowest level Zod type.
 * This will unpack optionals, refinements, etc.
 */
export function getBaseType(schema: z.ZodAny): string {
  return getBaseSchema(schema)._def.typeName;
}

/**
 * Search for a "ZodDefult" in the Zod stack and return its value.
 */
export function getDefaultValueInZodStack(schema: z.ZodAny): any {
  const typedSchema = schema as unknown as z.ZodDefault<
    z.ZodNumber | z.ZodString
  >;

  if (typedSchema._def.typeName === "ZodDefault") {
    return typedSchema._def.defaultValue();
  }

  if ("innerType" in typedSchema._def) {
    return getDefaultValueInZodStack(
      typedSchema._def.innerType as unknown as z.ZodAny,
    );
  }
  if ("schema" in typedSchema._def) {
    return getDefaultValueInZodStack(
      (typedSchema._def as any).schema as z.ZodAny,
    );
  }
  return undefined;
}

/**
 * Get all default values from a Zod schema.
 */
export function getDefaultValues<Schema extends z.ZodObject<any, any>>(
  schema: Schema,
) {
  const { shape } = schema;
  type DefaultValuesType = DefaultValues<Partial<z.infer<Schema>>>;
  const defaultValues = {} as DefaultValuesType;

  for (const key of Object.keys(shape)) {
    const item = shape[key] as z.ZodAny;

    if (getBaseType(item) === "ZodObject") {
      const defaultItems = getDefaultValues(
        getBaseSchema(item) as unknown as z.ZodObject<any, any>,
      );
      for (const defaultItemKey of Object.keys(defaultItems)) {
        const pathKey = `${key}.${defaultItemKey}` as keyof DefaultValuesType;
        defaultValues[pathKey] = defaultItems[defaultItemKey];
      }
    } else {
      const defaultValue = getDefaultValueInZodStack(item);
      if (defaultValue !== undefined) {
        defaultValues[key as keyof DefaultValuesType] = defaultValue;
      }
    }
  }

  return defaultValues;
}

export function getObjectFormSchema(
  schema: ZodObjectOrWrapped,
): z.ZodObject<any, any> {
  if (schema._def.typeName === "ZodEffects") {
    const typedSchema = schema as z.ZodEffects<z.ZodObject<any, any>>;
    return getObjectFormSchema(typedSchema._def.schema);
  }
  return schema as z.ZodObject<any, any>;
}

/**
 * Convert a Zod schema to HTML input props to give direct feedback to the user.
 * Once submitted, the schema will be validated completely.
 */
export function zodToHtmlInputProps(
  schema:
    | z.ZodNumber
    | z.ZodString
    | z.ZodOptional<z.ZodNumber | z.ZodString>
    | any,
): React.InputHTMLAttributes<HTMLInputElement> {
  if (["ZodOptional", "ZodNullable"].includes(schema._def.typeName)) {
    const typedSchema = schema as z.ZodOptional<z.ZodNumber | z.ZodString>;
    return {
      ...zodToHtmlInputProps(typedSchema._def.innerType),
      required: false,
    };
  }

  const typedSchema = schema as z.ZodNumber | z.ZodString;

  if (!("checks" in typedSchema._def)) return {
    required: true
  };

  const { checks } = typedSchema._def;
  const inputProps: React.InputHTMLAttributes<HTMLInputElement> = {
    required: true,
  };
  const type = getBaseType(schema);

  for (const check of checks) {
    if (check.kind === "min") {
      if (type === "ZodString") {
        inputProps.minLength = check.value;
      } else {
        inputProps.min = check.value;
      }
    }
    if (check.kind === "max") {
      if (type === "ZodString") {
        inputProps.maxLength = check.value;
      } else {
        inputProps.max = check.value;
      }
    }
  }

  return inputProps;
}
