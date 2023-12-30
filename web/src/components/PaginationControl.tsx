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
  return (
    <Pagination>
      <PaginationContent>
        <PaginationPrevious
          href={
            props.currentPage > 1
              ? `?page=${props.currentPage - 1}`
              : `?page=${props.currentPage}`
          }
        />
        <PaginationLink href="#" isActive>
          {props.currentPage}
        </PaginationLink>
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
