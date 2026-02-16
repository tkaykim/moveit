"use client";

import { useState, useEffect } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  Link as LinkIcon,
  Settings,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/supabase/auth-fetch";

interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface BannerSettings {
  auto_slide_interval: number;
  is_auto_slide_enabled: boolean;
}

export default function BannersPage() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [settings, setSettings] = useState<BannerSettings>({
    auto_slide_interval: 5000,
    is_auto_slide_enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    image_url: "",
    link_url: "",
    display_order: 0,
    is_active: true,
    starts_at: "",
    ends_at: "",
  });

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await authFetch("/api/admin/banners");
      if (response.ok) {
        const data = await response.json();
        setBanners(data.banners || []);
        setSettings(data.settings || { auto_slide_interval: 5000, is_auto_slide_enabled: true });
      }
    } catch (error) {
      console.error("Error fetching banners:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingBanner) {
        // 수정
        const response = await authFetch(`/api/admin/banners/${editingBanner.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            starts_at: formData.starts_at || null,
            ends_at: formData.ends_at || null,
            link_url: formData.link_url || null,
          }),
        });

        if (response.ok) {
          fetchBanners();
          closeModal();
        }
      } else {
        // 생성
        const response = await authFetch("/api/admin/banners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...formData,
            starts_at: formData.starts_at || null,
            ends_at: formData.ends_at || null,
            link_url: formData.link_url || null,
          }),
        });

        if (response.ok) {
          fetchBanners();
          closeModal();
        }
      }
    } catch (error) {
      console.error("Error saving banner:", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 배너를 삭제하시겠습니까?")) return;

    try {
      const response = await authFetch(`/api/admin/banners/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchBanners();
      }
    } catch (error) {
      console.error("Error deleting banner:", error);
    }
  };

  const handleToggleActive = async (banner: Banner) => {
    try {
      const response = await authFetch(`/api/admin/banners/${banner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !banner.is_active }),
      });

      if (response.ok) {
        fetchBanners();
      }
    } catch (error) {
      console.error("Error toggling banner:", error);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await authFetch("/api/admin/banners", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setShowSettingsModal(false);
      }
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const openModal = (banner?: Banner) => {
    if (banner) {
      setEditingBanner(banner);
      setFormData({
        title: banner.title,
        image_url: banner.image_url,
        link_url: banner.link_url || "",
        display_order: banner.display_order,
        is_active: banner.is_active,
        starts_at: banner.starts_at ? banner.starts_at.split("T")[0] : "",
        ends_at: banner.ends_at ? banner.ends_at.split("T")[0] : "",
      });
    } else {
      setEditingBanner(null);
      setFormData({
        title: "",
        image_url: "",
        link_url: "",
        display_order: banners.length,
        is_active: true,
        starts_at: "",
        ends_at: "",
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingBanner(null);
    setFormData({
      title: "",
      image_url: "",
      link_url: "",
      display_order: 0,
      is_active: true,
      starts_at: "",
      ends_at: "",
    });
  };

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            배너 관리
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            홈 화면에 표시되는 배너를 관리합니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSettingsModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-neutral-800 dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 transition-colors"
          >
            <Settings size={18} />
            설정
          </button>
          <button
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-primary dark:bg-[#CCFF00] text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            배너 추가
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary dark:border-[#CCFF00] border-t-transparent rounded-full" />
        </div>
      ) : banners.length === 0 ? (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-12 text-center border border-neutral-200 dark:border-neutral-800">
          <ImageIcon className="w-16 h-16 mx-auto text-neutral-400 mb-4" />
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            등록된 배너가 없습니다.
          </p>
          <button
            onClick={() => openModal()}
            className="px-4 py-2 bg-primary dark:bg-[#CCFF00] text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
          >
            첫 번째 배너 추가하기
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden"
            >
              <div className="flex items-center gap-4 p-4">
                <button className="cursor-move text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">
                  <GripVertical size={20} />
                </button>
                
                <div className="w-32 h-20 relative rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex-shrink-0">
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-black dark:text-white truncate">
                      {banner.title}
                    </h3>
                    {!banner.is_active && (
                      <span className="px-2 py-0.5 text-xs bg-neutral-200 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 rounded">
                        비활성
                      </span>
                    )}
                  </div>
                  {banner.link_url && (
                    <div className="flex items-center gap-1 text-sm text-neutral-500 dark:text-neutral-400">
                      <LinkIcon size={14} />
                      <span className="truncate">{banner.link_url}</span>
                    </div>
                  )}
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    순서: {banner.display_order}
                    {banner.starts_at && ` | 시작: ${new Date(banner.starts_at).toLocaleDateString()}`}
                    {banner.ends_at && ` | 종료: ${new Date(banner.ends_at).toLocaleDateString()}`}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(banner)}
                    className={`p-2 rounded-lg transition-colors ${
                      banner.is_active
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                        : "bg-neutral-100 dark:bg-neutral-800 text-neutral-400"
                    }`}
                    title={banner.is_active ? "비활성화" : "활성화"}
                  >
                    {banner.is_active ? <Eye size={18} /> : <EyeOff size={18} />}
                  </button>
                  <button
                    onClick={() => openModal(banner)}
                    className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <Pencil size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(banner.id)}
                    className="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 배너 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-black dark:text-white">
                {editingBanner ? "배너 수정" : "새 배너 추가"}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-neutral-500" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  배너 제목 *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  이미지 URL *
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  placeholder="https://..."
                  required
                />
                {formData.image_url && (
                  <div className="mt-2 rounded-lg overflow-hidden bg-neutral-100 dark:bg-neutral-800">
                    <img
                      src={formData.image_url}
                      alt="미리보기"
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  클릭 시 이동 URL
                </label>
                <input
                  type="text"
                  value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  placeholder="/promotions/event 또는 https://..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  표시 순서
                </label>
                <input
                  type="number"
                  value={formData.display_order}
                  onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    시작일
                  </label>
                  <input
                    type="date"
                    value={formData.starts_at}
                    onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    종료일
                  </label>
                  <input
                    type="date"
                    value={formData.ends_at}
                    onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                    className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <label htmlFor="is_active" className="text-sm text-neutral-700 dark:text-neutral-300">
                  활성화
                </label>
              </div>
              
              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary dark:bg-[#CCFF00] text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
                >
                  {editingBanner ? "수정" : "추가"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 설정 모달 */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-xl w-full max-w-md">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
              <h2 className="text-xl font-bold text-black dark:text-white">
                배너 설정
              </h2>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <X size={20} className="text-neutral-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  자동 슬라이드
                </label>
                <button
                  onClick={() => setSettings({ ...settings, is_auto_slide_enabled: !settings.is_auto_slide_enabled })}
                  className={`w-12 h-6 rounded-full transition-colors ${
                    settings.is_auto_slide_enabled
                      ? "bg-primary dark:bg-[#CCFF00]"
                      : "bg-neutral-300 dark:bg-neutral-700"
                  }`}
                >
                  <div
                    className={`w-5 h-5 bg-white rounded-full transition-transform ${
                      settings.is_auto_slide_enabled ? "translate-x-6" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  자동 슬라이드 간격 (초)
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={settings.auto_slide_interval / 1000}
                  onChange={(e) => setSettings({ ...settings, auto_slide_interval: Math.max(1000, parseInt(e.target.value) * 1000 || 5000) })}
                  className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-black dark:text-white"
                  disabled={!settings.is_auto_slide_enabled}
                />
                <p className="text-xs text-neutral-500 mt-1">
                  현재 설정: {settings.auto_slide_interval / 1000}초마다 자동 전환
                </p>
              </div>
              
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="flex-1 px-4 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveSettings}
                  className="flex-1 px-4 py-2 bg-primary dark:bg-[#CCFF00] text-white dark:text-black rounded-lg hover:opacity-90 transition-opacity"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
