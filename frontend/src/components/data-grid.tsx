"use client";

import { AllCommunityModule, ModuleRegistry, themeQuartz, type ColDef, type GridApi, type ProcessCellForExportParams } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { Download, Search } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "@/lib/money";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withParams({
  accentColor: "#6558ff",
  borderColor: "rgba(0, 0, 0, 0.08)",
  fontFamily: "inherit",
  fontSize: 13,
  headerBackgroundColor: "#f6f5f0",
  headerFontWeight: 700,
  textColor: "#171811",
  wrapperBorderRadius: 16,
});

// Spreadsheets run cells starting with these characters as formulas, and some values are user-supplied.
function safeCsvCell(params: ProcessCellForExportParams) {
  const text = String(params.formatValue(params.value) ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export const moneyColumn = <T,>(headerName: string, read: (row: T) => { minor: number; currency: string }): ColDef<T> => ({
  headerName,
  type: "rightAligned",
  width: 130,
  filter: "agNumberColumnFilter",
  valueGetter: ({ data }) => (data ? read(data).minor / 100 : null),
  valueFormatter: ({ data }) => (data ? formatMoney(read(data).minor, read(data).currency) : ""),
});

export const dateColumn = <T,>(headerName: string, read: (row: T) => string | null | undefined): ColDef<T> => ({
  headerName,
  width: 180,
  filter: "agDateColumnFilter",
  valueGetter: ({ data }) => {
    const value = data && read(data);
    return value ? new Date(value) : null;
  },
  valueFormatter: ({ value }) => (value ? (value as Date).toLocaleString() : ""),
});

export const ACTIONS_COLUMN = "actions";

export function DataGrid<T extends { id: string }>({ rows, columns, fileName, searchLabel }: { rows: T[]; columns: ColDef<T>[]; fileName: string; searchLabel: string }) {
  const [search, setSearch] = useState("");
  const [api, setApi] = useState<GridApi<T> | null>(null);

  function exportCsv() {
    api?.exportDataAsCsv({
      fileName,
      processCellCallback: safeCsvCell,
      columnKeys: api.getAllDisplayedColumns().filter((column) => column.getColId() !== ACTIONS_COLUMN),
    });
  }

  return (
    <section>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block sm:w-72">
          <span className="sr-only">{searchLabel}</span>
          <Search className="absolute left-3 top-3 size-4 text-black/35" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={searchLabel} className="h-10 w-full rounded-xl border border-black/10 bg-white pl-9 pr-3 text-sm outline-none focus:border-[#6558ff]" />
        </label>
        <button onClick={exportCsv} disabled={!api || !rows.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-black/10 bg-white px-4 text-xs font-bold disabled:opacity-40">
          <Download className="size-4" /> Export CSV
        </button>
      </div>
      <AgGridReact<T>
        theme={theme}
        rowData={rows}
        columnDefs={columns}
        defaultColDef={{ sortable: true, filter: true, resizable: true }}
        getRowId={({ data }) => data.id}
        quickFilterText={search}
        domLayout="autoHeight"
        pagination
        paginationPageSize={25}
        paginationPageSizeSelector={[25, 50, 100]}
        enableCellTextSelection
        overlayNoRowsTemplate="No records yet"
        onGridReady={({ api: gridApi }) => setApi(gridApi)}
      />
    </section>
  );
}
