'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import SimpleEditor from '@/app/components/SimpleEditor';

interface FormData {
  title: string;
  description: string;
  content: string;
  isActive: boolean;
  metaTags: string[];
  redirectWwwToNonWww: boolean;
  customHead: string;
  customCss: string;
}

interface RootPageFormProps {
  domainId: string;
  initialData?: FormData;
  isEdit?: boolean;
}

export default function RootPageForm({ domainId, initialData, isEdit = false }: RootPageFormProps) {
  const router = useRouter();

  const [formData, setFormData] = useState<FormData>(
    initialData || {
      title: '',
      description: '',
      content: '',
      isActive: true,
      metaTags: [],
      redirectWwwToNonWww: true,
      customHead: '',
      customCss: '',
    }
  );
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metaTagInput, setMetaTagInput] = useState('');

  // Handle form input changes
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Handle content changes from the editor
  const handleContentChange = (newContent: string) => {
    setFormData(prev => ({
      ...prev,
      content: newContent
    }));
  };

  // Add a meta tag
  const addMetaTag = () => {
    if (!metaTagInput.trim()) return;
    
    setFormData(prev => ({
      ...prev,
      metaTags: [...prev.metaTags, metaTagInput.trim()]
    }));
    
    setMetaTagInput('');
  };

  // Remove a meta tag
  const removeMetaTag = (index: number) => {
    setFormData(prev => ({
      ...prev,
      metaTags: prev.metaTags.filter((_, i) => i !== index)
    }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    
    try {
      const endpoint = isEdit
        ? `/api/root-pages/${domainId}`
        : '/api/root-pages';
      
      const method = isEdit ? 'PUT' : 'POST';
      
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          domainId,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Something went wrong');
      }
      
      router.push('/admin/domains');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded relative">
          {error}
        </div>
      )}
      
      {/* Basic Information */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Page Title
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Meta Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">
              A brief description of your page. This will be used for SEO purposes.
            </p>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="isActive"
              name="isActive"
              checked={formData.isActive}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isActive" className="ml-2 block text-sm text-gray-700">
              Page is active and publicly visible
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="redirectWwwToNonWww"
              name="redirectWwwToNonWww"
              checked={formData.redirectWwwToNonWww}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="redirectWwwToNonWww" className="ml-2 block text-sm text-gray-700">
              Redirect www to non-www version (recommended for SEO)
            </label>
          </div>
        </div>
      </div>
      
      {/* Page Content */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Page Content</h3>
        
        <div className="border border-gray-300 rounded-md overflow-hidden">
          <SimpleEditor 
            initialContent={formData.content} 
            onChange={handleContentChange}
            placeholder="Enter your page content here..."
          />
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Design your page content. You can use the toolbar to format text, add links, and more.
        </p>
      </div>
      
      {/* Meta Tags */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Meta Tags</h3>
        
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={metaTagInput}
              onChange={(e) => setMetaTagInput(e.target.value)}
              placeholder="Add a meta tag (e.g., keywords, robots)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={addMetaTag}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Add
            </button>
          </div>
          
          {formData.metaTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.metaTags.map((tag, index) => (
                <div key={index} className="flex items-center bg-gray-100 px-3 py-1 rounded-full">
                  <span className="text-sm text-gray-800">{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeMetaTag(index)}
                    className="ml-2 text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
          
          <p className="text-sm text-gray-500">
            Add meta tags to improve SEO. Examples: "keywords:product,service" or "robots:index,follow"
          </p>
        </div>
      </div>
      
      {/* Advanced Options */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Advanced Options</h3>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="customHead" className="block text-sm font-medium text-gray-700 mb-1">
              Custom Head HTML
            </label>
            <textarea
              id="customHead"
              name="customHead"
              value={formData.customHead}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="<script>...</script> or <link rel='stylesheet' href='...'>"
            />
            <p className="mt-1 text-sm text-gray-500">
              Add custom HTML to the &lt;head&gt; section (scripts, stylesheets, etc.)
            </p>
          </div>
          
          <div>
            <label htmlFor="customCss" className="block text-sm font-medium text-gray-700 mb-1">
              Custom CSS
            </label>
            <textarea
              id="customCss"
              name="customCss"
              value={formData.customCss}
              onChange={handleChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
              placeholder="body { ... } .custom-class { ... }"
            />
            <p className="mt-1 text-sm text-gray-500">
              Add custom CSS to style your page.
            </p>
          </div>
        </div>
      </div>
      
      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => router.back()}
          className="mr-4 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300"
        >
          {isSubmitting ? 'Saving...' : isEdit ? 'Update Page' : 'Create Page'}
        </button>
      </div>
    </form>
  );
} 