import { useMemo, useState } from "react";
import { Eye, Search, ShieldCheck, X } from "lucide-react";
import { AuditLog } from "../../types/models";
import { ColumnDef, DataTable, RowAction } from "../common/DataTable";
import { DropSearch } from "../common/DropSearch";
import { Modal } from "../common/Modal";
import { formatDateTime } from "../common/StatusBadge";

interface AuditLogsPageProps {
  auditLogs: AuditLog[];
}

export function AuditLogsPage({ auditLogs }: AuditLogsPageProps) {
  const [search, setSearch] = useState("");
  const [tableFilter, setTableFilter] = useState<string>("ALL");
  const [actionFilter, setActionFilter] = useState<string>("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const uniqueActions = useMemo(() => {
    return Array.from(new Set(auditLogs.map((l) => l.action))).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return auditLogs.filter((log) => {
      if (tableFilter !== "ALL" && log.tableName !== tableFilter) return false;
      if (actionFilter !== "ALL" && log.action !== actionFilter) return false;
      if (!q) return true;
      return (
        log.recordId.toLowerCase().includes(q) ||
        log.performedByName.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.id.toLowerCase().includes(q)
      );
    });
  }, [auditLogs, search, tableFilter, actionFilter]);

  const columns: ColumnDef<AuditLog>[] = [
    {
      key: "performedAt",
      header: "Performed At",
      sortable: true,
      sortValue: (l) => l.performedAt,
      render: (l) => (
        <span className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
          {formatDateTime(l.performedAt)}
        </span>
      ),
    },
    {
      key: "tableName",
      header: "Table",
      sortable: true,
      sortValue: (l) => l.tableName,
      render: (l) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700 whitespace-nowrap">
          {l.tableName}
        </span>
      ),
    },
    {
      key: "recordId",
      header: "Record ID",
      sortable: true,
      sortValue: (l) => l.recordId,
      render: (l) => (
        <span className="font-mono text-xs font-semibold text-slate-900 whitespace-nowrap">
          {l.recordId}
        </span>
      ),
    },
    {
      key: "action",
      header: "Action",
      sortable: true,
      sortValue: (l) => l.action,
      render: (l) => (
        <span className="font-mono text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md whitespace-nowrap">
          {l.action}
        </span>
      ),
    },
    {
      key: "performedByName",
      header: "Performed By",
      sortable: true,
      sortValue: (l) => l.performedByName,
      widthClass: "min-w-[190px] whitespace-nowrap",
      render: (l) => (
        <div className="text-xs whitespace-nowrap">
          <span className="font-medium text-slate-900">{l.performedByName}</span>
          <span className="text-slate-400"> · </span>
          <span className="text-slate-600 font-medium">{l.performedByRole}</span>
        </div>
      ),
    },
  ];

  const getRowActions = (log: AuditLog): RowAction<AuditLog>[] => [
    {
      label: "View Details",
      icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
      onClick: (row) => setSelectedLog(row),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Audit Logs</h1>
        <p className="text-sm text-slate-600 mt-1">
          Immutable change log capturing before-and-after JSON snapshots across requests, users, mappings, and business types.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              aria-label="Search audit logs by record ID or actor"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Record ID or Actor..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
            />
          </div>

          <DropSearch
            value={tableFilter}
            onChange={(val) => setTableFilter(val)}
            options={[
              { value: "ALL", label: "All Tables" },
              { value: "Request", label: "Request" },
              { value: "Order", label: "Order" },
              { value: "Invoice", label: "Invoice" },
              { value: "User", label: "User" },
              { value: "BusinessType", label: "BusinessType" },
              { value: "UserBusinessMapping", label: "UserBusinessMapping" },
            ]}
            placeholder="Filter by table..."
          />

          <DropSearch
            value={actionFilter}
            onChange={(val) => setActionFilter(val)}
            options={[
              { value: "ALL", label: "All Actions" },
              ...uniqueActions.map((act) => ({
                value: act,
                label: act,
              })),
            ]}
            placeholder="Filter by action..."
            searchPlaceholder="Search action..."
          />
        </div>
      </div>

      <DataTable
        data={filteredLogs}
        columns={columns}
        getRowId={(l) => l.id}
        getRowLabel={(l) => `${l.tableName} ${l.recordId}`}
        getRowActions={getRowActions}
        defaultSortKey="performedAt"
        defaultSortDirection="desc"
        emptyTitle="No audit logs found"
        emptyDescription="Try clearing filters or performing an action in the portal."
      />

      {/* Audit Log Details Modal */}
      <Modal
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        hideHeader
        title="Audit Log Details"
        maxWidthClass="max-w-3xl"
      >
        {selectedLog && (
          <div className="bg-white">
            {/* Header with green shield icon, title Audit Log Details, monospace ID */}
            <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Audit Log Details
                  </h2>
                  <p className="font-mono text-xs text-slate-500 mt-0.5 break-all">
                    ID: {selectedLog.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                aria-label="Close audit log details"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-500">
                    PERFORMED AT
                  </p>
                  <p className="text-xs font-medium text-slate-900 mt-1 tabular-nums">
                    {formatDateTime(selectedLog.performedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-500">
                    PERFORMED BY
                  </p>
                  <p className="text-xs font-medium text-slate-900 mt-1">
                    {selectedLog.performedByName} ({selectedLog.performedByRole})
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold tracking-wider text-slate-500">
                    RECORD ID / WHAT CHANGED
                  </p>
                  <p className="text-xs font-medium text-slate-900 mt-1 font-mono">
                    {selectedLog.recordId} · {selectedLog.tableName} (
                    {selectedLog.action})
                  </p>
                </div>
              </div>

              {/* Side-by-side OLD DATA (JSON) and NEW DATA (JSON) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wide text-slate-700">
                      OLD DATA (JSON)
                    </span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-800 bg-white whitespace-pre-wrap break-words break-all overflow-y-auto max-h-72 leading-relaxed">
                    {selectedLog.oldData
                      ? JSON.stringify(selectedLog.oldData, null, 2)
                      : "null (New Record Created)"}
                  </pre>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                  <div className="px-4 py-2.5 bg-emerald-50/70 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold tracking-wide text-emerald-800">
                      NEW DATA (JSON)
                    </span>
                  </div>
                  <pre className="p-4 text-xs font-mono text-slate-800 bg-white whitespace-pre-wrap break-words break-all overflow-y-auto max-h-72 leading-relaxed">
                    {selectedLog.newData
                      ? JSON.stringify(selectedLog.newData, null, 2)
                      : "null"}
                  </pre>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold tracking-wide cursor-pointer transition-colors"
                >
                  CLOSE
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
