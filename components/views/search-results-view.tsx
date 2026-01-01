"use client";

import Image from 'next/image';
import { Search, X, MapPin, Star, Heart } from 'lucide-react';
import { useState, useEffect } from 'react';
import { searchAll, SearchResult } from '@/lib/utils/search';
import { Academy, Dancer } from '@/types';

interface SearchResultsViewProps {
  query: string;
  onBack: () => void;
  onAcademyClick: (academy: Academy) => void;
  onDancerClick: (dancer: Dancer) => void;
}

export const SearchResultsView = ({ query, onBack, onAcademyClick, onDancerClick }: SearchResultsViewProps) => {
  const [results, setResults] = useState<SearchResult>({ academies: [], instructors: [], genres: [] });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'academies' | 'instructors'>('all');

  useEffect(() => {
    async function performSearch() {
      setLoading(true);
      const searchResults = await searchAll(query);
      setResults(searchResults);
      setLoading(false);
    }

    if (query.trim()) {
      performSearch();
    } else {
      setResults({ academies: [], instructors: [], genres: [] });
      setLoading(false);
    }
  }, [query]);

  const totalResults = results.academies.length + results.instructors.length;

  if (loading) {
    return (
      <div className="pb-24 pt-12 animate-in fade-in">
        <div className="text-center py-12 text-neutral-500">검색 중...</div>
      </div>
    );
  }

  return (
    <div className="pb-24 pt-12 animate-in fade-in">
      {/* 검색바 */}
      <div className="px-5 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          <input 
            type="text" 
            value={query}
            readOnly
            className="w-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full py-3 pl-10 pr-10 text-sm text-black dark:text-white"
          />
          <button 
            onClick={onBack}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            <X className="text-neutral-500" size={18} />
          </button>
        </div>
      </div>

      {/* 결과 탭 */}
      {totalResults > 0 && (
        <div className="px-5 mb-4">
          <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-800">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'all'
                  ? 'border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400'
              }`}
            >
              전체 ({totalResults})
            </button>
            <button
              onClick={() => setActiveTab('academies')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'academies'
                  ? 'border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400'
              }`}
            >
              학원 ({results.academies.length})
            </button>
            <button
              onClick={() => setActiveTab('instructors')}
              className={`px-4 py-2 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'instructors'
                  ? 'border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
                  : 'border-transparent text-neutral-500 dark:text-neutral-400'
              }`}
            >
              강사 ({results.instructors.length})
            </button>
          </div>
        </div>
      )}

      {/* 검색 결과 */}
      <div className="px-5">
        {totalResults === 0 ? (
          <div className="text-center py-12">
            <div className="text-neutral-500 dark:text-neutral-400 mb-2">검색 결과가 없습니다</div>
            <div className="text-sm text-neutral-400 dark:text-neutral-500">다른 검색어를 시도해보세요</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 학원 결과 */}
            {(activeTab === 'all' || activeTab === 'academies') && results.academies.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white mb-3">학원</h3>
                <div className="space-y-3">
                  {results.academies.map(academy => (
                    <div
                      key={academy.id}
                      onClick={() => onAcademyClick(academy)}
                      className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 active:scale-[0.98] transition-transform"
                    >
                      <div className="h-32 relative overflow-hidden">
                        <Image
                          src={academy.logo_url || `https://picsum.photos/seed/academy${academy.id}/400/128`}
                          alt={academy.name}
                          fill
                          className="object-cover"
                        />
                        {academy.tags && (
                          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-white font-bold">
                            {academy.tags.split(',')[0]?.trim() || ''}
                          </div>
                        )}
                      </div>
                      <div className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="text-lg font-bold text-black dark:text-white">{academy.name}</h4>
                            {academy.branch && (
                              <div className="flex items-center gap-1 text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                                <MapPin size={12} />
                                {academy.branch}
                              </div>
                            )}
                          </div>
                        </div>
                        {academy.price && (
                          <div className="text-sm font-bold text-primary dark:text-[#CCFF00]">
                            {academy.price.toLocaleString()}원~
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 강사 결과 */}
            {(activeTab === 'all' || activeTab === 'instructors') && results.instructors.length > 0 && (
              <div>
                <h3 className="text-lg font-bold text-black dark:text-white mb-3">강사</h3>
                <div className="grid grid-cols-2 gap-3">
                  {results.instructors.map(dancer => (
                    <div
                      key={dancer.id}
                      onClick={() => onDancerClick(dancer)}
                      className="relative aspect-[3/4] rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800 group active:scale-[0.98] transition-all"
                    >
                      <Image
                        src={dancer.img || `https://picsum.photos/seed/dancer${dancer.id}/300/400`}
                        alt={dancer.name}
                        fill
                        className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                      <div className="absolute top-3 right-3">
                        <button className="w-8 h-8 bg-black/30 backdrop-blur rounded-full flex items-center justify-center">
                          <Heart size={14} className="text-white" />
                        </button>
                      </div>
                      <div className="absolute bottom-4 left-4">
                        {dancer.crew && (
                          <span className="text-[10px] text-primary dark:text-[#CCFF00] font-bold border border-primary/30 dark:border-[#CCFF00]/30 px-1.5 py-0.5 rounded mb-1 inline-block">
                            {dancer.crew}
                          </span>
                        )}
                        <h4 className="text-lg font-black text-white leading-none">{dancer.name}</h4>
                        <p className="text-xs text-neutral-300 dark:text-neutral-400 mt-1">
                          {dancer.genre || 'ALL'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

