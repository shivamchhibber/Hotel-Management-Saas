/* eslint-disable */

import { HiX } from "react-icons/hi";
import Links from "./components/Links";
import { BRAND } from "theme/brand";

const Sidebar = ({ open, onClose, routes = [] }) => {
  return (
    <div
      className={`sm:none duration-175 linear fixed !z-50 flex min-h-full flex-col bg-white pb-10 shadow-2xl shadow-white/5 transition-all dark:!bg-navy-800 dark:text-white md:!z-50 lg:!z-50 xl:!z-0 ${open ? "translate-x-0" : "-translate-x-96"
        }`}
    >
      <span
        className="absolute top-4 right-4 block cursor-pointer xl:hidden"
        onClick={onClose}
      >
        <HiX />
      </span>

      <div className={`mx-[24px] mt-[28px] flex items-center`}>
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-b from-brandLinear to-brand-500 text-white shadow-sm ring-1 ring-black/10">
            <span className="text-sm font-extrabold tracking-tight">AL</span>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold text-navy-700 dark:text-white">{BRAND.name}</div>
            <div className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{BRAND.product}</div>
          </div>
        </div>
      </div>
      <div className="mt-4 mb-4 h-px bg-gray-300 dark:bg-white/30" />
      {/* Nav item */}

      <ul className="mb-auto pt-1">
        <Links routes={routes} />
      </ul>

      {/* Nav item end */}
    </div>
  );
};

export default Sidebar;
