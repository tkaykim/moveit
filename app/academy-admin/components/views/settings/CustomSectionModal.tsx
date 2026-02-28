"use client";

import { useState, useEffect } from 'react';
import { fetchWithAuth } from '@/lib/api/auth-fetch';
import { SectionConfigItem, CUSTOM_SECTION_TYPE_LABELS } from '@/types/database';
import { X, Upload, ImageIcon, Type, Video, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import UnderlineExt from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3, AlignLeft, AlignCenter, AlignRight, List, ListOrdered } from 'lucide-react';

function MiniRichToolbarBtn({ onClick, active, disabled, title, children }: {
  onClick: () => void; active?: boolean; disabled?: boolean; title: string; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
               : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >{children}</button>
  );
}

function MiniRichTextEditor({ initialContent, onContentChange }: { initialContent: string; onContentChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExt,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: '섹션에 표시할 내용을 작성하세요...' }),
    ],
    content: initialContent || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[180px] px-4 py-3',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onContentChange(ed.getHTML());
    },
  });

  if (!editor) return <div className="text-sm text-gray-400 py-4 text-center">에디터 로딩 중...</div>;

  return (
    <div>
      <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-t-lg p-1.5 flex flex-wrap items-center gap-0.5">
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게"><Bold size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임"><Italic size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선"><Strikethrough size={15} /></MiniRichToolbarBtn>
        <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-0.5" />
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1"><Heading1 size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2"><Heading2 size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3"><Heading3 size={15} /></MiniRichToolbarBtn>
        <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-0.5" />
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호"><List size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 매기기"><ListOrdered size={15} /></MiniRichToolbarBtn>
        <div className="w-px h-5 bg-gray-200 dark:bg-neutral-700 mx-0.5" />
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬"><AlignLeft size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="가운데 정렬"><AlignCenter size={15} /></MiniRichToolbarBtn>
        <MiniRichToolbarBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬"><AlignRight size={15} /></MiniRichToolbarBtn>
      </div>
      <div className="border border-t-0 border-gray-200 dark:border-neutral-700 rounded-b-lg overflow-hidden bg-white dark:bg-neutral-900">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export interface CustomSectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (section: Partial<SectionConfigItem>) => void;
  editingSection?: SectionConfigItem | null;
  academyId: string;
}

export function CustomSectionModal({ isOpen, onClose, onSave, editingSection, academyId }: CustomSectionModalProps) {
  const [sectionType, setSectionType] = useState<'image' | 'text' | 'video'>(editingSection?.type || 'image');
  const [title, setTitle] = useState(editingSection?.title || '');
  const [content, setContent] = useState(editingSection?.content || '');
  const [mediaUrl, setMediaUrl] = useState(editingSection?.media_url || '');
  const [linkUrl, setLinkUrl] = useState(editingSection?.link_url || '');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (editingSection) {
      setSectionType(editingSection.type || 'image');
      setTitle(editingSection.title || '');
      setContent(editingSection.content || '');
      setMediaUrl(editingSection.media_url || '');
      setLinkUrl(editingSection.link_url || '');
    } else {
      setSectionType('image');
      setTitle('');
      setContent('');
      setMediaUrl('');
      setLinkUrl('');
    }
  }, [editingSection, isOpen]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('academyId', academyId);
      const response = await fetchWithAuth('/api/upload/image', { method: 'POST', body: formData });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || '업로드 실패');
      }
      const data = await response.json();
      setMediaUrl(data.url);
    } catch (error: any) {
      alert(`이미지 업로드 실패: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      alert('섹션 제목을 입력해주세요.');
      return;
    }
    if (sectionType === 'text' && (!content.trim() || content === '<p></p>')) {
      alert('글 내용을 입력해주세요.');
      return;
    }
    if ((sectionType === 'image' || sectionType === 'video') && !mediaUrl.trim()) {
      alert(sectionType === 'image' ? '이미지를 업로드하거나 URL을 입력해주세요.' : '영상 URL을 입력해주세요.');
      return;
    }
    onSave({
      type: sectionType,
      title: title.trim(),
      content: sectionType === 'text' ? content : undefined,
      media_url: (sectionType === 'image' || sectionType === 'video') ? mediaUrl.trim() : undefined,
      link_url: linkUrl.trim() || undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <h3 className="font-bold text-gray-900 dark:text-white">{editingSection ? '커스텀 섹션 편집' : '커스텀 섹션 추가'}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"><X size={18} className="text-gray-500" /></button>
        </div>
        <div className="px-6 py-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">섹션 타입</label>
            <div className="flex gap-2">
              {(['image', 'text', 'video'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setSectionType(type)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                    sectionType === type ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300' : 'border-gray-200 dark:border-neutral-700 text-gray-500 dark:text-neutral-400 hover:border-gray-300 dark:hover:border-neutral-600'
                  }`}
                >
                  {type === 'image' && <ImageIcon size={16} />}
                  {type === 'text' && <Type size={16} />}
                  {type === 'video' && <Video size={16} />}
                  {CUSTOM_SECTION_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">섹션 제목</label>
            <input type="text" className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm" value={title} onChange={e => setTitle(e.target.value)} placeholder="예: 학원 갤러리, 공지사항 등" />
          </div>
          {sectionType === 'image' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">이미지</label>
              {mediaUrl ? (
                <div className="relative rounded-lg overflow-hidden border border-gray-200 dark:border-neutral-700">
                  <div className="relative w-full h-48">
                    <Image src={mediaUrl} alt="업로드된 이미지" fill className="object-cover" />
                  </div>
                  <button type="button" onClick={() => setMediaUrl('')} className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors"><X size={14} /></button>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-gray-300 dark:border-neutral-600 rounded-lg cursor-pointer hover:border-purple-400 dark:hover:border-purple-500 transition-colors bg-gray-50 dark:bg-neutral-800/50">
                    <input type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    {uploading ? <div className="text-sm text-gray-500 dark:text-neutral-400">업로드 중...</div> : <><Upload size={24} className="text-gray-400 dark:text-neutral-500 mb-2" /><span className="text-sm text-gray-500 dark:text-neutral-400">클릭하여 이미지 업로드</span><span className="text-xs text-gray-400 dark:text-neutral-500 mt-1">JPG, PNG, GIF, WebP (최대 5MB)</span></>}
                  </label>
                  <div className="flex items-center gap-2"><div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" /><span className="text-xs text-gray-400">또는 URL 입력</span><div className="h-px flex-1 bg-gray-200 dark:bg-neutral-700" /></div>
                  <input type="url" className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
                </div>
              )}
            </div>
          )}
          {sectionType === 'video' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">영상 URL</label>
              <input type="url" className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm" value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="유튜브 또는 영상 링크를 입력하세요" />
              <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">유튜브 링크를 입력하면 자동으로 임베드됩니다.</p>
            </div>
          )}
          {sectionType === 'text' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">글 내용</label>
              <MiniRichTextEditor initialContent={content} onContentChange={setContent} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"><span className="flex items-center gap-1"><ExternalLink size={14} />클릭 시 이동 URL <span className="text-gray-400 font-normal">(선택)</span></span></label>
            <input type="url" className="w-full border dark:border-neutral-700 rounded-lg px-3 py-2 bg-white dark:bg-neutral-800 text-gray-900 dark:text-white text-sm" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://example.com" />
            <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">설정 시 섹션 클릭 시 해당 URL로 이동합니다.</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">취소</button>
          <button type="button" onClick={handleSave} disabled={uploading} className="px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50">{editingSection ? '수정' : '추가'}</button>
        </div>
      </div>
    </div>
  );
}
