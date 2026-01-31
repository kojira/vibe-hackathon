import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { JudgeLayout } from './components/JudgeLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainPage } from './pages/MainPage';
import { SettingsPage } from './pages/SettingsPage';
import { HistoryPage } from './pages/HistoryPage';
import { GatePage } from './pages/GatePage';
import { JudgePage } from './pages/JudgePage';
import { ControlPage } from './pages/ControlPage';
import { AdminPage } from './pages/AdminPage';
import { MePage } from './pages/MePage';
import { ResultsPage } from './pages/ResultsPage';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* 既存ルート（テーマ生成機能） - 管理者のみ */}
          <Route element={<Layout />}>
            <Route path="/" element={
              <ProtectedRoute requireAdmin>
                <MainPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute requireAdmin>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/history" element={
              <ProtectedRoute requireAdmin>
                <HistoryPage />
              </ProtectedRoute>
            } />
          </Route>

          {/* 審査システムルート */}
          <Route element={<JudgeLayout />}>
            <Route path="/gate" element={<GatePage />} />
            <Route path="/judge" element={
              <ProtectedRoute requireLogin>
                <JudgePage />
              </ProtectedRoute>
            } />
            <Route path="/results" element={
              <ProtectedRoute requireLogin>
                <ResultsPage />
              </ProtectedRoute>
            } />
            <Route path="/control" element={
              <ProtectedRoute requireAdmin>
                <ControlPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminPage />
              </ProtectedRoute>
            } />
            <Route path="/me" element={<MePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
