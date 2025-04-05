'use client';

interface ViewRootPageButtonProps {
  domainName: string;
}

export default function ViewRootPageButton({
  domainName,
}: ViewRootPageButtonProps) {
  const handleClick = () => {
    window.open(`https://${domainName}`, '_blank');
  };

  return (
    <button
      className="inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded text-green-300 bg-dark-light hover:bg-dark transition-colors duration-150"
      onClick={handleClick}
    >
      View Root Page
    </button>
  );
} 