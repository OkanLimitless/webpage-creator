import DiagnosticsPanel from './components/DiagnosticsPanel';

export const metadata = {
  title: 'Domain Diagnostics',
  description: 'Debug and fix domain routing issues',
};

export default function DiagnosticsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Domain Diagnostics</h1>
      </div>
      <p className="mb-6 text-gray-600">
        This dashboard provides tools to help diagnose and fix domain routing issues, 
        including tools to test domain parsing, check DNS configurations, and fix common problems.
      </p>
      <DiagnosticsPanel />
    </div>
  );
} 