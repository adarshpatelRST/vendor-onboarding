import { Clock, MessageSquare } from "lucide-react";
import { RemarkEntry } from "../../types/models";
import { formatDateTime } from "./StatusBadge";

interface RemarkTimelineProps {
  remarks: RemarkEntry[];
}

export function RemarkTimeline({ remarks }: RemarkTimelineProps) {
  return (
    <section
      aria-label="Remark and Activity Timeline"
      className="bg-white border border-slate-200 rounded-xl p-5"
    >
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900">
            Remark &amp; Activity Timeline
          </h3>
        </div>
        <span className="text-xs text-slate-500 tabular-nums">
          {remarks.length} {remarks.length === 1 ? "entry" : "entries"}
        </span>
      </div>

      {remarks.length === 0 ? (
        <div className="py-6 text-center bg-slate-50 border border-slate-200 rounded-lg">
          <Clock className="w-5 h-5 text-slate-400 mx-auto mb-1.5" />
          <p className="text-xs font-medium text-slate-600">
            No review activity recorded yet
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Timeline events will appear once submitted.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {remarks.map((entry) => {
            const isRevertOrQuery =
              entry.action === "CHANGES_REQUESTED" ||
              entry.action === "QUERY_TO_AM" ||
              entry.action === "REJECTED";
            const isApproved =
              entry.action === "APPROVED" || entry.action === "AM_VERIFIED";

            return (
              <div
                key={entry.id}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-slate-900">
                      {entry.actorName}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600">{entry.actorRole}</span>
                  </div>
                  <span
                    className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      isRevertOrQuery
                        ? "bg-amber-50 text-amber-800 border-amber-200"
                        : isApproved
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : "bg-blue-50 text-blue-700 border-blue-200"
                    }`}
                  >
                    {entry.action}
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  {entry.message}
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  {formatDateTime(entry.timestamp)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
