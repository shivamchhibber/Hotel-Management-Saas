import React from "react";
import Card from "components/card";
import Progress from "components/progress";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

const columnHelper = createColumnHelper();

export default function ComplexTable(props) {
  const { tableData = [], columnsData = [], title = "Complex Table" } = props;
  const [sorting, setSorting] = React.useState([]);
  const [data, setData] = React.useState(() => [...tableData]);

  React.useEffect(() => {
    setData([...tableData]);
  }, [tableData]);

  const formatCell = (value, accessor) => {
    if (value == null) return "";
    // Allow pre-rendered JSX values (badges/actions)
    if (typeof value === 'object' && value.$$typeof) return value;
    // Show progress bar only when accessor explicitly requests it
    if (accessor === 'progress') {
      const num = Number(value) || 0;
      return (
        <div className="flex items-center">
          <Progress width="w-[108px]" value={num} />
        </div>
      );
    }
    // Firestore Timestamp support
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      try { return value.toDate().toLocaleString(); } catch { return String(value); }
    }
    return String(value);
  };

  const columns = columnsData.map((col) =>
    columnHelper.accessor(col.accessor, {
      id: col.accessor,
      header: () => (
        <p className="text-sm font-bold text-gray-600 dark:text-white">
          {String(col.Header || col.accessor).toUpperCase()}
        </p>
      ),
      cell: (info) => (
        (() => {
          const value = formatCell(info.getValue(), col.accessor);
          // If value is JSX, render directly to avoid nesting <div> inside <p>
          if (React.isValidElement(value)) {
            return value;
          }
          return (
            <p className="text-sm font-bold text-navy-700 dark:text-white">{value}</p>
          );
        })()
      ),
    })
  );
  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    debugTable: false,
  });
  return (
    <Card extra={"w-full h-full px-6 pb-6 sm:overflow-x-auto"}>
      <div className="relative flex items-center justify-between pt-4">
        <div className="text-xl font-bold text-navy-700 dark:text-white">{title}</div>
      </div>

      <div className="mt-8 overflow-x-scroll xl:overflow-x-hidden">
        <table className="w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="!border-px !border-gray-400">
                {headerGroup.headers.map((header) => {
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      onClick={header.column.getToggleSortingHandler()}
                      className="cursor-pointer border-b-[1px] border-gray-200 pt-4 pb-2 pr-4 text-start"
                    >
                      <div className="items-center justify-between text-xs text-gray-200">
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {{
                          asc: "",
                          desc: "",
                        }[header.column.getIsSorted()] ?? null}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table
              .getRowModel()
              .rows.slice(0, 5)
              .map((row) => {
                return (
                  <tr key={row.id}>
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <td
                          key={cell.id}
                          className="min-w-[150px] border-white/0 py-3  pr-4"
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
