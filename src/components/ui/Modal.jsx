import React from "react";

export default function Modal({ open, title, onClose, maxWidthClass = "max-w-md", children, footer }) {
  if (!open) return null;

  return (
    <div className="al-modal-overlay" role="dialog" aria-modal="true">
      <div className="al-modal-center">
        <div className={`al-modal ${maxWidthClass}`}>
          <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
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

          {footer ? <div className="mt-6">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

