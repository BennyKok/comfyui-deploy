import {
  Accordion,
  AccordionItem,
  AccordionContent,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge as Chip } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card as BaseCard } from "@/components/ui/card";
import { Tabs, TabsTrigger as Tab, TabsList } from "@/components/ui/tabs";
// import { PiCheckCircleDuotone } from 'react-icons/pi';
import { cn } from "@/lib/utils";
import { ChevronRight as MdChevronRight } from "lucide-react";
import { CheckCircle as PiCheckCircleDuotone } from "lucide-react";
import Link from "next/link";
import type {
  HTMLAttributeAnchorTarget,
  HTMLAttributes,
  ReactNode,
} from "react";
// import { MdChevronRight } from 'react-icons/md';
import React from "react";
import { twMerge } from "tailwind-merge";

type ButtonProps = React.ComponentProps<typeof Button>;
type LinkProps = React.ComponentProps<typeof Link>;

type CardProps = React.ComponentProps<typeof BaseCard>;

type TabsProps = React.ComponentProps<typeof Tabs>;

type AccordionProps = React.ComponentProps<typeof Accordion>;

type ChipProps = React.ComponentProps<typeof Chip>;

function Section({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  // extract the primary action and secondary action from the children
  const primaryAction = getChildComponent(children, PrimaryAction);
  const secondaryAction = getChildComponent(children, SecondaryAction);

  return (
    <section
      className={twMerge(
        "flex min-h-[400px] w-full max-w-6xl flex-col justify-center gap-2 rounded-lg px-2 sm:px-10 py-10 md:px-20",
        className
      )}
      {...props}
    >
      {removeFromChildren(children, [PrimaryAction, SecondaryAction])}
      <div className="mt-2 flex flex-row gap-2">
        {primaryAction}
        {secondaryAction}
      </div>
    </section>
  );
}

function Title({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h1
      {...props}
      className={twMerge(
        "text-center text-4xl font-bold md:text-6xl",
        className
      )}
      style={{
        // @ts-ignore
        textWrap: "balance",
      }}
    >
      {children}
    </h1>
  );
}

function Subtitle({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      {...props}
      className={twMerge(
        "text text-center overflow-hidden text-ellipsis text-xl",
        className
      )}
      style={{
        // @ts-ignore
        textWrap: "balance",
      }}
    >
      {children}
    </h2>
  );
}

function Announcement({
  className,
  children,
  href,
  target = "_blank",
  ...props
}: ChipProps & {
  href?: string; //string | UrlObject;
  target?: HTMLAttributeAnchorTarget | undefined;
}) {
  return (
    <Chip
      className={twMerge(
        "w-fit group bg-foreground-50 text-center transition-colors hover:bg-gray-200",
        className
      )}
      variant="outline"
      // href={href}
      // target={target}
      // as={Link}
      // endContent={
      //   <MdChevronRight
      //     size={20}
      //     className="pr-1 transition-transform group-hover:translate-x-[2px]"
      //   />
      // }
      style={{
        // @ts-ignore
        textWrap: "balance",
      }}
      {...props}
    >
      <a href={href} target={target}>
        {children}
      </a>{" "}
      <MdChevronRight
        size={20}
        className="pr-1 transition-transform group-hover:translate-x-[2px]"
      />
    </Chip>
  );
}

type ActionProps = ButtonProps & {
  be: "button";
  hideArrow?: boolean;
};

type ActionLinkProps = LinkProps & {
  be?: "a";
  hideArrow?: boolean;
  variant?: ButtonProps["variant"];
};

function PrimaryAction({
  className,
  variant,
  children,
  hideArrow,
  ...props
}: ActionLinkProps | ActionProps) {
  if (props.be === "button") {
    return (
      <Button
        className={cn(
          buttonVariants({
            variant: variant,
          }),
          "group",
          className
        )}
        {...props}
      >
        {children}
        {!hideArrow && (
          <MdChevronRight className="transition-transform group-hover:translate-x-1" />
        )}
      </Button>
    );
  }

  return (
    <Link
      className={cn(
        buttonVariants({
          variant: variant,
        }),
        "group",
        className
      )}
      {...props}
    >
      {children}
      {!hideArrow && (
        <MdChevronRight className="transition-transform group-hover:translate-x-1" />
      )}
    </Link>
  );
}

function SecondaryAction({
  className,
  variant,
  children,
  hideArrow,
  ...props
}: ActionLinkProps | ActionProps) {
  if (props.be === "button") {
    return (
      <Button
        className={cn(
          buttonVariants({
            variant: variant,
          }),
          "group",
          className
        )}
        variant="ghost"
        {...props}
      >
        {children}
        {!hideArrow && (
          <MdChevronRight className="transition-transform group-hover:translate-x-1" />
        )}
      </Button>
    );
  }

  return (
    <Link
      className={cn(
        buttonVariants({
          variant: "ghost",
        }),
        "group",
        className
      )}
      {...props}
    >
      {children}
      {!hideArrow && (
        <MdChevronRight className="transition-transform group-hover:translate-x-1" />
      )}
    </Link>
  );
}
function PricingCard({
  className,
  children,
  ...props
}: Omit<CardProps, "children"> & {
  children:
    | ReactNode
    | ReactNode[]
    | ((pricingType: PricingType) => ReactNode | ReactNode[]);
}) {
  // const { pricingType } = usePricingContext();
  if (typeof children === "function")
    children = (children("month") as React.ReactElement).props.children as
      | ReactNode
      | ReactNode[];

  // extract the title and subtitle from the children
  // const cardTitleStyles =
  const title = getChildComponent(children, Title, {
    className: "text-2xl md:text-2xl text-start font-bold",
  });
  const subTitle = getChildComponent(children, Subtitle, {
    className: "text-md text-start text-foreground-500 mt-4",
  });
  const priceTags = getChildComponents(children, PriceTag, {
    className: "text-4xl font-bold",
  });
  const primaryAction = getChildComponent(children, PrimaryAction, {
    className: "w-full",
  });

  return (
    <BaseCard
      // shadow="sm"
      {...props}
      className={twMerge(
        "flex flex-col min-h-[400px] w-full max-w-full items-start justify-between gap-2 p-8 text-sm",
        className
      )}
    >
      <div>
        {title}
        {priceTags}
        {subTitle}
      </div>
      <div className="mt-4 flex h-full flex-col gap-2">
        {removeFromChildren(children, [
          Title,
          Subtitle,
          ImageArea,
          PriceTag,
          PrimaryAction,
        ]).map((item, i) => {
          return (
            <div className="flex items-center gap-2" key={i}>
              <PiCheckCircleDuotone className="text-green-600" size={20} />
              {item}
            </div>
          );
        })}
      </div>
      <div className="w-full">{primaryAction}</div>
    </BaseCard>
  );
}

// create a Pricing Context that store the monthly and pricing state
// const PricingContext = createContext<{
//   pricingType: PricingType;
//   setPricingType: (pricingType: PricingType) => void;
// }>({
//   pricingType: 'month',
//   setPricingType: (pricingType: PricingType) => {},
// });

const PricingTypeValue = ["month", "year"] as const;
export type PricingType = (typeof PricingTypeValue)[number];

// // an helper function to useContext
// export function usePricingContext() {
//   return React.useContext(PricingContext);
// }

function Pricing({ children, ...props }: HTMLAttributes<HTMLElement>) {
  // const [pricingType, setPricingType] = useState<PricingType>('month');

  // const context = useMemo(() => {
  //   return {
  //     pricingType,
  //     setPricingType,
  //   };
  // }, [pricingType]);

  return (
    // <PricingContext.Provider value={context}>
    <Section {...props}>{children}</Section>
    // </PricingContext.Provider>
  );
}

function PricingOption({ className, ...props }: TabsProps) {
  // const { setPricingType } = usePricingContext();

  return (
    <Tabs
      className={twMerge("w-fit", className)}
      defaultValue="month"
      aria-label="Pricing Options"
      {...props}
      onValueChange={(key) => {
        // setPricingType(key as PricingType);
      }}
      // onSelectionChange={(key: any) => {
      //   setPricingType(key as PricingType);
      // }}
    >
      <TabsList>
        {PricingTypeValue.map((pricingType) => {
          return (
            <Tab
              className="capitalize"
              value={pricingType}
              key={pricingType}
              // title={}
            >
              {pricingType}
            </Tab>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

function PriceTag({
  children,
  pricingType,
  ...props
}: HTMLAttributes<HTMLHeadingElement> & {
  pricingType?: "month" | "year" | string;
}) {
  // const { pricingType: currentPricingType } = usePricingContext();
  const currentPricingType = "month";

  if (pricingType != undefined && currentPricingType !== pricingType)
    return <></>;

  return <h2 {...props}>{children}</h2>;
}

function Card({ className, children, ...props }: CardProps) {
  // extract the title and subtitle from the children
  // const cardTitleStyles =
  const title = getChildComponent(children, Title, {
    className: "text-2xl md:text-2xl font-normal text-center",
  });
  const subTitle = getChildComponent(children, Subtitle, {
    className: "text-md text-center",
  });
  const image = getChildComponent(children, ImageArea);

  return (
    <BaseCard
      // shadow="sm"
      {...props}
      className={twMerge(
        "flex min-h-[280px] w-full max-w-full items-center justify-center gap-2 p-4 text-sm flex-col",
        className
      )}
    >
      {image}
      {title}
      {subTitle}
      {removeFromChildren(children, [Title, Subtitle, ImageArea])}
    </BaseCard>
  );
}

function ImageArea({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <div
      {...props}
      className={twMerge("aspect-square w-14 bg-foreground-300", className)}
    >
      {children}
    </div>
  );
}

// create a helper to get and remove the title and subtitle from the children
function getChildComponent<T extends (...args: any[]) => React.JSX.Element>(
  children: React.ReactNode | React.ReactNode[],
  type: T,
  propsOverride?: Partial<Parameters<T>[0]>
) {
  const childrenArr = React.Children.toArray(children);
  let child = childrenArr.find(
    (child) => React.isValidElement(child) && child.type === type
  ) as React.ReactElement<
    Parameters<T>[0],
    string | React.JSXElementConstructor<any>
  >;

  if (child && propsOverride) {
    const { className, ...rest } = child.props;
    child = React.cloneElement(child, {
      className: twMerge(className, propsOverride.className),
      ...rest,
    });
  }

  return child;
}

function getChildComponents<T extends (...args: any[]) => React.JSX.Element>(
  children: React.ReactNode | React.ReactNode[],
  type: T,
  propsOverride?: Partial<Parameters<T>[0]>
) {
  const childrenArr = React.Children.toArray(children);
  const child = (
    childrenArr.filter(
      (child) => React.isValidElement(child) && child.type === type
    ) as React.ReactElement<
      Parameters<T>[0],
      string | React.JSXElementConstructor<any>
    >[]
  ).map((child) => {
    if (child && propsOverride) {
      const { className, ...rest } = child.props;
      child = React.cloneElement(child, {
        className: twMerge(className, propsOverride.className),
        ...rest,
      });
    }
    return child;
  });

  return child;
}

function removeFromChildren(
  children: React.ReactNode | React.ReactNode[],
  types: any[]
): React.ReactNode[] {
  return React.Children.toArray(children).filter(
    (child) => React.isValidElement(child) && !types.includes(child.type)
  );
}

function FAQ({ children, ...props }: AccordionProps) {
  return <Accordion {...props}>{children}</Accordion>;
}

function FAQItem({
  children,
  ...props
}: {
  children: React.ReactNode | React.ReactNode[];
  "aria-label": string;
  title: string;
}): JSX.Element {
  return (
    <AccordionItem value={props["aria-label"]}>
      <AccordionTrigger>{props.title}</AccordionTrigger>
      <AccordionContent>{children}</AccordionContent>
    </AccordionItem>
  );
}

// const FAQItem = AccordionItem;

const pkg = Object.assign(Section, {
  Pricing,
  PricingOption,
  Title,
  Subtitle,
  Announcement,
  PrimaryAction,
  SecondaryAction,
  ImageArea,
  Card,
  FAQItem,
  FAQ,
  PricingCard,
  PriceTag,
});

export { pkg as Section };
