import * as React from "react";
import { MoreHorizontal, Pencil, Search, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ScrollableTable } from "@/components/ui/ScrollableTable";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  data: T[] | undefined;
  isLoading: boolean;
  columns: DataTableColumn<T>[];
  onEdit?: (row: T) => void;
  onDelete?: (row: T) => void;
  /** Custom action cell rendered in place of the default Edit/Delete menu. */
  rowActions?: (row: T) => React.ReactNode;
  actionsHeader?: string;
  searchableFields?: (keyof T)[];
  searchPlaceholder?: string;
  emptyState: React.ReactNode;
  filteredEmptyMessage?: string;
  getRowKey?: (row: T) => string;
}

export function DataTable<T extends Record<string, unknown>>({
  data,
  isLoading,
  columns,
  onEdit,
  onDelete,
  rowActions,
  actionsHeader = "Ações",
  searchableFields,
  searchPlaceholder = "Buscar...",
  emptyState,
  filteredEmptyMessage = "Nenhum registro encontrado com esse filtro",
  getRowKey,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState("");
  const hasActions = !!rowActions || !!onEdit || !!onDelete;

  const filtered = React.useMemo(() => {
    if (!data) return [];
    if (!searchableFields || !search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((row) =>
      searchableFields.some((f) => {
        const v = row[f];
        return typeof v === "string" && v.toLowerCase().includes(q);
      }),
    );
  }, [data, search, searchableFields]);

  const totalCount = data?.length ?? 0;
  const showEmpty = !isLoading && filtered.length === 0;
  const showFilteredEmpty = showEmpty && totalCount > 0 && !!search.trim();

  return (
    <div className="space-y-4">
      {searchableFields && searchableFields.length > 0 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {showEmpty && !showFilteredEmpty ? (
        emptyState
      ) : (
        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.header}
                  </TableHead>
                ))}
                {hasActions && (
                  <TableHead className="w-[60px] text-right">{actionsHeader}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={`skel-${i}`}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        <Skeleton className="h-4 w-3/4" />
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-8" />
                      </TableCell>
                    )}
                  </TableRow>
                ))}

              {!isLoading && showFilteredEmpty && (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (hasActions ? 1 : 0)}
                    className="h-24 text-center text-sm text-muted-foreground"
                  >
                    {filteredEmptyMessage}
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                filtered.map((row, idx) => (
                  <TableRow key={getRowKey ? getRowKey(row) : idx}>
                    {columns.map((col) => (
                      <TableCell key={col.key} className={cn(col.className)}>
                        {col.render(row)}
                      </TableCell>
                    ))}
                    {hasActions && (
                      <TableCell className="text-right">
                        {rowActions ? (
                          rowActions(row)
                        ) : (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Ações</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {onEdit && (
                                <DropdownMenuItem onClick={() => onEdit(row)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              {onEdit && onDelete && <DropdownMenuSeparator />}
                              {onDelete && (
                                <DropdownMenuItem
                                  onClick={() => onDelete(row)}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Excluir
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
