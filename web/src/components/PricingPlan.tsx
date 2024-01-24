import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Check, Info, Minus } from "lucide-react";

import { Fragment } from "react";
import { auth } from "@clerk/nextjs";
import { subscriptionPlanStatus } from "@/db/schema";
import { getCurrentPlan } from "../server/getCurrentPlan";

const tiers = [
  {
    name: "Basic",
    id: "basic",
    // href: "/api/checkout?plan=basic",
    href: "/workflows",
    priceMonthly: "$0",
    description: "Instant Comfy UI API",
    mostPopular: false,
  },
  {
    name: "Pro",
    id: "pro",
    href: "/api/stripe/checkout?plan=pro",
    priceMonthly: "$20",
    description: "Accelerate Comfy UI",
    mostPopular: false,
  },
  {
    name: "Enterprise",
    id: "enterprise",
    href: "/api/stripe/checkout?plan=enterprise",
    priceMonthly: "$100",
    description: "Scale your Products",
    mostPopular: true,
  },
];
const sections = [
  {
    name: "Features",
    features: [
      {
        name: "GPU",
        tiers: { Basic: "T4", Pro: "T4, A10G", Enterprise: "T4, A10G, A100" },
      },
      {
        name: "Compute Credit",
        tiers: {
          Basic: (
            <Tooltip>
              <TooltipTrigger className="flex items-center justify-center gap-2">
                30k secs free + usage <Info size={14} />
              </TooltipTrigger>
              <TooltipContent>
                <ul className="flex flex-col items-start justify-start">
                  GPU Price /s = $0.00015
                  <li>- T4 Multiplier = x1</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          ),
          Pro: (
            <Tooltip>
              <TooltipTrigger className="flex items-center justify-center gap-2">
                30k secs free + usage <Info size={14} />
              </TooltipTrigger>
              <TooltipContent>
                <ul className="flex flex-col items-start justify-start">
                  GPU Price /s = $0.00015
                  <li>- T4 Multiplier = x1</li>
                  <li>- A10G Multiplier = x4</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          ),
          Enterprise: (
            <Tooltip>
              <TooltipTrigger className="flex items-center justify-center gap-2">
                30k secs free + usage <Info size={14} />
              </TooltipTrigger>
              <TooltipContent>
                <ul className="flex flex-col items-start justify-start">
                  GPU Price /s = $0.00015
                  <li>- T4 Multiplier = x1</li>
                  <li>- A10G Multiplier = x4</li>
                  <li>- A100 Multiplier = x7</li>
                </ul>
              </TooltipContent>
            </Tooltip>
          ),
        },
      },
      {
        name: "Workflows",
        tiers: { Basic: "2", Pro: "25", Enterprise: "Unlimited" },
      },
      {
        name: "Serverless Machines",
        tiers: { Basic: "2", Pro: "10", Enterprise: "Unlimited" },
      },
      {
        name: "Outputs Storage",
        tiers: { Basic: "2 GB", Pro: "10 GB", Enterprise: "Unlimited" },
      },
      {
        name: "Dedicated Support",
        tiers: { Enterprise: true },
      },
      {
        name: "Private Model Hosting",
        tiers: { Enterprise: "Coming Soon" },
      },
    ],
  },
];

export default async function PricingList() {
  const { userId, orgId } = auth();

  if (!userId) {
    return <>No user id</>;
  }

  const sub = await getCurrentPlan({ user_id: userId, org_id: orgId });

  const getHrefFromTier = (tier: (typeof tiers)[0]) => {
    if (sub?.status == "active") {
      if (tier.id == sub?.plan) return "/api/stripe/dashboard";
      // This is actually cancelled
      if (sub.cancel_at_period_end) return tier.href;
      return "/api/stripe/dashboard?change=true";
    } else {
      return tier.href;
    }
  };
  const getNameFromTier = (tier: (typeof tiers)[0]) => {
    if (tier.id == sub?.plan && sub.status == "active") {
      return sub.cancel_at_period_end ? (
        <>
          Current <span className="text-2xs"> - Ending this period</span>
        </>
      ) : (
        "Current"
      );
    }
    if (sub?.status == "active") {
      return "Get Started";
    } else {
      return "Get Started";
    }
  };

  return (
    <div className="bg-white py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-base font-semibold leading-7 text-indigo-600">
            Pricing
          </h2>
          <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Turn any workflow into API
          </p>
        </div>
        <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
          ComfyDeploy is now under technical preview.
        </p>

        {/* xs to lg */}
        <div className="mx-auto mt-12 max-w-md space-y-8 sm:mt-16 lg:hidden">
          {tiers.map((tier) => (
            <section
              key={tier.id}
              className={cn(
                tier.mostPopular
                  ? "rounded-xl bg-gray-400/5 ring-1 ring-inset ring-gray-200"
                  : "",
                "p-8",
              )}
            >
              <h3
                id={tier.id}
                className="text-sm font-semibold leading-6 text-gray-900"
              >
                {tier.name}
              </h3>
              <p className="mt-2 flex items-baseline gap-x-1 text-gray-900">
                <span className="text-4xl font-bold">{tier.priceMonthly}</span>
                <span className="text-sm font-semibold">/month</span>
              </p>
              <br></br>
              <div className="text-xl font-semibold">{tier.description}</div>
              <a
                href={getHrefFromTier(tier)}
                aria-describedby={tier.id}
                className={cn(
                  tier.mostPopular
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300",
                  "mt-8 block rounded-md py-2 px-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                )}
              >
                {getNameFromTier(tier)}
              </a>
              <ul
                role="list"
                className="mt-10 space-y-4 text-sm leading-6 text-gray-900"
              >
                {sections.map((section) => (
                  <li key={section.name}>
                    <ul role="list" className="space-y-4">
                      {section.features.map((feature) =>
                        feature.tiers[tier.name] ? (
                          <li key={feature.name} className="flex gap-x-3">
                            <Check
                              className="h-6 w-5 flex-none text-indigo-600"
                              aria-hidden="true"
                            />
                            <span>
                              {feature.name}{" "}
                              {typeof feature.tiers[tier.name] === "string" ? (
                                <span className="text-sm leading-6 text-gray-500">
                                  ({feature.tiers[tier.name]})
                                </span>
                              ) : null}
                            </span>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* lg+ */}
        <div className="isolate mt-20 hidden lg:block border-gray-100 border p-6 shadow-md rounded-lg">
          <div className="relative -mx-8">
            {tiers.some((tier) => tier.mostPopular) ? (
              <div className="absolute inset-x-4 inset-y-0 -z-10 flex">
                <div
                  className="flex w-1/4 px-4"
                  aria-hidden="true"
                  style={{
                    marginLeft: `${
                      (tiers.findIndex((tier) => tier.mostPopular) + 1) * 25
                    }%`,
                  }}
                >
                  <div className="w-full rounded-t-xl border-x border-t border-gray-900/10 bg-gray-400/5" />
                </div>
              </div>
            ) : null}
            <table className="w-full table-fixed border-separate border-spacing-x-8 text-left">
              <caption className="sr-only">Pricing plan comparison</caption>
              <colgroup>
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
                <col className="w-1/4" />
              </colgroup>
              <thead>
                <tr>
                  <td />
                  {tiers.map((tier) => (
                    <th
                      key={tier.id}
                      scope="col"
                      className="px-6 pt-6 xl:px-8 xl:pt-8"
                    >
                      <div className="text-sm font-semibold leading-7 text-gray-900">
                        {tier.name}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">
                    <span className="sr-only">Price</span>
                  </th>
                  {tiers.map((tier) => (
                    <td key={tier.id} className="px-6 pt-2 xl:px-8">
                      <div className="flex items-baseline gap-x-1 text-gray-900">
                        <span className="text-4xl font-bold">
                          {tier.priceMonthly}
                        </span>
                        <span className="text-sm font-semibold leading-6">
                          /month
                        </span>
                      </div>
                      <br></br>
                      <div className="text-md font-semibold">
                        {tier.description}
                      </div>
                      <a
                        href={getHrefFromTier(tier)}
                        className={cn(
                          tier.mostPopular
                            ? "bg-indigo-600 text-white hover:bg-indigo-500"
                            : "text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300",
                          "mt-8 block rounded-md py-2 px-3 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
                        )}
                      >
                        {getNameFromTier(tier)}
                      </a>
                    </td>
                  ))}
                </tr>
                {sections.map((section, sectionIdx) => (
                  <Fragment key={section.name}>
                    <tr>
                      <th
                        scope="colgroup"
                        colSpan={4}
                        className={cn(
                          sectionIdx === 0 ? "pt-8" : "pt-16",
                          "pb-4 text-sm font-semibold leading-6 text-gray-900",
                        )}
                      >
                        {section.name}
                        <div className="absolute inset-x-8 mt-4 h-px bg-gray-900/10" />
                      </th>
                    </tr>
                    {section.features.map((feature) => (
                      <tr key={feature.name}>
                        <th
                          scope="row"
                          className="py-4 text-sm font-normal leading-6 text-gray-900"
                        >
                          {feature.name}
                          <div className="absolute inset-x-8 mt-4 h-px bg-gray-900/5" />
                        </th>
                        {tiers.map((tier) => (
                          <td key={tier.id} className="px-6 py-4 xl:px-8">
                            {typeof feature.tiers[tier.name] === "string" ||
                            typeof feature.tiers[tier.name] === "object" ? (
                              <div className="flex items-center justify-center text-center text-sm leading-6 text-gray-500">
                                {feature.tiers[tier.name]}
                              </div>
                            ) : (
                              <>
                                {feature.tiers[tier.name] === true ? (
                                  <Check
                                    className="mx-auto h-5 w-5 text-indigo-600"
                                    aria-hidden="true"
                                  />
                                ) : (
                                  <Minus
                                    className="mx-auto h-5 w-5 text-gray-400"
                                    aria-hidden="true"
                                  />
                                )}

                                <span className="sr-only">
                                  {feature.tiers[tier.name] === true
                                    ? "Included"
                                    : "Not included"}{" "}
                                  in {tier.name}
                                </span>
                              </>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
