import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import { Landing, AuthPage } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { NewResearch } from './pages/NewResearch';
import { LiveResearch } from './pages/LiveResearch';
import { ReportViewer } from './pages/Report';
import { Sources, Evidence } from './pages/Explorers';
import { Graph } from './pages/Graph';
import { Settings } from './pages/Settings';

const qc = new QueryClient();
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/research/new" element={<NewResearch />} />
          <Route path="/research/:id" element={<LiveResearch />} />
          <Route path="/report/:id" element={<ReportViewer />} />
          <Route path="/report/demo" element={<ReportViewer demo />} />
          <Route path="/sources/:id" element={<Sources />} />
          <Route path="/evidence/:id" element={<Evidence />} />
          <Route path="/graph/:id" element={<Graph />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
