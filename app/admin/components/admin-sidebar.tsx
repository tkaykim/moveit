"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  User,
  BookOpen,
  ChevronRight,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

interface MenuItem {
  title: string;
  icon: LucideIcon;
  href?: string;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  {
    title: '학원 관리',
    icon: Building2,
    href: '/admin/academies',
  },
  {
    title: '강사 관리',
    icon: User,
    href: '/admin/instructors',
  },
  {
    title: '클래스 관리',
    icon: BookOpen,
    href: '/admin/classes',
  },
  {
    title: '사용자 관리',
    icon: Users,
    href: '/admin/users',
  },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);

  const toggleMenu = (title: string) => {
    setExpandedMenus((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title]
    );
  };

  const isActive = (href?: string) => {
    if (!href) return false;
    return pathname === href;
  };

  const isParentActive = (children?: MenuItem[]) => {
    if (!children) return false;
    return children.some((child) => isActive(child.href));
  };

  return (
    <div className="w-64 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 h-screen sticky top-0 overflow-y-auto">
      <div className="p-6 border-b border-neutral-200 dark:border-neutral-800">
        <Link href="/admin" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary dark:bg-[#CCFF00] rounded-lg flex items-center justify-center">
            <Building2 className="text-black w-5 h-5" />
          </div>
          <span className="text-lg font-bold text-black dark:text-white">
            관리자
          </span>
        </Link>
      </div>

      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasChildren = item.children && item.children.length > 0;
          const isExpanded = expandedMenus.includes(item.title);
          const isParentActiveState = isParentActive(item.children);

          if (hasChildren) {
            return (
              <div key={item.title}>
                <button
                  onClick={() => toggleMenu(item.title)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                    isParentActiveState
                      ? 'bg-primary/10 dark:bg-[#CCFF00]/10 text-primary dark:text-[#CCFF00]'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={20} />
                    <span className="font-medium">{item.title}</span>
                  </div>
                  <ChevronRight
                    size={16}
                    className={`transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div className="ml-4 mt-1 space-y-1">
                    {item.children!.map((child) => {
                      const ChildIcon = child.icon;
                      const active = isActive(child.href);
                      return (
                        <Link
                          key={child.title}
                          href={child.href!}
                          className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                            active
                              ? 'bg-primary dark:bg-[#CCFF00] text-black font-medium'
                              : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                          }`}
                        >
                          <ChildIcon size={18} />
                          <span>{child.title}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isActive(item.href);
          return (
            <Link
              key={item.title}
              href={item.href!}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                active
                  ? 'bg-primary dark:bg-[#CCFF00] text-black font-medium'
                  : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium">{item.title}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

