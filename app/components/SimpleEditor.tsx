'use client';

import { useState, useEffect } from 'react';

interface SimpleEditorProps {
  initialContent: string;
  placeholder?: string;
  onChange: (content: string) => void;
}

export default function SimpleEditor({ initialContent = '', placeholder = 'Enter content here...', onChange }: SimpleEditorProps) {
  const [content, setContent] = useState(initialContent);
  
  // Update the parent when content changes
  useEffect(() => {
    onChange(content);
  }, [content, onChange]);
  
  return (
    <div className="w-full">
      <div className="bg-gray-100 border-b border-gray-300 p-2 flex space-x-2">
        <button
          type="button"
          onClick={() => {
            const textarea = document.getElementById('simple-editor-textarea') as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = content.substring(start, end);
            const newContent = content.substring(0, start) + `<h2>${selectedText}</h2>` + content.substring(end);
            setContent(newContent);
            
            // Restore cursor position
            setTimeout(() => {
              textarea.focus();
              textarea.selectionStart = start + 4;
              textarea.selectionEnd = start + 4 + selectedText.length;
            }, 0);
          }}
          className="p-1 hover:bg-gray-200 rounded"
          title="Heading"
        >
          H
        </button>
        
        <button
          type="button"
          onClick={() => {
            const textarea = document.getElementById('simple-editor-textarea') as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = content.substring(start, end);
            const newContent = content.substring(0, start) + `<b>${selectedText}</b>` + content.substring(end);
            setContent(newContent);
            
            // Restore cursor position
            setTimeout(() => {
              textarea.focus();
              textarea.selectionStart = start + 3;
              textarea.selectionEnd = start + 3 + selectedText.length;
            }, 0);
          }}
          className="font-bold p-1 hover:bg-gray-200 rounded"
          title="Bold"
        >
          B
        </button>
        
        <button
          type="button"
          onClick={() => {
            const textarea = document.getElementById('simple-editor-textarea') as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = content.substring(start, end);
            const newContent = content.substring(0, start) + `<i>${selectedText}</i>` + content.substring(end);
            setContent(newContent);
            
            // Restore cursor position
            setTimeout(() => {
              textarea.focus();
              textarea.selectionStart = start + 3;
              textarea.selectionEnd = start + 3 + selectedText.length;
            }, 0);
          }}
          className="italic p-1 hover:bg-gray-200 rounded"
          title="Italic"
        >
          I
        </button>
        
        <span className="border-r border-gray-300 h-6 mx-1"></span>
        
        <button
          type="button"
          onClick={() => {
            const textarea = document.getElementById('simple-editor-textarea') as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = content.substring(start, end);
            const url = prompt('Enter URL:', 'https://');
            if (url) {
              const newContent = content.substring(0, start) + `<a href="${url}">${selectedText || url}</a>` + content.substring(end);
              setContent(newContent);
              
              // Restore cursor position
              setTimeout(() => {
                textarea.focus();
                textarea.selectionStart = start + `<a href="${url}">`.length;
                textarea.selectionEnd = start + `<a href="${url}">`.length + (selectedText || url).length;
              }, 0);
            }
          }}
          className="p-1 hover:bg-gray-200 rounded"
          title="Link"
        >
          🔗
        </button>
        
        <button
          type="button"
          onClick={() => {
            const url = prompt('Enter image URL:', 'https://');
            if (url) {
              const alt = prompt('Enter image description:', '') || '';
              const newContent = content + `<img src="${url}" alt="${alt}" />`;
              setContent(newContent);
            }
          }}
          className="p-1 hover:bg-gray-200 rounded"
          title="Image"
        >
          🖼️
        </button>
        
        <span className="border-r border-gray-300 h-6 mx-1"></span>
        
        <button
          type="button"
          onClick={() => {
            const textarea = document.getElementById('simple-editor-textarea') as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = content.substring(start, end);
            const lines = selectedText.split('\n');
            const listItems = lines.map(line => line ? `<li>${line}</li>` : '').join('\n');
            const newContent = content.substring(0, start) + `<ul>\n${listItems}\n</ul>` + content.substring(end);
            setContent(newContent);
          }}
          className="p-1 hover:bg-gray-200 rounded"
          title="Bullet List"
        >
          •
        </button>
        
        <button
          type="button"
          onClick={() => {
            const textarea = document.getElementById('simple-editor-textarea') as HTMLTextAreaElement;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const selectedText = content.substring(start, end);
            const newContent = content.substring(0, start) + `<div class="my-4 p-4 bg-gray-100 border border-gray-300 rounded">${selectedText}</div>` + content.substring(end);
            setContent(newContent);
          }}
          className="p-1 hover:bg-gray-200 rounded"
          title="Add Box"
        >
          □
        </button>
      </div>
      
      <textarea
        id="simple-editor-textarea"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder}
        className="w-full p-4 min-h-[300px] outline-none border-none"
        rows={12}
      />
      
      {/* Preview section */}
      <div className="border-t border-gray-300 mt-4 pt-4">
        <div className="text-sm font-medium text-gray-700 mb-2">Preview:</div>
        <div 
          className="bg-white border border-gray-200 rounded-md p-4 prose max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  );
} 