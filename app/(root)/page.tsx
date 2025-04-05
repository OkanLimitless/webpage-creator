import Link from 'next/link';

export default function RootPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-center mb-6">
            <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z"></path>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Welcome to Webpage Creator</h1>
          <p className="text-gray-600 text-center mb-6">
            Your tool for creating landing pages and root domain pages quickly and easily.
          </p>
          <div className="space-y-4">
            <div className="rounded-md bg-blue-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3 flex-1 md:flex md:justify-between">
                  <p className="text-sm text-blue-700">
                    You're viewing the app directly. If you're looking for a landing page, please use the right subdomain.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-center">
              <Link href="/" className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4">
          <p className="text-xs text-gray-500 text-center">
            If you're looking for a specific landing page, please use the subdomain format: landing.yourdomain.com
          </p>
        </div>
      </div>
    </div>
  );
} 