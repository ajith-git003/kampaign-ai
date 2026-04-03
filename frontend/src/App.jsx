// Kampaign.ai — AI-native campaign engine
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./ThemeContext";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Creatives from "./pages/Creatives";
import Strategy from "./pages/Strategy";
import Analytics from "./pages/Analytics";

function Layout() {
  return (
    <div
      className="flex min-h-screen font-sans"
      style={{ background: "var(--k-bg)", color: "var(--k-text)" }}
    >
      <Sidebar />

      {/* Main content area offset by sidebar width */}
      <div className="flex flex-col flex-1" style={{ marginLeft: 210 }}>
        <main className="flex-1 px-8 py-8 max-w-6xl w-full">
          <Routes>
            <Route path="/"           element={<Dashboard />} />
            <Route path="/analytics"  element={<Analytics />} />
            <Route path="/strategy"   element={<Strategy />} />
            <Route path="/creatives"  element={<Creatives />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
