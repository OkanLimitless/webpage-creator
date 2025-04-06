import DomainsList from './DomainsList';
import Link from 'next/link';

export const metadata = {
  title: 'Domain Management',
  description: 'Manage your domains and root pages',
};

export default function DomainsPage() {
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Domain Management</h1>
        <Link 
          href="/admin/diagnostics" 
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-500 hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Domain Diagnostics
        </Link>
      </div>
      <DomainsList />
    </div>
  );
} 