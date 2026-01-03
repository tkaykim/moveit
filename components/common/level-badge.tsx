"use client";

interface LevelBadgeProps {
  level: string;
  simple?: boolean;
}

export const LevelBadge = ({ level, simple = false }: LevelBadgeProps) => {
  let colorClass = "bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400";
  let dotColor = "bg-neutral-400 dark:bg-neutral-400";
  
  if (level === "Beginner") { 
    colorClass = "bg-green-500/10 dark:bg-green-500/10 text-green-600 dark:text-green-500 border border-green-500/20 dark:border-green-500/20"; 
    dotColor = "bg-green-500 dark:bg-green-500"; 
  }
  if (level === "Master") { 
    colorClass = "bg-red-500/10 dark:bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20 dark:border-red-500/20"; 
    dotColor = "bg-red-500 dark:bg-red-500"; 
  }
  if (level === "All Level") { 
    colorClass = "bg-blue-500/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-500 border border-blue-500/20 dark:border-blue-500/20"; 
    dotColor = "bg-blue-500 dark:bg-blue-500"; 
  }
  if (level === "Open") { 
    colorClass = "bg-purple-500/10 dark:bg-purple-500/10 text-purple-600 dark:text-purple-500 border border-purple-500/20 dark:border-purple-500/20"; 
    dotColor = "bg-purple-500 dark:bg-purple-500"; 
  }

  if (simple) return <div className={`w-2 h-2 rounded-full ${dotColor}`} />;
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${colorClass}`}>{level}</span>;
};




