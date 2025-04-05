import { redirect } from 'next/navigation';

export default function AdminPage() {
  // Redirect to the domains page
  redirect('/admin/domains');
} 