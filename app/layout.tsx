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
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">
        {children}
      </body>
    </html>
  );
} 