interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles: Record<string, string> = {
    수강중: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
    휴면: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
    만료예정: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
    상담대기: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
    Active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
    'On Leave': 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
  };

  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
        styles[status] || 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
      }`}
    >
      {status}
    </span>
  );
}


