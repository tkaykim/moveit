'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, Plus, Building2, Users } from 'lucide-react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  User,
  UserRole,
  AcademyRole,
  TabType,
  Academy,
  AcademyUserRole,
  AcademySelection,
} from './types';
import GeneralUsersTable from './components/general-users-table';
import AcademyUsersTable from './components/academy-users-table';
import AssignModal from './components/assign-modal';
import EditAcademyUserModal from './components/edit-academy-user-modal';

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [academies, setAcademies] = useState<Academy[]>([]);
  const [academyUserRoles, setAcademyUserRoles] = useState<AcademyUserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [searchQuery, setSearchQuery] = useState('');

  // 일반 사용자 인라인 수정
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRole>('USER');

  // 신규 학원 역할 할당 모달
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignSearchQuery, setAssignSearchQuery] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState<User[]>([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedAssignUser, setSelectedAssignUser] = useState<User | null>(null);
  const [assignAcademySelections, setAssignAcademySelections] = useState<AcademySelection[]>([]);
  const [assignAcademySearchQuery, setAssignAcademySearchQuery] = useState('');

  // 학원 유저 편집 모달
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editUserRole, setEditUserRole] = useState<UserRole>('ACADEMY_OWNER');
  const [editAcademySelections, setEditAcademySelections] = useState<AcademySelection[]>([]);
  const [editAcademySearchQuery, setEditAcademySearchQuery] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // ---- 데이터 로딩 ----
  const loadUsers = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data as User[]) || []);
    } catch (error) {
      console.error('Error loading users:', error);
      alert('사용자 목록을 불러오는데 실패했습니다.');
    }
  }, []);

  const loadAcademies = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      const { data, error } = await supabase
        .from('academies')
        .select('id, name_kr')
        .order('name_kr', { ascending: true });
      if (error) throw error;
      setAcademies((data as Academy[]) || []);
    } catch (error) {
      console.error('Error loading academies:', error);
    }
  }, []);

  const loadAcademyUserRoles = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/users/academy-roles');
      const result = await response.json();
      if (response.ok) setAcademyUserRoles(result.data || []);
    } catch (error) {
      console.error('Error loading academy user roles:', error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadUsers(), loadAcademies(), loadAcademyUserRoles()]);
      setLoading(false);
    };
    init();
  }, [loadUsers, loadAcademies, loadAcademyUserRoles]);

  // ---- 핸들러 ----
  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const response = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '권한 변경에 실패했습니다.');
      setUsers((prev) =>
        prev.map((user) => (user.id === userId ? { ...user, role: newRole } : user))
      );
      setEditingUserId(null);
      alert('권한이 변경되었습니다.');
    } catch (error: any) {
      alert(error.message || '권한 변경에 실패했습니다.');
    }
  };

  const handleAssignAcademyRoles = async () => {
    if (!assignUserId || assignAcademySelections.length === 0) {
      alert('사용자와 학원을 선택해주세요.');
      return;
    }
    setAssignLoading(true);
    try {
      for (const sel of assignAcademySelections) {
        const response = await fetch('/api/admin/users/academy-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: assignUserId, academyId: sel.academy_id, role: sel.role }),
        });
        const data = await response.json();
        if (!response.ok && response.status !== 409)
          throw new Error(data.error || '학원 역할 할당에 실패했습니다.');
      }
      alert('학원 역할이 할당되었습니다.');
      closeAssignModal();
      await Promise.all([loadUsers(), loadAcademyUserRoles()]);
    } catch (error: any) {
      alert(error.message || '학원 역할 할당에 실패했습니다.');
    } finally {
      setAssignLoading(false);
    }
  };

  const openEditModal = (user: User) => {
    const userRoles = academyUserRoles.filter((r) => r.user_id === user.id);
    setEditUser(user);
    setEditUserRole(user.role);
    setEditAcademySelections(
      userRoles.map((r) => ({ academy_id: r.academy_id, role: r.role, existingId: r.id }))
    );
    setEditAcademySearchQuery('');
    setShowEditModal(true);
  };

  const handleSaveEditModal = async () => {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const currentRoles = academyUserRoles.filter((r) => r.user_id === editUser.id);
      const toDelete = currentRoles.filter(
        (cr) => !editAcademySelections.some((es) => es.academy_id === cr.academy_id && es.role === cr.role)
      );
      const toAdd = editAcademySelections.filter(
        (es) => !currentRoles.some((cr) => cr.academy_id === es.academy_id && cr.role === es.role)
      );

      for (const del of toDelete) {
        const res = await fetch('/api/admin/users/academy-roles', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: del.id, userId: editUser.id }),
        });
        if (!res.ok) throw new Error((await res.json()).error || '학원 역할 해제에 실패했습니다.');
      }
      for (const add of toAdd) {
        await fetch('/api/admin/users/academy-roles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editUser.id, academyId: add.academy_id, role: add.role }),
        });
      }
      if (editUserRole !== editUser.role) {
        const res = await fetch('/api/admin/users/role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: editUser.id, role: editUserRole }),
        });
        if (!res.ok) throw new Error((await res.json()).error || '역할 변경에 실패했습니다.');
      }

      alert('변경사항이 저장되었습니다.');
      setShowEditModal(false);
      setEditUser(null);
      await Promise.all([loadUsers(), loadAcademyUserRoles()]);
    } catch (error: any) {
      alert(error.message || '저장에 실패했습니다.');
    } finally {
      setEditLoading(false);
    }
  };

  const closeAssignModal = () => {
    setShowAssignModal(false);
    setAssignUserId('');
    setAssignSearchQuery('');
    setSelectedAssignUser(null);
    setAssignAcademySelections([]);
    setAssignAcademySearchQuery('');
  };

  // 유저 검색 (신규 할당 모달용)
  useEffect(() => {
    if (assignSearchQuery.length >= 1) {
      const q = assignSearchQuery.toLowerCase();
      const results = users.filter(
        (u) =>
          u.email?.toLowerCase().includes(q) ||
          u.name?.toLowerCase().includes(q) ||
          u.nickname?.toLowerCase().includes(q)
      );
      setUserSearchResults(results.slice(0, 10));
      setShowUserDropdown(true);
    } else {
      setUserSearchResults([]);
      setShowUserDropdown(false);
    }
  }, [assignSearchQuery, users]);

  // ---- 유틸 / 필터 ----
  const getAcademyName = (id: string) =>
    academies.find((a) => a.id === id)?.name_kr || '알 수 없는 학원';

  const getUserAcademyRoles = (userId: string) =>
    academyUserRoles.filter((r) => r.user_id === userId);

  const generalUsers = users.filter((u) => u.role === 'USER' || u.role === 'INSTRUCTOR');
  const academyUsers = users.filter(
    (u) => u.role === 'ACADEMY_OWNER' || u.role === 'ACADEMY_MANAGER' || u.role === 'SUPER_ADMIN'
  );

  const filteredGeneralUsers = generalUsers.filter((user) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      user.email?.toLowerCase().includes(q) ||
      user.name?.toLowerCase().includes(q) ||
      user.nickname?.toLowerCase().includes(q) ||
      user.phone?.toLowerCase().includes(q)
    );
  });

  const filteredAcademyUsers = academyUsers.filter((user) => {
    const q = searchQuery.toLowerCase();
    if (!q) return true;
    return (
      user.email?.toLowerCase().includes(q) ||
      user.name?.toLowerCase().includes(q) ||
      user.nickname?.toLowerCase().includes(q) ||
      user.phone?.toLowerCase().includes(q)
    );
  });

  const filteredAcademies = useMemo(
    () => academies.filter((a) => a.name_kr !== 'ADMIN'),
    [academies]
  );

  // ---- 렌더링 ----
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-[#CCFF00]" />
      </div>
    );
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-black dark:text-white">사용자 관리</h1>
          <p className="text-neutral-600 dark:text-neutral-400 mt-1">
            사용자 목록을 조회하고 권한을 관리할 수 있습니다.
          </p>
        </div>
        {activeTab === 'academy' && (
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-[#CCFF00] text-black rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            <Plus size={18} />
            학원 역할 할당
          </button>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800 mb-6">
        <button
          onClick={() => { setActiveTab('general'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'general'
              ? 'border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Users size={18} />
          일반 사용자
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {generalUsers.length}
          </span>
        </button>
        <button
          onClick={() => { setActiveTab('academy'); setSearchQuery(''); }}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'academy'
              ? 'border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
              : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-300'
          }`}
        >
          <Building2 size={18} />
          학원 사용자
          <span className="ml-1 px-2 py-0.5 text-xs rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
            {academyUsers.length}
          </span>
        </button>
      </div>

      {/* 검색 */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={20} />
          <input
            type="text"
            placeholder={
              activeTab === 'general'
                ? '이메일, 이름, 닉네임으로 검색...'
                : '이메일, 이름, 닉네임으로 학원 사용자 검색...'
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg text-black dark:text-white focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-[#CCFF00]"
          />
        </div>
      </div>

      {/* 테이블 */}
      {activeTab === 'general' && (
        <GeneralUsersTable
          users={filteredGeneralUsers}
          searchQuery={searchQuery}
          editingUserId={editingUserId}
          selectedRole={selectedRole}
          onEditStart={(uid, role) => { setEditingUserId(uid); setSelectedRole(role); }}
          onEditCancel={() => setEditingUserId(null)}
          onRoleChange={handleRoleChange}
          onSelectedRoleChange={setSelectedRole}
        />
      )}
      {activeTab === 'academy' && (
        <AcademyUsersTable
          users={filteredAcademyUsers}
          searchQuery={searchQuery}
          getAcademyName={getAcademyName}
          getUserAcademyRoles={getUserAcademyRoles}
          onEditUser={openEditModal}
        />
      )}

      <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
        총 {activeTab === 'general' ? filteredGeneralUsers.length : filteredAcademyUsers.length}명의 사용자
      </div>

      {/* 모달 */}
      {showAssignModal && (
        <AssignModal
          academies={filteredAcademies}
          assignSearchQuery={assignSearchQuery}
          setAssignSearchQuery={setAssignSearchQuery}
          userSearchResults={userSearchResults}
          showUserDropdown={showUserDropdown}
          setShowUserDropdown={setShowUserDropdown}
          selectedAssignUser={selectedAssignUser}
          setSelectedAssignUser={setSelectedAssignUser}
          assignUserId={assignUserId}
          setAssignUserId={setAssignUserId}
          academySelections={assignAcademySelections}
          setAcademySelections={setAssignAcademySelections}
          academySearchQuery={assignAcademySearchQuery}
          setAcademySearchQuery={setAssignAcademySearchQuery}
          assignLoading={assignLoading}
          onAssign={handleAssignAcademyRoles}
          onClose={closeAssignModal}
          getAcademyName={getAcademyName}
        />
      )}

      {showEditModal && editUser && (
        <EditAcademyUserModal
          user={editUser}
          academies={filteredAcademies}
          userRole={editUserRole}
          setUserRole={setEditUserRole}
          academySelections={editAcademySelections}
          setAcademySelections={setEditAcademySelections}
          academySearchQuery={editAcademySearchQuery}
          setAcademySearchQuery={setEditAcademySearchQuery}
          editLoading={editLoading}
          onSave={handleSaveEditModal}
          onClose={() => { setShowEditModal(false); setEditUser(null); }}
          getAcademyName={getAcademyName}
        />
      )}
    </div>
  );
}
