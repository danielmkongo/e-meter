import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext.jsx';
import { ThemeProvider } from './ThemeContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Fleet from './pages/Fleet.jsx';
import Inspect from './pages/Inspect.jsx';
import Compare from './pages/Compare.jsx';
import Energy from './pages/Energy.jsx';
import Data from './pages/Data.jsx';
import Turbines from './pages/Turbines.jsx';
import Firmware from './pages/Firmware.jsx';

function ProtectedRoutes() {
  const { user } = useAuth();

  if (user === undefined) {
    return (
      <div className="grid h-screen place-items-center bg-bg">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-accent" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Fleet />} />
        <Route path="/inspect/:id?" element={<Inspect />} />
        <Route path="/compare"   element={<Compare />} />
        <Route path="/energy"    element={<Energy />} />
        <Route path="/data"      element={<Data />} />
        <Route path="/turbines"  element={<Turbines />} />
        <Route path="/firmware"  element={<Firmware />} />
        {/* old routes */}
        <Route path="/analytics" element={<Navigate to="/compare" replace />} />
        <Route path="/history"   element={<Navigate to="/data" replace />} />
        <Route path="/ota"       element={<Navigate to="/firmware" replace />} />
        <Route path="*"          element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function LoginRoute() {
  const { user } = useAuth();
  if (user) return <Navigate to="/" replace />;
  return <Login />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/*"     element={<ProtectedRoutes />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
