"use client";

import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';

interface InstructorModalProps {
  academyId?: string;
  instructor?: any;
  onClose: () => void;
}

export function InstructorModal({ academyId, instructor, onClose }: InstructorModalProps) {
  const [isEditing, setIsEditing] = useState(!instructor); // 신규 등록이면 바로 편집 모드
  const [formData, setFormData] = useState({
    name_kr: '',
    name_en: '',
    bio: '',
    specialties: '',
    instagram_url: '',
  });
  const [loading, setLoading] = useState(false);

  // 앱 계정 연결
  const [linkedUser, setLinkedUser] = useState<{ id: string; email: string | null; name: string | null } | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; email: string | null; name: string | null }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (instructor) {
      setFormData({
        name_kr: instructor.name_kr || '',
        name_en: instructor.name_en || '',
        bio: instructor.bio || '',
        specialties: instructor.specialties || '',
        instagram_url: instructor.instagram_url || '',
      });
    } else {
      // 신규 등록인 경우 폼 초기화
      setFormData({
        name_kr: '',
        name_en: '',
        bio: '',
        specialties: '',
        instagram_url: '',
      });
    }
  }, [instructor]);

  const fetchLinkedUser = useCallback(async () => {
    if (!academyId || !instructor?.id) return;
    try {
      const res = await fetch(`/api/academy-admin/${academyId}/instructors/${instructor.id}/linked-user`);
      const data = await res.json();
      setLinkedUser(data.user ?? null);
    } catch {
      setLinkedUser(null);
    }
  }, [academyId, instructor?.id]);

  useEffect(() => {
    if (academyId && instructor?.id) fetchLinkedUser();
    else setLinkedUser(null);
  }, [academyId, instructor?.id, fetchLinkedUser]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      if (!academyId) return;
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/academy-admin/${academyId}/instructors/link-user/search?q=${encodeURIComponent(searchQuery)}`
        );
        const data = await res.json();
        setSearchResults(data.users ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, academyId]);

  const handleLinkUser = async (userId: string) => {
    if (!academyId || !instructor?.id) return;
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/academy-admin/${academyId}/instructors/${instructor.id}/link-user`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '연결에 실패했습니다.');
      await fetchLinkedUser();
      setSearchQuery('');
      setSearchResults([]);
      setSearchOpen(false);
    } catch (e: any) {
      alert(e.message || '연결에 실패했습니다.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleUnlinkUser = async () => {
    if (!academyId || !instructor?.id) return;
    if (!confirm('연결을 해제하시겠습니까?')) return;
    setLinkLoading(true);
    try {
      const res = await fetch(`/api/academy-admin/${academyId}/instructors/${instructor.id}/link-user`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '해제에 실패했습니다.');
      await fetchLinkedUser();
    } catch (e: any) {
      alert(e.message || '해제에 실패했습니다.');
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setLoading(false);
      return;
    }

    try {
      if (instructor) {
        // 수정
        const { error } = await supabase
          .from('instructors')
          .update(formData)
          .eq('id', instructor.id);

        if (error) throw error;
        alert('강사 정보가 수정되었습니다.');
      } else {
        // 신규 등록
        const { error } = await supabase.from('instructors').insert([formData]);

        if (error) throw error;
        alert('강사가 등록되었습니다.');
      }
      
      setIsEditing(false);
      onClose();
    } catch (error: any) {
      console.error('Error saving instructor:', error);
      alert(`강사 저장에 실패했습니다: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 신규 등록인 경우 바로 편집 모드로 표시
  if (!instructor && isEditing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white">강사 등록</h3>
            <button
              onClick={onClose}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 (한글) *
              </label>
              <input
                type="text"
                required
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_kr}
                onChange={(e) => setFormData({ ...formData, name_kr: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 (영문)
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                전문 분야
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="예: Hip-hop, Choreography"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                인스타그램 URL
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.instagram_url}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                소개
              </label>
              <textarea
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? '저장 중...' : '등록'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  if (!instructor) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b dark:border-neutral-800 flex justify-between items-center sticky top-0 bg-white dark:bg-neutral-900">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
            {instructor.name_kr || instructor.name_en || '강사 정보'}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X size={20} />
          </button>
        </div>

        {isEditing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 (한글)
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_kr}
                onChange={(e) => setFormData({ ...formData, name_kr: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                이름 (영문)
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.name_en}
                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                전문 분야
              </label>
              <input
                type="text"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.specialties}
                onChange={(e) => setFormData({ ...formData, specialties: e.target.value })}
                placeholder="예: Hip-hop, Choreography"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                인스타그램 URL
              </label>
              <input
                type="url"
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                value={formData.instagram_url}
                onChange={(e) => setFormData({ ...formData, instagram_url: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                소개
              </label>
              <textarea
                className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white"
                rows={4}
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              />
            </div>

            {academyId && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">앱 계정 연결</h4>
                {linkedUser ? (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800">
                    <span className="text-gray-800 dark:text-white">
                      {linkedUser.email ?? linkedUser.name ?? linkedUser.id}
                      {linkedUser.name && linkedUser.email && ` (${linkedUser.name})`}
                    </span>
                    <button
                      type="button"
                      onClick={handleUnlinkUser}
                      disabled={linkLoading}
                      className="shrink-0 px-3 py-1.5 text-sm border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                    >
                      {linkLoading ? '처리 중...' : '연결 해제'}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="이메일 또는 이름으로 검색 (2글자 이상)"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
                    />
                    {searchOpen && (searchQuery.length >= 2 || searchResults.length > 0) && (
                      <>
                        <div
                          className="fixed inset-0 z-0"
                          aria-hidden
                          onClick={() => setSearchOpen(false)}
                        />
                        <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg max-h-48 overflow-y-auto">
                          {searchLoading ? (
                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">검색 중...</div>
                          ) : searchResults.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                              {searchQuery.length >= 2 ? '검색 결과가 없습니다.' : '2글자 이상 입력하세요.'}
                            </div>
                          ) : (
                            searchResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleLinkUser(u.id)}
                                disabled={linkLoading}
                                className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 border-b dark:border-neutral-700 last:border-0 disabled:opacity-50"
                              >
                                {u.email ?? u.name ?? u.id}
                                {u.name && u.email && ` (${u.name})`}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
              >
                {loading ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">기본 정보</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">이름 (한글)</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instructor.name_kr || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">이름 (영문)</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instructor.name_en || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">전문 분야</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instructor.specialties || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">인스타그램</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {instructor.instagram_url ? (
                      <a
                        href={instructor.instagram_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {instructor.instagram_url}
                      </a>
                    ) : (
                      '-'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {instructor.bio && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">소개</h4>
                <p className="text-gray-800 dark:text-white">{instructor.bio}</p>
              </div>
            )}

            {academyId && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">앱 계정 연결</h4>
                {linkedUser ? (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-gray-50 dark:bg-neutral-800">
                    <span className="text-gray-800 dark:text-white">
                      {linkedUser.email ?? linkedUser.name ?? linkedUser.id}
                      {linkedUser.name && linkedUser.email && ` (${linkedUser.name})`}
                    </span>
                    <button
                      type="button"
                      onClick={handleUnlinkUser}
                      disabled={linkLoading}
                      className="shrink-0 px-3 py-1.5 text-sm border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50"
                    >
                      {linkLoading ? '처리 중...' : '연결 해제'}
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="이메일 또는 이름으로 검색 (2글자 이상)"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setSearchOpen(true);
                      }}
                      onFocus={() => setSearchOpen(true)}
                      className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-900 text-gray-900 dark:text-white text-sm"
                    />
                    {searchOpen && (searchQuery.length >= 2 || searchResults.length > 0) && (
                      <>
                        <div
                          className="fixed inset-0 z-0"
                          aria-hidden
                          onClick={() => setSearchOpen(false)}
                        />
                        <div className="absolute top-full left-0 right-0 mt-1 z-10 rounded-lg border dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg max-h-48 overflow-y-auto">
                          {searchLoading ? (
                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">검색 중...</div>
                          ) : searchResults.length === 0 ? (
                            <div className="p-3 text-sm text-gray-500 dark:text-gray-400">
                              {searchQuery.length >= 2 ? '검색 결과가 없습니다.' : '2글자 이상 입력하세요.'}
                            </div>
                          ) : (
                            searchResults.map((u) => (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => handleLinkUser(u.id)}
                                disabled={linkLoading}
                                className="w-full text-left px-3 py-2 text-sm text-gray-800 dark:text-white hover:bg-gray-100 dark:hover:bg-neutral-800 border-b dark:border-neutral-700 last:border-0 disabled:opacity-50"
                              >
                                {u.email ?? u.name ?? u.id}
                                {u.name && u.email && ` (${u.name})`}
                              </button>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 px-4 py-2 border dark:border-neutral-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
              >
                수정
              </button>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

