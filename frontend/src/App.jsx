// Kampaign.ai — AI-native campaign engine
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Creatives from "./pages/Creatives";
import Launch from "./pages/Launch";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-950 text-gray-100 font-sans">
        {/* Top navigation */}
        <nav className="border-b border-gray-800 px-6 py-4 flex items-center gap-8">
          <span className="text-xl font-bold tracking-tight">
            <span className="text-indigo-400">Kampaign</span>
            <span className="text-white">.ai</span>
          </span>

          <div className="flex gap-6 text-sm">
            {[
              { to: "/", label: "Dashboard" },
              { to: "/creatives", label: "Creatives" },
              { to: "/launch", label: "Launch" },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end
                className={({ isActive }) =>
                  isActive
                    ? "text-indigo-400 font-semibold"
                    : "text-gray-400 hover:text-white transition-colors"
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          <span className="ml-auto text-xs text-gray-500">AI-native campaign engine</span>
        </nav>

        {/* Page content */}
        <main className="px-6 py-8 max-w-6xl mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/creatives" element={<Creatives />} />
            <Route path="/launch" element={<Launch />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
