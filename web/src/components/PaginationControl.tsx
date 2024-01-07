import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export function PaginationControl(props: {
  totalPage: number;
  currentPage: number;
}) {
  let startPage = Math.max(props.currentPage - 2, 1);
  let endPage = Math.min(startPage + 3, props.totalPage);

  if (props.currentPage <= 2) {
    endPage = Math.min(4, props.totalPage);
  }

  if (props.currentPage > props.totalPage - 2) {
    startPage = Math.max(props.totalPage - 3, 1);
  }

  const pageNumbers = Array.from(
    { length: endPage - startPage + 1 },
    (_, i) => startPage + i
  );

  return (
    <Pagination className="mt-2">
      <PaginationContent>
        <PaginationPrevious
          href={
            props.currentPage > 1
              ? `?page=${props.currentPage - 1}`
              : `?page=${props.currentPage}`
          }
        />
        {pageNumbers.map((page) => (
          <PaginationLink
            key={page}
            href={`?page=${page}`}
            isActive={props.currentPage === page}
          >
            {page}
          </PaginationLink>
        ))}
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationNext
          className="cursor-pointer"
          href={
            props.currentPage < props.totalPage
              ? `?page=${props.currentPage + 1}`
              : `?page=${props.totalPage}`
          }
        />
      </PaginationContent>
    </Pagination>
  );
}
