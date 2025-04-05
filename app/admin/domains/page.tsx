import DomainsList from './DomainsList';

export const metadata = {
  title: 'Domain Management',
  description: 'Manage your domains and root pages',
};

export default function DomainsPage() {
  return (
    <div>
      <DomainsList />
    </div>
  );
} 