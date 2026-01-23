"use client";

interface TicketOptionBadgeProps {
  classes: Array<{
    title: string;
    instructor?: {
      name_kr?: string | null;
      name_en?: string | null;
    } | null;
  }>;
  className?: string;
}

export function TicketOptionBadge({ classes, className = '' }: TicketOptionBadgeProps) {
  if (!classes || classes.length === 0) {
    return <span className={className}>-</span>;
  }

  const firstClass = classes[0];
  const instructorName = firstClass.instructor
    ? firstClass.instructor.name_kr || firstClass.instructor.name_en || ''
    : '';
  
  const displayName = instructorName
    ? `${instructorName} (${firstClass.title})`
    : firstClass.title;

  if (classes.length === 1) {
    return <span className={className}>{displayName}</span>;
  }

  return (
    <span className={className}>
      {displayName} 외 {classes.length - 1}건
    </span>
  );
}
