import { type ReactNode, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import StatusBar from './StatusBar';
import { useAppStore } from '@/stores/app.store';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const sidebarCollapsed = useAppStore((s) => s.sidebarCollapsed);
  const setSidebarCollapsed = useAppStore((s) => s.setSidebarCollapsed);

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed(!sidebarCollapsed);
  }, [sidebarCollapsed, setSidebarCollapsed]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-studio-bg">
      {/* Top bar */}
      <TopBar onToggleSidebar={toggleSidebar} />

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        <PanelGroup direction="horizontal" autoSaveId="app-layout">
          {/* Sidebar */}
          {!sidebarCollapsed && (
            <>
              <Panel
                id="sidebar"
                defaultSize={15}
                minSize={10}
                maxSize={25}
                className="flex flex-col"
              >
                <Sidebar />
              </Panel>
              <PanelResizeHandle className="panel-divider w-px hover:w-0.5 transition-all" />
            </>
          )}

          {/* Main content */}
          <Panel id="main" className="flex flex-col overflow-hidden">
            <main className="flex-1 overflow-auto">{children}</main>
          </Panel>
        </PanelGroup>
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
