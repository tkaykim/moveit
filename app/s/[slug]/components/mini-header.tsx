import Link from 'next/link';
import Image from 'next/image';

export function MiniHeader({ slug, name, logoUrl }: { slug: string; name: string; logoUrl: string | null }) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-sm border-b border-neutral-100 dark:border-neutral-800">
      <Link href={`/s/${slug}`} className="flex items-center gap-2.5 px-5 py-3.5">
        {logoUrl ? (
          <Image src={logoUrl} alt={name} width={32} height={32} className="w-8 h-8 rounded-lg object-cover" />
        ) : (
          <span
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            {name.slice(0, 1)}
          </span>
        )}
        <span className="text-base font-bold tracking-tight truncate">{name}</span>
      </Link>
    </header>
  );
}
