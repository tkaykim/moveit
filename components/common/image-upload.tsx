"use client";

import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, Link as LinkIcon } from 'lucide-react';
import Image from 'next/image';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageChange: (file: File | null) => void;
  onImageUrlChange?: (url: string | null) => void;
  label?: string;
  accept?: string;
  maxSizeMB?: number;
}

type UploadMode = 'file' | 'url';

export function ImageUpload({
  currentImageUrl,
  onImageChange,
  onImageUrlChange,
  label = '이미지 업로드',
  accept = 'image/*',
  maxSizeMB = 5,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [urlInput, setUrlInput] = useState<string>('');
  const [mode, setMode] = useState<UploadMode>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // currentImageUrl이 변경될 때 preview 업데이트
  useEffect(() => {
    if (currentImageUrl) {
      setPreview(currentImageUrl);
      setUrlInput(currentImageUrl);
      // HTTP/HTTPS URL이면 자동으로 URL 모드로 전환
      if (currentImageUrl.startsWith('http://') || currentImageUrl.startsWith('https://')) {
        setMode('url');
      }
    } else {
      setPreview(null);
      setUrlInput('');
    }
  }, [currentImageUrl]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 확인
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`);
      return;
    }

    // 파일 타입 확인
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

    onImageChange(file);
    // 파일을 선택했을 때는 URL을 초기화하지 않음
    // (기존 URL이 있으면 유지하고, 파일 업로드 시 파일이 우선)
    // 단, URL 입력 필드는 초기화
    setUrlInput('');
  };

  const handleUrlChange = (url: string) => {
    setUrlInput(url);
    
    if (url.trim()) {
      // URL 유효성 검사 (형식만 확인, 이미지 로드 가능 여부는 확인하지 않음)
      try {
        const urlObj = new URL(url);
        // URL 형식이 유효하면 저장 (미리보기는 시도하지만 실패해도 URL은 유효)
        setPreview(url);
        // URL이 유효하면 항상 저장 (미리보기 실패와 무관하게)
        if (onImageUrlChange) {
          onImageUrlChange(url);
        }
        // URL 입력 모드일 때는 파일 초기화
        onImageChange(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch {
        // 유효하지 않은 URL 형식이면 미리보기 제거
        setPreview(null);
        if (onImageUrlChange) {
          onImageUrlChange(null);
        }
      }
    } else {
      setPreview(null);
      if (onImageUrlChange) {
        onImageUrlChange(null);
      }
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setUrlInput('');
    onImageChange(null);
    if (onImageUrlChange) {
      onImageUrlChange(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const switchMode = (newMode: UploadMode) => {
    setMode(newMode);
    // 모드 전환 시 기존 데이터 초기화
    if (newMode === 'file') {
      setUrlInput('');
      if (onImageUrlChange) {
        onImageUrlChange(null);
      }
    } else {
      onImageChange(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      // URL 모드로 전환 시 기존 URL이 있으면 입력 필드에 표시
      if (currentImageUrl && !currentImageUrl.startsWith('data:')) {
        setUrlInput(currentImageUrl);
      }
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-black dark:text-white">
        {label}
      </label>

      {/* 모드 선택 탭 */}
      <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
        <button
          type="button"
          onClick={() => switchMode('file')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'file'
              ? 'border-b-2 border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <Upload size={16} />
            파일 업로드
          </div>
        </button>
        <button
          type="button"
          onClick={() => switchMode('url')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'url'
              ? 'border-b-2 border-primary dark:border-[#CCFF00] text-primary dark:text-[#CCFF00]'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <LinkIcon size={16} />
            URL 입력
          </div>
        </button>
      </div>

      {/* 파일 업로드 모드 */}
      {mode === 'file' && (
        <>
          {preview && !preview.startsWith('http') && !preview.startsWith('https') && preview.startsWith('data:') ? (
            <div className="relative w-full h-48 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : preview ? (
            <div className="relative w-full h-48 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                unoptimized={preview.startsWith('data:')}
                loading="lazy"
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-48 border-2 border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary dark:hover:border-[#CCFF00] transition-colors bg-neutral-50 dark:bg-neutral-900"
            >
              <ImageIcon className="text-neutral-400 dark:text-neutral-500 mb-2" size={48} />
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                클릭하여 이미지 선택
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                최대 {maxSizeMB}MB
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />

          {preview && !preview.startsWith('http') && !preview.startsWith('https') && preview.startsWith('data:') && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700 flex items-center justify-center gap-2 text-sm"
            >
              <Upload size={16} />
              이미지 변경
            </button>
          )}
        </>
      )}

      {/* URL 입력 모드 */}
      {mode === 'url' && (
        <div className="space-y-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => handleUrlChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="w-full px-4 py-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-black dark:text-white"
          />
          {preview && (preview.startsWith('http') || preview.startsWith('https')) && (
            <div className="relative w-full h-48 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-hidden border border-neutral-200 dark:border-neutral-700">
              <Image
                src={preview}
                alt="Preview"
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
                loading="lazy"
                onError={(e) => {
                  // 미리보기 실패해도 URL은 유효하므로 preview는 유지
                  // 단지 이미지 로드만 실패한 것이므로 경고만 표시
                  console.warn('이미지 미리보기를 불러올 수 없습니다. URL은 저장됩니다:', preview);
                  // preview를 제거하지 않고 유지 (URL은 유효하므로)
                }}
              />
              <button
                type="button"
                onClick={handleRemove}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!preview && urlInput && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              URL을 입력하면 미리보기가 표시됩니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
