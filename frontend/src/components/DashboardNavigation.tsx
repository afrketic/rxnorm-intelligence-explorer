export type DashboardKey =
  | 'overview'
  | 'claims'
  | 'ai'
  | 'clinical'
  | 'knowledgeGraph';

type DashboardNavigationProps = {
  activeDashboard: DashboardKey;
  onDashboardChange: (dashboard: DashboardKey) => void;
};

const DASHBOARDS: { key: DashboardKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'claims', label: 'Claims Readiness' },
  { key: 'ai', label: 'AI Readiness' },
  { key: 'clinical', label: 'Clinical Intelligence' },
  { key: 'knowledgeGraph', label: 'Knowledge Graph' },
];

export default function DashboardNavigation({
  activeDashboard,
  onDashboardChange,
}: DashboardNavigationProps) {
  return (
    <nav className="dashboard-navigation" aria-label="RxNorm intelligence dashboards">
      {DASHBOARDS.map((dashboard) => {
        const isActive = dashboard.key === activeDashboard;

        return (
          <button
            key={dashboard.key}
            type="button"
            className={`dashboard-navigation__button${isActive ? ' dashboard-navigation__button--active' : ''}`}
            onClick={() => onDashboardChange(dashboard.key)}
          >
            {dashboard.label}
          </button>
        );
      })}
    </nav>
  );
}
