const people = [
  {
    name: "Nvidia T4 GPU",
    gpu: "1x",
    ram: "16GB",
    price: "$0.000225/sec",
  },
  {
    name: "Nvidia A40 GPU",
    gpu: "1x",
    ram: "48GB",
    price: "$0.000575/sec",
  },
];

export function GpuPricingPlan() {
  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="-mx-4 mt-8 sm:-mx-0">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6"
              >
                GPU
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell"
              >
                No.
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 sm:table-cell"
              >
                RAM
              </th>
              <th
                scope="col"
                className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
              >
                Price
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {people.map((person) => (
              <tr key={person.ram} className="even:bg-gray-50">
                <td className="w-full max-w-0 py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:w-auto sm:max-w-none sm:pl-6">
                  {person.name}
                  <dl className="font-normal lg:hidden">
                    <dt className="sr-only">No.</dt>
                    <dd className="mt-1 truncate text-gray-700">
                      {person.gpu}
                    </dd>
                    <dt className="sr-only sm:hidden">RAM</dt>
                    <dd className="mt-1 truncate text-gray-500 sm:hidden">
                      {person.ram}
                    </dd>
                  </dl>
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-500 lg:table-cell">
                  {person.gpu}
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-500 sm:table-cell">
                  {person.ram}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500">
                  {person.price}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
