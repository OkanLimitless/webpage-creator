import './globals.css';

export const metadata = {
  title: 'Webpage Creator',
  description: 'Create landing pages with cookie consent overlays',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-gray-900 min-h-screen text-gray-200">
        {children}
      </body>
    </html>
  );
} 