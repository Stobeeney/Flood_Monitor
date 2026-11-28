import {
  BellRing,
  Gauge,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  SlidersHorizontal,
  Waves,
  X,
} from 'lucide-react';
import type { NavSection, OperatorUser } from '../types/flood';

interface SidebarProps {
  operator: OperatorUser;
  activeSection: NavSection;
  onSelectSection: (section: NavSection) => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const OPERATIONS_NAV: Array<{
  id: NavSection;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'map', label: 'LRT-2 Flood Map', icon: MapIcon },
  { id: 'simulator', label: 'Water Gauge', icon: SlidersHorizontal },
  { id: 'alerts', label: 'Alert Monitor', icon: BellRing },
];

const SYSTEM_NAV: Array<{
  id: NavSection;
  label: string;
  icon: typeof Gauge;
}> = [{ id: 'thresholds', label: 'Threshold Setup', icon: Gauge }];

export function Sidebar({
  operator,
  activeSection,
  onSelectSection,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const initials = operator.username.slice(0, 2).toUpperCase();

  const content = (
    <aside className="w-56 shrink-0 bg-[#6B21A8] text-white flex flex-col justify-between min-h-full select-none border-r border-[#581C87]">
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-bold text-lg tracking-tight text-white">
            <span className="w-8 h-8 rounded-lg bg-white text-[#6B21A8] flex items-center justify-center">
              <Waves className="w-4 h-4" strokeWidth={2.2} />
            </span>
            <span>LRT-2 Monitor</span>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="lg:hidden p-1.5 rounded-md text-white hover:bg-white/15 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Operator Profile (flat divider, no nested card) */}
        <div className="mt-5 pb-4 border-b border-white/15 flex items-center gap-2.5 px-1">
          <div className="w-9 h-9 rounded-full bg-white text-[#5B21B6] font-display font-bold text-xs flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate text-white">
              {operator.username}
            </p>
            <p className="text-[11px] text-[#E9D5FF] flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4ADE80] shrink-0" />
              {operator.mode === 'supabase' ? 'Supabase Auth' : 'Preview Session'}
            </p>
          </div>
        </div>

        {/* Operations Navigation */}
        <div className="mt-6">
          <p className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-[#E9D5FF]">
            Operations
          </p>
          <nav className="mt-2 space-y-1" aria-label="Operations">
            {OPERATIONS_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#4C1D95] font-semibold shadow-xs'
                      : 'text-[#F5F3FF] hover:bg-white/12'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.9} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* System Navigation */}
        <div className="mt-6">
          <p className="px-2.5 text-[11px] font-bold uppercase tracking-wider text-[#E9D5FF]">
            System
          </p>
          <nav className="mt-2 space-y-1" aria-label="System">
            {SYSTEM_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectSection(item.id);
                    onCloseMobile();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#4C1D95] font-semibold shadow-xs'
                      : 'text-[#F5F3FF] hover:bg-white/12'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.9} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Footer Logout */}
      <div className="p-4 border-t border-white/15">
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-white hover:bg-white/15 transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" strokeWidth={2} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:flex">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="relative z-10 flex h-full">{content}</div>
          <button
            type="button"
            aria-label="Dismiss sidebar overlay"
            onClick={onCloseMobile}
            className="flex-1 bg-black/40"
          />
        </div>
      )}
    </>
  );
}
