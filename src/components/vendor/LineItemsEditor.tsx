import { Plus, Trash2 } from "lucide-react";
import { OrderLineItem } from "../../types/models";
import { formatINR } from "../../utils/orderInvoiceValidators";

interface LineItemsEditorProps {
  items: OrderLineItem[];
  onChange?: (items: OrderLineItem[]) => void;
  errors?: Record<string, string>;
  readOnly?: boolean;
}

const UNITS = ["Units", "Trips", "Hours", "Days", "Months", "Kg", "Lots"];
const GST_RATES: Array<0 | 5 | 12 | 18 | 28> = [0, 5, 12, 18, 28];

export function createEmptyLineItem(): OrderLineItem {
  return {
    id: `li_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    description: "",
    hsnSacCode: "",
    quantity: 1,
    unit: "Units",
    unitPrice: 0,
    gstRate: 18,
  };
}

export function LineItemsEditor({
  items,
  onChange,
  errors = {},
  readOnly = false,
}: LineItemsEditorProps) {
  const updateItem = (index: number, patch: Partial<OrderLineItem>) => {
    if (!onChange) return;
    const next = items.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    );
    onChange(next);
  };

  const addItem = () => {
    if (!onChange) return;
    onChange([...items, createEmptyLineItem()]);
  };

  const removeItem = (index: number) => {
    if (!onChange || items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  if (readOnly) {
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <th className="py-2.5 px-3">Item / Service Description</th>
                <th className="py-2.5 px-3">HSN/SAC</th>
                <th className="py-2.5 px-3 text-right">Qty</th>
                <th className="py-2.5 px-3 text-right">Rate</th>
                <th className="py-2.5 px-3 text-right">GST</th>
                <th className="py-2.5 px-3 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const base = item.quantity * item.unitPrice;
                const tax = (base * item.gstRate) / 100;
                return (
                  <tr key={item.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {item.description}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">
                      {item.hsnSacCode || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {item.quantity} {item.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-700 whitespace-nowrap">
                      {formatINR(item.unitPrice)}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums text-slate-600">
                      {item.gstRate}%
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatINR(base + tax)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wide">
            Line Items &amp; GST Breakdown
          </h3>
          {errors.lineItems && (
            <p className="text-xs text-red-600 mt-0.5">{errors.lineItems}</p>
          )}
        </div>
        <button
          type="button"
          onClick={addItem}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Line Item</span>
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const descErr = errors[`line_${idx}_description`];
          const hsnErr = errors[`line_${idx}_hsn`];
          const qtyErr = errors[`line_${idx}_quantity`];
          const rateErr = errors[`line_${idx}_unitPrice`];
          const lineTotal =
            (Number(item.quantity) || 0) *
            (Number(item.unitPrice) || 0) *
            (1 + (Number(item.gstRate) || 0) / 100);

          return (
            <div
              key={item.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Item #{idx + 1}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-800 tabular-nums">
                    Line Total: {formatINR(lineTotal)}
                  </span>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      aria-label={`Remove line item ${idx + 1}`}
                      className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-5">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Description <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) =>
                      updateItem(idx, { description: e.target.value })
                    }
                    placeholder="e.g. 32ft Container Fleet Dispatch"
                    className={`w-full px-3 py-1.5 rounded-lg border bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      descErr
                        ? "border-red-500"
                        : "border-slate-300 focus:border-blue-600"
                    }`}
                  />
                  {descErr && (
                    <p className="text-[11px] text-red-600 mt-0.5">{descErr}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    HSN / SAC
                  </label>
                  <input
                    type="text"
                    value={item.hsnSacCode}
                    onChange={(e) =>
                      updateItem(idx, { hsnSacCode: e.target.value })
                    }
                    placeholder="996511"
                    className={`w-full px-3 py-1.5 rounded-lg border bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      hsnErr
                        ? "border-red-500"
                        : "border-slate-300 focus:border-blue-600"
                    }`}
                  />
                  {hsnErr && (
                    <p className="text-[11px] text-red-600 mt-0.5">{hsnErr}</p>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Qty <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    value={item.quantity}
                    onChange={(e) =>
                      updateItem(idx, {
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                    className={`w-full px-2.5 py-1.5 rounded-lg border bg-white text-xs text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      qtyErr
                        ? "border-red-500"
                        : "border-slate-300 focus:border-blue-600"
                    }`}
                  />
                  {qtyErr && (
                    <p className="text-[11px] text-red-600 mt-0.5">{qtyErr}</p>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Unit
                  </label>
                  <select
                    value={item.unit}
                    onChange={(e) => updateItem(idx, { unit: e.target.value })}
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Unit Rate (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={item.unitPrice || ""}
                    onChange={(e) =>
                      updateItem(idx, {
                        unitPrice: parseFloat(e.target.value) || 0,
                      })
                    }
                    placeholder="0.00"
                    className={`w-full px-2.5 py-1.5 rounded-lg border bg-white text-xs text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                      rateErr
                        ? "border-red-500"
                        : "border-slate-300 focus:border-blue-600"
                    }`}
                  />
                  {rateErr && (
                    <p className="text-[11px] text-red-600 mt-0.5">{rateErr}</p>
                  )}
                </div>

                <div className="sm:col-span-1">
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    GST %
                  </label>
                  <select
                    value={item.gstRate}
                    onChange={(e) =>
                      updateItem(idx, {
                        gstRate: Number(e.target.value) as OrderLineItem["gstRate"],
                      })
                    }
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                  >
                    {GST_RATES.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
