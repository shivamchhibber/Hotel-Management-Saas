import React from "react";

export default function BottomSheet({ open, title, onClose, children, footer }) {
  if (!open) return null;

  return (
    <div className="al-modal-overlay" role="dialog" aria-modal="true">
      <div className="min-h-full flex items-end justify-center">
        <div className="w-full max-w-xl rounded-t-3xl bg-white/90 p-5 shadow-2xl ring-1 ring-black/10 backdrop-blur-2xl dark:bg-navy-800/90 dark:ring-white/10 max-h-[85vh] overflow-y-auto">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-gray-200 dark:bg-white/15" />
              {title ? (
                <h3 className="text-lg font-semibold text-navy-700 dark:text-white">{title}</h3>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-gray-500 hover:bg-black/5 dark:text-gray-300 dark:hover:bg-white/10"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          <div className="min-h-0">{children}</div>

          {footer ? <div className="mt-5 pb-2">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

