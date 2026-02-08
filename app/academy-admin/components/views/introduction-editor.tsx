"use client";

import { useEditor, EditorContent, NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import ImageExt from '@tiptap/extension-image';
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
  Link as LinkIcon, Unlink, ExternalLink,
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

// ─── 커스텀 이미지 노드 뷰 (링크 편집 UI 포함) ───
function ImageNodeView({ node, updateAttributes, selected }: any) {
  const { src, alt, href } = node.attrs;

  const handleSetLink = () => {
    const url = prompt('이미지 클릭 시 이동할 URL을 입력하세요:', href || 'https://');
    if (url === null) return;
    updateAttributes({ href: url.trim() || null, target: '_blank' });
  };

  return (
    <NodeViewWrapper className="image-node-wrapper my-4">
      <div className={`relative inline-block w-full ${selected ? 'ring-2 ring-blue-500 rounded-lg' : ''}`}>
        <img
          src={src}
          alt={alt || ''}
          draggable={false}
          className="rounded-lg max-w-full h-auto mx-auto block"
        />
        {/* 링크 배지 (선택되지 않았을 때) */}
        {href && !selected && (
          <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm pointer-events-none">
            <ExternalLink size={10} />
            링크 연결됨
          </div>
        )}
        {/* 선택 시 편집 컨트롤 */}
        {selected && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white dark:bg-neutral-800 shadow-xl rounded-lg px-2 py-1.5 flex items-center gap-1 border border-gray-200 dark:border-neutral-700 z-10 whitespace-nowrap">
            <button
              type="button"
              onClick={handleSetLink}
              className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-700 dark:text-gray-300"
            >
              <ExternalLink size={12} />
              {href ? '링크 수정' : '링크 추가'}
            </button>
            {href && (
              <button
                type="button"
                onClick={() => updateAttributes({ href: null })}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
              >
                <Unlink size={12} />
                제거
              </button>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  );
}

// ─── 링크 지원 이미지 확장 (Image + href/target 속성) ───
const LinkedImage = ImageExt.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      href: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const parent = element.parentElement;
          return parent?.tagName === 'A' ? parent.getAttribute('href') : null;
        },
        renderHTML: () => ({}), // img 태그에 href 속성 추가 방지
      },
      target: {
        default: '_blank',
        parseHTML: (element: HTMLElement) => {
          const parent = element.parentElement;
          return parent?.tagName === 'A' ? (parent.getAttribute('target') || '_blank') : '_blank';
        },
        renderHTML: () => ({}),
      },
    };
  },
  renderHTML({ node, HTMLAttributes }: any) {
    const { href, target } = node.attrs;
    if (href) {
      return ['a', { href, target: target || '_blank', rel: 'noopener noreferrer' }, ['img', HTMLAttributes]];
    }
    return ['img', HTMLAttributes];
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageNodeView);
  },
});

// ─── Link 확장 오버라이드: <a><img></a> 충돌 방지 ───
const SafeLink = Link.extend({
  parseHTML() {
    return [
      {
        tag: 'a[href]:not([href *= "javascript:" i])',
        getAttrs: (dom: HTMLElement) => {
          // <a> 안에 <img>만 있는 경우 Link 마크 적용 안 함 (LinkedImage가 처리)
          if (dom.children.length === 1 && dom.children[0]?.tagName === 'IMG') {
            return false;
          }
          return {};
        },
      },
    ];
  },
});

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
      LinkedImage.configure({
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
      SafeLink.configure({
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

  // 이미지 업로드 (클라이언트 측 Supabase SDK 직접 사용)
  const handleImageUpload = useCallback(async (file: File) => {
    if (!editor) return;
    setUploading(true);

    try {
      // 파일 크기 제한 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('파일 크기는 5MB 이하여야 합니다.');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('JPG, PNG, GIF, WebP만 업로드 가능합니다.');
      }

      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('데이터베이스 연결 실패');

      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `introduction/${academyId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

      const { data, error } = await supabase.storage
        .from('academy-images')
        .upload(fileName, file, {
          contentType: file.type,
          upsert: false,
        });

      if (error) throw new Error(`업로드 실패: ${error.message}`);

      const { data: urlData } = supabase.storage
        .from('academy-images')
        .getPublicUrl(data.path);

      editor.chain().focus().setImage({ src: urlData.publicUrl }).run();
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
