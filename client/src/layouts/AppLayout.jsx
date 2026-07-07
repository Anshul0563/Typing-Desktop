import { useEffect, useMemo, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  Command,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  UserRound,
  X,
  Keyboard,
  TrendingUp,
} from "lucide-react";
import { Brand } from "../components/Brand.jsx";
import { Footer } from "../components/Footer.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useSiteSettings } from "../context/SiteSettingsContext.jsx";

const studentLinks = [
  ["/dashboard", LayoutDashboard, "Dashboard"],
  ["/exams", Keyboard, "Typing Tests"],
  ["/results", BarChart3, "Results"],
  ["/analytics", TrendingUp, "Analytics"],
  ["/profile", UserRound, "Profile"],
  ["/student-settings", Settings, "Settings"],
];

export function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("typepath_sidebar") === "collapsed",
  );
  const [dark, setDark] = useState(
    () => localStorage.getItem("typepath_theme") === "dark",
  );
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const commandInputRef = useRef(null);
  const { settings } = useSiteSettings();
  const dashboardQuery = new URLSearchParams(location.search).get("q") || "";
  const pageLabel =
    studentLinks.find(([to]) => location.pathname === to)?.[2] ||
    (location.pathname.startsWith("/result/") ? "Result review" : "Workspace");
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("typepath_theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => {
    localStorage.setItem(
      "typepath_sidebar",
      collapsed ? "collapsed" : "expanded",
    );
  }, [collapsed]);
  useEffect(() => {
    const syncTheme = (event) => setDark(event.detail === "dark");
    window.addEventListener("typepath:theme", syncTheme);
    return () => window.removeEventListener("typepath:theme", syncTheme);
  }, []);
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);
  useEffect(() => {
    if (commandOpen)
      requestAnimationFrame(() => commandInputRef.current?.focus());
    else setCommandQuery("");
  }, [commandOpen]);
  const commandLinks = useMemo(
    () =>
      studentLinks.filter(([, , label]) =>
        label.toLowerCase().includes(commandQuery.trim().toLowerCase()),
      ),
    [commandQuery],
  );
  const leave = () => {
    logout();
    navigate("/");
  };
  const searchExams = (event) => {
    const value = event.target.value;
    const search = value.trim() ? `?q=${encodeURIComponent(value)}` : "";
    navigate({ pathname: "/exams", search }, { replace: true });
  };

  const openCommandRoute = (to) => {
    setCommandOpen(false);
    navigate(to);
  };

  return (
    <div className={`student-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
      <a className="skip-link" href="#student-content">
        Skip to content
      </a>
      <aside className={`student-sidebar ${menuOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/dashboard">
            <Brand />
          </Link>
          <button
            className="mobile-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation"
          >
            <X />
          </button>
        </div>
        <nav className="student-nav" aria-label="Student navigation">
          {studentLinks.map(([to, Icon, label]) => (
            <NavLink
              key={label}
              to={to}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `${isActive && !to.includes("#") ? "active" : ""}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-support">
          <span>Need a warm-up?</span>
          <p>Start slowly. Accuracy builds speed.</p>
          <Link to="/exams">Browse tests</Link>
        </div>
        <button className="sidebar-logout" onClick={leave}>
          <LogOut size={19} />
          <span>Logout</span>
        </button>
        <button
          className="collapse-button"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <ChevronLeft />
        </button>
      </aside>
      {menuOpen && (
        <button
          className="sidebar-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu"
        />
      )}
      <div className="student-workspace">
        <header className="student-topbar">
          <button
            className="mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation"
          >
            <Menu />
          </button>
          <div className="topbar-page">
            <small>Learning studio</small>
            <strong>{pageLabel}</strong>
          </div>
          {["/dashboard", "/exams"].includes(location.pathname) ? (
            <label className="dashboard-search">
              <Search size={18} />
              <input
                aria-label="Search exams"
                placeholder="Find a test…"
                value={dashboardQuery}
                onChange={searchExams}
              />
              <kbd>Ctrl K</kbd>
            </label>
          ) : (
            <button
              className="command-trigger"
              onClick={() => setCommandOpen(true)}
            >
              <Search />
              <span>Quick navigate</span>
              <kbd>Ctrl K</kbd>
            </button>
          )}
          <div className="student-top-actions">
            <button
              onClick={() => setDark((value) => !value)}
              aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
              title={`Switch to ${dark ? "light" : "dark"} theme`}
            >
              {dark ? <Sun /> : <Moon />}
            </button>
            <div className="student-user">
              <span className="user-avatar">
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>Focused learner</small>
              </div>
            </div>
          </div>
        </header>
        <main id="student-content" className="student-main">
          {settings.announcement && (
            <div className="student-announcement">{settings.announcement}</div>
          )}
          <div className="route-stage" key={location.pathname}>
            <Outlet />
          </div>
        </main>
        <Footer variant="workspace" />
      </div>
      {commandOpen && (
        <div
          className="command-backdrop"
          role="presentation"
          onMouseDown={() => setCommandOpen(false)}
        >
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Quick navigation"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <Search />
              <input
                ref={commandInputRef}
                value={commandQuery}
                onChange={(event) => setCommandQuery(event.target.value)}
                placeholder="Where do you want to go?"
                aria-label="Search pages"
              />
              <button
                onClick={() => setCommandOpen(false)}
                aria-label="Close quick navigation"
              >
                <X />
              </button>
            </header>
            <div className="command-caption">
              <span>
                <Command />
                Quick links
              </span>
              <small>Select a destination</small>
            </div>
            <div className="command-results">
              {commandLinks.map(([to, Icon, label], index) => (
                <button
                  key={to}
                  className={index === 0 ? "is-first" : ""}
                  onClick={() => openCommandRoute(to)}
                >
                  <span>
                    <Icon />
                  </span>
                  <strong>{label}</strong>
                  <small>{to}</small>
                </button>
              ))}
              {!commandLinks.length && (
                <div className="command-empty">
                  <Search />
                  <strong>No matching page</strong>
                  <small>Try dashboard, tests, results or settings.</small>
                </div>
              )}
            </div>
            <footer>
              <span>
                <kbd>Ctrl K</kbd> toggle
              </span>
              <span>
                <kbd>esc</kbd> close
              </span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
