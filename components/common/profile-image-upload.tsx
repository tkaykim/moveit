"use client";

import { useState, useRef } from 'react';
import { Camera, X, User, Loader2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';

interface ProfileImageUploadProps {
  /** 현재 프로필 이미지 URL */
  currentImageUrl?: string | null;
  /** 이미지 업로드 완료 시 콜백 (URL 반환) */
  onImageUploaded?: (url: string | null) => void;
  /** 대상 사용자 ID (관리자가 다른 사용자의 프로필 수정 시) */
  targetUserId?: string;
  /** 이미지 크기 (px) */
  size?: number;
  /** 비활성화 */
  disabled?: boolean;
  /** 로컬 파일만 선택 (업로드는 외부에서 처리) */
  localOnly?: boolean;
  /** 로컬 모드에서 파일 선택 콜백 */
  onFileSelect?: (file: File | null) => void;
  /** 표시 이름 (alt 텍스트용) */
  displayName?: string;
}

export function ProfileImageUpload({
  currentImageUrl,
  onImageUploaded,
  targetUserId,
  size = 80,
  disabled = false,
  localOnly = false,
  onFileSelect,
  displayName = '프로필',
}: ProfileImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displayUrl = preview || currentImageUrl;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 확인 (5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    // 이미지 타입 확인
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드할 수 있습니다.');
      return;
    }

    // 미리보기 생성
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // 로컬 모드면 파일만 전달하고 끝
    if (localOnly) {
      onFileSelect?.(file);
      return;
    }

    // 서버에 업로드
    await uploadFile(file);
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (targetUserId) {
        formData.append('targetUserId', targetUserId);
      }

      const res = await fetchWithAuth('/api/upload/profile-image', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '업로드에 실패했습니다.');
      }

      const data = await res.json();
      setPreview(null); // 서버 URL로 대체될 것이므로
      onImageUploaded?.(data.url);
    } catch (error: any) {
      console.error('Profile image upload error:', error);
      alert(`프로필 사진 업로드 실패: ${error.message}`);
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (localOnly) {
      setPreview(null);
      onFileSelect?.(null);
      onImageUploaded?.(null);
      return;
    }

    if (!currentImageUrl) {
      setPreview(null);
      return;
    }

    setUploading(true);
    try {
      const res = await fetchWithAuth('/api/upload/profile-image', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '삭제에 실패했습니다.');
      }

      setPreview(null);
      onImageUploaded?.(null);
    } catch (error: any) {
      console.error('Profile image delete error:', error);
      alert(`프로필 사진 삭제 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative group">
        {/* 프로필 이미지 원형 */}
        <div
          className="rounded-full overflow-hidden bg-gradient-to-tr from-primary dark:from-[#CCFF00] to-green-500 p-[2px]"
          style={{ width: size, height: size }}
        >
          <div className="w-full h-full rounded-full bg-white dark:bg-neutral-900 flex items-center justify-center overflow-hidden">
            {uploading ? (
              <Loader2 className="animate-spin text-neutral-400" size={size * 0.3} />
            ) : displayUrl ? (
              <img
                src={displayUrl}
                alt={displayName}
                className="w-full h-full object-cover"
                onError={() => setPreview(null)}
              />
            ) : (
              <User className="text-neutral-400 dark:text-neutral-500" size={size * 0.4} />
            )}
          </div>
        </div>

        {/* 카메라 아이콘 버튼 */}
        {!disabled && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-primary dark:bg-[#CCFF00] rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-neutral-900 hover:scale-110 transition-transform disabled:opacity-50"
          >
            <Camera size={14} className="text-white dark:text-black" />
          </button>
        )}

        {/* 삭제 버튼 (이미지 있을 때만) */}
        {!disabled && displayUrl && !uploading && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center shadow-lg border-2 border-white dark:border-neutral-900 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={10} className="text-white" />
          </button>
        )}
      </div>

      {/* 안내 텍스트 */}
      {!disabled && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {uploading ? '업로드 중...' : '사진을 변경하려면 탭하세요'}
        </p>
      )}

      {/* 숨겨진 파일 입력 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || uploading}
      />
    </div>
  );
}
