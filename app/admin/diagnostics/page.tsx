import DiagnosticsPanel from './components/DiagnosticsPanel';

export const metadata = {
  title: 'Domain Diagnostics',
  description: 'Debug and fix domain routing issues',
};

export default function DiagnosticsPage() {
  return (
    <div>
      <DiagnosticsPanel />
    </div>
  );
} 