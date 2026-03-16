"use client";

interface LevelBadgeProps {
  level: string;
  simple?: boolean;
}

const LEVEL_DISPLAY: Record<string, string> = {
  'ALL': 'ALL',
  'BEGINNER': 'Beginner',
  'INTERMEDIATE': 'Intermediate',
  'ADVANCED': 'Advanced',
};

export const LevelBadge = ({ level, simple = false }: LevelBadgeProps) => {
  if (!level) return null;

  let colorClass = "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400";
  let dotColor = "bg-neutral-400 dark:bg-neutral-400";
  const upperLevel = level.toUpperCase();
  
  if (upperLevel === "BEGINNER" || level === "Beginner") { 
    colorClass = "bg-green-500/10 dark:bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20 dark:border-green-500/20"; 
    dotColor = "bg-green-500 dark:bg-green-500"; 
  }
  if (upperLevel === "INTERMEDIATE" || level === "Intermediate") {
    colorClass = "bg-yellow-500/10 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border border-yellow-500/20 dark:border-yellow-500/20";
    dotColor = "bg-yellow-500 dark:bg-yellow-500";
  }
  if (upperLevel === "ADVANCED" || level === "Advanced" || level === "Master") { 
    colorClass = "bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20 dark:border-red-500/20"; 
    dotColor = "bg-red-500 dark:bg-red-500"; 
  }
  if (upperLevel === "ALL" || level === "All Level") { 
    colorClass = "bg-blue-500/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20 dark:border-blue-500/20"; 
    dotColor = "bg-blue-500 dark:bg-blue-500"; 
  }
  if (level === "Open") { 
    colorClass = "bg-purple-500/10 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 border border-purple-500/20 dark:border-purple-500/20"; 
    dotColor = "bg-purple-500 dark:bg-purple-500"; 
  }

  const displayLabel = LEVEL_DISPLAY[upperLevel] || level;

  if (simple) return <div className={`w-2 h-2 rounded-full ${dotColor}`} />;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colorClass}`}>{displayLabel}</span>;
};











