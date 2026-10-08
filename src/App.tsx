import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth";
import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { LeadDetailPage } from "./pages/LeadDetailPage";
import { LeadsPage } from "./pages/LeadsPage";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SearchLeadsPage } from "./pages/SearchLeadsPage";

export default function App() {
  return <BrowserRouter><AuthProvider><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
      <Route index element={<DashboardPage />} />
      <Route path="buscar" element={<SearchLeadsPage />} />
      <Route path="leads" element={<LeadsPage />} />
      <Route path="leads/:id" element={<LeadDetailPage />} />
      <Route path="aprovacoes" element={<PlaceholderPage title="Aprovações" step="a Etapa 4" />} />
      <Route path="crm" element={<PlaceholderPage title="CRM" step="a Etapa 4" />} />
      <Route path="follow-ups" element={<PlaceholderPage title="Follow-ups" step="a Etapa 4" />} />
      <Route path="relatorios" element={<PlaceholderPage title="Relatórios" step="a Etapa 5" />} />
      <Route path="configuracoes" element={<PlaceholderPage title="Configurações" step="as próximas etapas" />} />
    </Route>
    <Route path="*" element={<Navigate to="/app" replace />} />
  </Routes></AuthProvider></BrowserRouter>;
}
