import {
  AlertTriangle,
  Coins,
  Home,
  Leaf,
  LineChart,
  LogOut,
  Sprout
} from "lucide-react";
import type { ReactNode } from "react";

type Props = {
  route: string;
  navigate: (path: string) => void;
  children: ReactNode;
};

const navItems = [
  { path: "/dashboard", label: "Home", icon: Home },
  { path: "/crop-intelligence", label: "Crop Intelligence", icon: Sprout },
  { path: "/market-intelligence", label: "Market Intelligence", icon: LineChart },
  { path: "/mandi-prices", label: "Live Mandi Prices", icon: LineChart },
  { path: "/expense-intelligence", label: "Expense Intelligence", icon: Coins },
  { path: "/risk-intelligence", label: "Risk Intelligence", icon: AlertTriangle }
];

export function AppLayout({ route, navigate, children }: Props) {
  return (
    <div className="min-h-screen bg-farm-bg lg:flex">
      <aside className="border-b border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="rounded-lg bg-farm-green p-2 text-white">
            <Leaf size={26} />
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-slate-900">FarmWise</p>
            <p className="text-xs text-slate-500">AI farm decisions</p>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:overflow-visible">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === "/dashboard"
              ? (route === "/dashboard" || route === "/profile" || route === "/home")
              : route === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex shrink-0 items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition lg:w-full ${
                  active ? "bg-green-50 text-farm-green" : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="hidden px-4 py-4 lg:block">
          <button
            onClick={() => {
              localStorage.removeItem("farmwise_session");
              localStorage.removeItem("farmwise_user");
              navigate("/auth/login");
            }}
            className="flex w-full items-center gap-3 rounded-lg bg-farm-blue px-4 py-3 text-sm font-semibold text-white"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>
      <div className="w-full lg:pl-72">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-7xl flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-farm-green">FarmWise</p>
            <h1 className="font-display text-2xl font-bold text-slate-900">Smart Farming Decisions Powered by AI & Real-Time Data</h1>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
