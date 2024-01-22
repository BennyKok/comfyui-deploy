import { checkMarkIcon, crossMarkIcon } from "../const/Icon";
import { cn } from "@/lib/utils";
import { getPricing } from "@/server/linkToPricing";
import { useEffect, useState } from "react";

type Tier = {
  name: string;
  id: string;
  href: string;
  priceMonthly: string;
  description: string;
  features: string[];
  featured: boolean;
  priority?: TierPriority;
};

enum TierPriority {
  Free = "free",
  Pro = "pro",
  Enterprise = "enterprise",
}

export default function PricingList() {
  const [productTiers, setProductTiers] = useState<Tier[]>();

  useEffect(() => {
    (async () => {
      const product = await getPricing();

      if (!product) return;

      const newProductTiers: Tier[] = product.data.map((item) => {
        // Create a new DOMParser instance
        const parser = new DOMParser();
        // Parse the description HTML string to a new document
        const doc = parser.parseFromString(
          item.attributes.description,
          "text/html"
        );
        // Extract the description and features
        const description = doc.querySelector("p")?.textContent || "";
        const features = Array.from(doc.querySelectorAll("ul > li")).map(
          (li) => li.textContent || ""
        );

        return {
          name: item.attributes.name,
          id: item.id,
          href: item.attributes.buy_now_url,
          priceMonthly:
            item.attributes.price_formatted.split("/")[0] == "Usage-based"
              ? "$20.00"
              : item.attributes.price_formatted.split("/")[0],
          description: description,
          features: features,

          // if name contains pro, it's featured
          featured: item.attributes.name.toLowerCase().includes("pro"),

          // give priority if name contain in enum
          priority: Object.values(TierPriority).find((priority) =>
            item.attributes.name.toLowerCase().includes(priority)
          ),
        };
      });

      // sort newProductTiers by priority
      newProductTiers.sort((a, b) => {
        if (!a.priority) return 1;
        if (!b.priority) return -1;
        return (
          Object.values(TierPriority).indexOf(a.priority) -
          Object.values(TierPriority).indexOf(b.priority)
        );
      });

      setProductTiers(newProductTiers);
    })();
  }, []);

  return (
    <div className="relative isolate px-6 py-24 lg:px-8">
      <div className="mx-auto max-w-2xl text-center lg:max-w-4xl">
        <h2 className="text-base font-semibold leading-7 text-indigo-600">
          Pricing
        </h2>
        <p className="mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          The right price for you, whoever you are
        </p>
      </div>
      <p className="mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600">
        Qui iusto aut est earum eos quae. Eligendi est at nam aliquid ad quo
        reprehenderit in aliquid fugiat dolorum voluptatibus.
      </p>
      <div className="mx-auto mt-16 grid max-w-lg grid-cols-1 items-center gap-y-6 sm:mt-20 sm:gap-y-0 lg:max-w-4xl lg:grid-cols-2 xl:max-w-6xl xl:grid-cols-3">
        {productTiers &&
          productTiers.map((tier, tierIdx) => (
            <div
              key={tier.id}
              className={cn(
                tier.featured
                  ? "relative bg-white shadow-2xl"
                  : "bg-white/60 sm:mx-8 lg:mx-0",
                tier.featured
                  ? ""
                  : tierIdx === 0
                  ? "rounded-t-3xl sm:rounded-b-none lg:rounded-tr-none lg:rounded-bl-3xl"
                  : "sm:rounded-t-none lg:rounded-tr-3xl lg:rounded-bl-none",
                "rounded-3xl p-8 ring-1 ring-gray-900/10 sm:p-10"
              )}
            >
              <h3
                id={tier.id}
                className="text-base font-semibold leading-7 text-indigo-600"
              >
                {tier.name}
              </h3>
              <p className="mt-4 flex items-baseline gap-x-2">
                <span className="text-5xl font-bold tracking-tight text-gray-900">
                  {tier.priceMonthly}
                </span>
                <span className="text-base text-gray-500">/month</span>
              </p>
              <p className="mt-6 text-base leading-7 text-gray-600">
                {tier.description}
              </p>
              <ul
                role="list"
                className="mt-8 space-y-3 text-sm leading-6 text-gray-600 sm:mt-10"
              >
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-x-3">
                    <div className="flex justify-center items-center">
                      {feature.includes("[x]") ? crossMarkIcon : checkMarkIcon}
                    </div>
                    {feature.replace("[x]", "")}
                  </li>
                ))}
              </ul>
              <a
                href={tier.href}
                aria-describedby={tier.id}
                className={cn(
                  tier.featured
                    ? "bg-indigo-600 text-white shadow hover:bg-indigo-500"
                    : "text-indigo-600 ring-1 ring-inset ring-indigo-200 hover:ring-indigo-300",
                  "mt-8 block rounded-md py-2.5 px-3.5 text-center text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:mt-10"
                )}
              >
                Get started today
              </a>
            </div>
          ))}
      </div>
    </div>
  );
}
