import { Plus } from 'lucide-react';

interface SectionHeaderProps {
  title: string;
  buttonText?: string;
  onButtonClick?: () => void;
}

export function SectionHeader({ title, buttonText, onButtonClick }: SectionHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-white">{title}</h2>
      {buttonText && (
        <button
          onClick={onButtonClick}
          className="bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-gray-200 text-white dark:text-gray-900 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={16} /> {buttonText}
        </button>
      )}
    </div>
  );
}








