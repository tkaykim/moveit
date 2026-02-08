"use client";

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { useState, useEffect, useCallback, useRef } from 'react';
import { getSupabaseClient } from '@/lib/utils/supabase-client';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  Heading1, Heading2, Heading3,
  List, ListOrdered, Quote,
  AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Unlink,
  ImagePlus, Youtube as YoutubeIcon,
  Undo2, Redo2, Save, Loader2, Minus,
} from 'lucide-react';

interface IntroductionEditorProps {
  academyId: string;
}

// 툴바 버튼 컴포넌트
function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-gray-200 dark:bg-neutral-700 mx-1" />;
}

export function IntroductionEditor({ academyId }: IntroductionEditorProps) {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-lg max-w-full h-auto mx-auto my-4',
        },
      }),
      Youtube.configure({
        HTMLAttributes: {
          class: 'w-full aspect-video rounded-lg my-4',
        },
        width: 0,
        height: 0,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 dark:text-blue-400 underline cursor-pointer',
        },
      }),
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: '학원 소개를 자유롭게 작성하세요. 사진, 영상, 링크 등을 추가할 수 있습니다...',
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[300px] px-5 py-4',
      },
    },
  });

  // 데이터 로드
  useEffect(() => {
    const load = async () => {
      const supabase = getSupabaseClient();
      if (!supabase) { setLoading(false); return; }

      try {
        const { data, error } = await supabase
          .from('academies')
          .select('introduction_html')
          .eq('id', academyId)
          .single();

        if (error) throw error;
        if (data?.introduction_html && editor) {
          editor.commands.setContent(data.introduction_html);
        }
      } catch (e) {
        console.error('Error loading introduction:', e);
      } finally {
        setLoading(false);
      }
    };

    if (editor) load();
  }, [academyId, editor]);

  // 저장
  const handleSave = useCallback(async () => {
    if (!editor) return;
    setSaving(true);

    const supabase = getSupabaseClient();
    if (!supabase) {
      alert('데이터베이스 연결에 실패했습니다.');
      setSaving(false);
      return;
    }

    try {
      const html = editor.getHTML();
      const { error } = await supabase
        .from('academies')
        .update({ introduction_html: html === '<p></p>' ? null : html })
        .eq('id', academyId);

      if (error) throw error;
      setLastSaved(new Date());
      alert('학원 소개가 저장되었습니다.');
    } catch (e: any) {
      console.error('Error saving introduction:', e);
      alert(`저장 실패: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [editor, academyId]);

  // 이미지 업로드
  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('academyId', academyId);

      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '업로드 실패');

      editor.chain().focus().setImage({ src: data.url }).run();
    } catch (e: any) {
      alert(`이미지 업로드 실패: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }, [editor, academyId]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  }, [handleImageUpload]);

  // 유튜브 URL 입력
  const addYoutube = useCallback(() => {
    if (!editor) return;
    const url = prompt('유튜브 영상 URL을 입력하세요:');
    if (url) {
      editor.commands.setYoutubeVideo({ src: url });
    }
  }, [editor]);

  // 링크 추가/제거
  const toggleLink = useCallback(() => {
    if (!editor) return;

    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run();
      return;
    }

    const url = prompt('링크 URL을 입력하세요:');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
    }
  }, [editor]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">에디터 로딩 중...</span>
      </div>
    );
  }

  if (!editor) return null;

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl p-2 flex flex-wrap items-center gap-0.5">
        {/* 실행 취소 / 재실행 */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="실행 취소">
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="재실행">
          <Redo2 size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 텍스트 스타일 */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게">
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임">
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄">
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선">
          <Strikethrough size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 제목 */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1">
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2">
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3">
          <Heading3 size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 리스트 */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호">
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 매기기">
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용">
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선">
          <Minus size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 정렬 */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="왼쪽 정렬">
          <AlignLeft size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="가운데 정렬">
          <AlignCenter size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="오른쪽 정렬">
          <AlignRight size={16} />
        </ToolbarButton>

        <ToolbarDivider />

        {/* 미디어 / 링크 */}
        <ToolbarButton onClick={() => fileInputRef.current?.click()} disabled={uploading} title="이미지 첨부">
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        </ToolbarButton>
        <ToolbarButton onClick={addYoutube} title="유튜브 영상">
          <YoutubeIcon size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={toggleLink} active={editor.isActive('link')} title={editor.isActive('link') ? '링크 해제' : '링크 추가'}>
          {editor.isActive('link') ? <Unlink size={16} /> : <LinkIcon size={16} />}
        </ToolbarButton>

        {/* 숨겨진 파일 입력 */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* 에디터 본문 */}
      <div className="border border-gray-200 dark:border-neutral-700 rounded-xl overflow-hidden bg-white dark:bg-neutral-900">
        <EditorContent editor={editor} />
      </div>

      {/* 하단: 안내 + 저장 */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-400 dark:text-neutral-500">
          {lastSaved
            ? `마지막 저장: ${lastSaved.toLocaleTimeString('ko-KR')}`
            : '사진, 유튜브 영상, 링크를 자유롭게 추가하세요'}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          {saving ? '저장 중...' : '소개 저장'}
        </button>
      </div>
    </div>
  );
}
