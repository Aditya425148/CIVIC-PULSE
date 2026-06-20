import { useState, useEffect } from "react";
import { useNavigate, Outlet, NavLink } from "react-router";
import { LayoutDashboard, Users, LogOut, Shield, Menu, X } from "lucide-react";
import { account } from "../../appwrite";

const navItems = [
  { to: "/manager", icon: LayoutDashboard, label: "Area Overview", end: true },
  { to: "/manager/workers", icon: Users, label: "My Workers" },
];

export default function ManagerLayout() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [manager, setManager] = useState<any>(null);

  useEffect(() => {
    account
      .get()
      .then((user) => {
        setManager({
          ...user,
          name: user.name || "Manager",
          email: user.email,
        });
      })
      .catch(() => {
        navigate("/login", { replace: true });
      });
  }, [navigate]);

  const handleLogout = async () => {
    localStorage.removeItem("manager_email_override");
    await account.deleteSession("current");
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 font-['Inter',sans-serif]">
      {/* Sidebar - Desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white lg:block">
        <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-600 text-white shadow-sm">
            <Shield className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-slate-900 tracking-tight">
            ManagerPortal
          </span>
        </div>

        <nav className="p-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sky-50 text-sky-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-4 w-full px-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Header - Mobile & Shared */}
      <header className="fixed top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur lg:left-64 lg:w-[calc(100%-16rem)]">
        <div className="flex h-16 items-center justify-between px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="hidden lg:block">
              <div className="text-sm font-bold text-slate-900">
                Welcome back, {manager?.name?.split(" ")[0]}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-lg p-2 text-slate-500 lg:hidden"
            >
              <Menu className="h-6 w-6" />
            </button>
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white text-lg font-black shadow-lg shadow-sky-200 border-2 border-white">
              {manager?.name?.charAt(0)}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          ></div>
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-2xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-6">
              <div className="flex items-center gap-2 font-bold text-slate-900">
                <Shield className="h-5 w-5 text-sky-600" />
                <span>Portal</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)}>
                <X className="h-6 w-6 text-slate-500" />
              </button>
            </div>
            <nav className="p-4 pt-8">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className="flex items-center gap-3 rounded-xl px-4 py-4 text-slate-600"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="pt-20 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
