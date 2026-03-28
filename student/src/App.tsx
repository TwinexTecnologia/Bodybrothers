import {
  BrowserRouter,
  Route,
  Routes,
  Navigate,
  Outlet,
} from "react-router-dom";
import { createContext, useEffect, useState, type ReactNode } from "react";
import Login from "./pages/Auth/Login";
import Overview from "./pages/Dashboard/Overview";
import ListWorkouts from "./pages/Workouts/ListWorkouts";
import ListDiets from "./pages/Diets/ListDiets";
import ListAnamnesis from "./pages/Anamnesis/ListAnamnesis";
import PhotoEvolution from "./pages/Evolution/PhotoEvolution";
import ListPendences from "./pages/Financial/ListPendences";
import Profile from "./pages/Account/Profile";
import Layout from "./components/Layout";
import { AuthProvider } from "./auth/AuthContext";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Modal from "./components/Modal";

import { useAuth } from "./auth/useAuth";
import {
  detectDeviceFromUserAgent,
  getRuntimeUserAgent,
} from "./mobile/deviceDetection";

type MobileDeviceContextValue = {
  isMobile: boolean;
  isAndroid: boolean;
  ready: boolean;
};

export const MobileDeviceContext = createContext<MobileDeviceContextValue>({
  isMobile: false,
  isAndroid: false,
  ready: false,
});

export const ANDROID_TESTERS_URL = "https://fitbody-pro-testers.onrender.com";
export const ANDROID_PROMO_DISMISSED_KEY =
  "fitbody_pro_android_promo_dismissed_v1";

export function MobileAppPromoProvider({ children }: { children: ReactNode }) {
  const [device, setDevice] = useState<MobileDeviceContextValue>({
    isMobile: false,
    isAndroid: false,
    ready: false,
  });
  const [isPromoOpen, setIsPromoOpen] = useState(false);

  useEffect(() => {
    const ua = getRuntimeUserAgent();
    const detected = detectDeviceFromUserAgent(ua);
    setDevice({ ...detected, ready: true });

    console.log("Detected: ", detected);

    if (!detected.isAndroid) return;
    setIsPromoOpen(true);
  }, []);

  const dismiss = () => {
    setIsPromoOpen(false);
    try {
      localStorage.setItem(ANDROID_PROMO_DISMISSED_KEY, "1");
    } catch {}
  };

  const openTesterPage = () => {
    try {
      window.open(ANDROID_TESTERS_URL, "_blank", "noopener,noreferrer");
    } finally {
      dismiss();
    }
  };

  return (
    <MobileDeviceContext.Provider value={device}>
      {children}
      <Modal
        isOpen={isPromoOpen}
        onClose={dismiss}
        title="Versão mobile disponível!"
        footer={
          <>
            <button
              onClick={dismiss}
              style={{
                background: "#fff",
                border: "1px solid #e2e8f0",
                color: "#64748b",
                padding: "8px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              Agora não
            </button>
            <button
              onClick={openTesterPage}
              style={{
                background: "#0ea5e9",
                border: "none",
                color: "#fff",
                padding: "8px 16px",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 600,
                boxShadow: "0 2px 4px rgba(14, 165, 233, 0.3)",
              }}
            >
              Ver como testar
            </button>
          </>
        }
      >
        <div style={{ textAlign: "center", padding: "8px 0" }}>
          <p style={{ margin: 0, color: "#475569", fontSize: "0.95rem" }}>
            Detectamos um dispositivo Android. Se quiser testar a versão mobile
            do app, siga o passo a passo de cadastro como tester.
          </p>
        </div>
      </Modal>
    </MobileDeviceContext.Provider>
  );
}

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div>Carregando...</div>;

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />

      {/* Rotas Protegidas com Layout Persistente */}
      <Route element={<ProtectedLayout />}>
        <Route path="/dashboard" element={<Overview />} />
        <Route path="/workouts" element={<ListWorkouts />} />
        <Route path="/diets" element={<ListDiets />} />
        <Route path="/anamnesis" element={<ListAnamnesis />} />
        <Route path="/evolution" element={<PhotoEvolution />} />
        <Route path="/financial" element={<ListPendences />} />
        <Route path="/account/profile" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <MobileAppPromoProvider>
            <AppRoutes />
          </MobileAppPromoProvider>
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
