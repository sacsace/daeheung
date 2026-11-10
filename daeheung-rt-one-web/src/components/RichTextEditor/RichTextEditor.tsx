import React, { useEffect, useRef, useState } from 'react';
import { Box, IconButton, Divider, Popover, SxProps, Theme, Tooltip } from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatStrikethrough,
  FormatUnderlined,
  FormatListBulleted,
  FormatListNumbered,
  FormatAlignLeft,
  FormatAlignCenter,
  FormatAlignRight,
  FormatQuote,
  FormatColorText,
  FormatColorReset,
  HorizontalRule,
  Redo,
  TableChart,
  Title,
  Undo,
  ZoomIn,
  ZoomOut,
  Straighten,
  Image as ImageIcon,
} from '@mui/icons-material';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { Table as TableExtension } from '@tiptap/extension-table';
import { TableRow as TableRowExtension } from '@tiptap/extension-table-row';
import { TableCell as TableCellExtension } from '@tiptap/extension-table-cell';
import { TableHeader as TableHeaderExtension } from '@tiptap/extension-table-header';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { TextAlign } from '@tiptap/extension-text-align';
import { Underline } from '@tiptap/extension-underline';

const FONT_COLOR_PRESETS = [
  '#111827',
  '#DC2626',
  '#EA580C',
  '#CA8A04',
  '#16A34A',
  '#2563EB',
  '#7C3AED',
  '#DB2777',
  '#64748B',
  '#FFFFFF',
];

const ResizableImage = Image.extend({
  group: 'block',
  inline: false,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('width'),
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => element.getAttribute('height'),
        renderHTML: (attributes) => {
          if (!attributes.height) return {};
          return { height: attributes.height };
        },
      },
      align: {
        default: 'left',
        parseHTML: (element) => element.getAttribute('data-align') || 'left',
        renderHTML: (attributes) => {
          const align = String(attributes.align || 'left');
          const marginStyle =
            align === 'left'
              ? '12px auto 12px 0'
              : align === 'right'
                ? '12px 0 12px auto'
                : '12px auto';
          return {
            'data-align': align,
            style: `display:block; margin:${marginStyle};`,
          };
        },
      },
    };
  },
});

type ImageAlign = 'left' | 'center' | 'right';

type RichTextEditorInstance = Editor;

const insertImageWithAlign = (ed: RichTextEditorInstance, src: string, align: ImageAlign = 'left') => {
  ed.chain().focus().setImage({ src }).run();
  ed.chain().focus().updateAttributes('image', { align }).run();
};

export type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  minHeight?: number;
  showToolbar?: boolean;
  sx?: SxProps<Theme>;
};

const editorContentSx = (minHeight: number): SxProps<Theme> => ({
  '& .tiptap': {
    minHeight,
    outline: 'none',
    px: 1.5,
    py: 1.25,
    fontSize: '0.875rem',
    lineHeight: 1.68,
    '& p': { margin: '0.42em 0' },
    '& img': {
      maxWidth: '100%',
      height: 'auto',
      display: 'block',
      borderRadius: 4,
    },
    '& img[data-align="left"]': { margin: '12px 0 12px 0' },
    '& img[data-align="center"]': { margin: '12px auto' },
    '& img[data-align="right"]': { margin: '12px 0 12px auto' },
    '& table': {
      borderCollapse: 'collapse',
      width: '100%',
      margin: '8px 0',
    },
    '& td, & th': {
      border: '1px solid #CBD5E1',
      padding: '6px 8px',
      minWidth: 48,
    },
  },
  '& .ProseMirror-focused': { outline: 'none' },
});

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  readOnly = false,
  placeholder,
  minHeight = 160,
  showToolbar = true,
  sx,
}) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor>>(null);
  const [colorAnchor, setColorAnchor] = useState<HTMLElement | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      ResizableImage.configure({
        inline: false,
        allowBase64: true,
        HTMLAttributes: {
          class: 'resizable-image',
          style: 'display: block; max-width: 100%; clear: both;',
        },
      }),
      TableExtension.configure({ resizable: true }),
      TableRowExtension,
      TableHeaderExtension,
      TableCellExtension,
      TextStyle,
      Color.configure({ types: [TextStyle.name] }),
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph', 'image'],
        defaultAlignment: 'left',
      }),
    ],
    content: value || '',
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        ...(placeholder ? { 'data-placeholder': placeholder } : {}),
      },
      handlePaste: (_view, event) => {
        const ed = editorRef.current;
        const items = event.clipboardData?.items;
        if (items) {
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.type.indexOf('image') !== -1) {
              event.preventDefault();
              const file = item.getAsFile();
              if (file && ed) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const result = e.target?.result as string;
                  if (result) insertImageWithAlign(ed, result, 'left');
                };
                reader.readAsDataURL(file);
              }
              return true;
            }
          }
        }

        const htmlData = event.clipboardData?.getData('text/html');
        const textData = event.clipboardData?.getData('text/plain');

        if (htmlData && htmlData.includes('<table') && ed) {
          event.preventDefault();
          ed.chain().focus().insertContent(htmlData).run();
          return true;
        }

        if (textData && textData.includes('\t') && ed) {
          event.preventDefault();
          const lines = textData.split('\n').filter((line) => line.trim());
          if (lines.length > 0) {
            const rows = lines.map((line) => line.split('\t').map((cell) => cell.trim()));
            const maxCols = Math.max(...rows.map((row) => row.length), 1);
            let tableHTML = '<table><tbody>';
            rows.forEach((row) => {
              tableHTML += '<tr>';
              for (let i = 0; i < maxCols; i++) {
                tableHTML += `<td>${row[i] || ''}</td>`;
              }
              tableHTML += '</tr>';
            });
            tableHTML += '</tbody></table>';
            ed.chain().focus().insertContent(tableHTML).run();
            return true;
          }
        }

        return false;
      },
    },
  });

  editorRef.current = editor;

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || '';
    if (next !== current) {
      editor.commands.setContent(next);
    }
  }, [editor, value]);

  const [, setToolbarTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const refresh = () => setToolbarTick((n) => n + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  const handleImagePick = (file: File | undefined) => {
    if (!file || !editor) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      if (result) insertImageWithAlign(editor, result, 'left');
    };
    reader.readAsDataURL(file);
  };

  const setAlign = (align: 'left' | 'center' | 'right') => {
    if (!editor) return;
    if (editor.isActive('image')) {
      editor.chain().focus().updateAttributes('image', { align }).run();
      return;
    }
    editor.chain().focus().setTextAlign(align).run();
  };

  const adjustImageWidth = (deltaPx: number) => {
    if (!editor || !editor.isActive('image')) return;
    const attrs = editor.getAttributes('image') as { width?: string | number };
    const currentRaw = attrs.width;
    const currentWidth = currentRaw ? parseInt(String(currentRaw), 10) : 420;
    const safeCurrent = Number.isFinite(currentWidth) ? currentWidth : 420;
    const nextWidth = Math.max(120, Math.min(1200, safeCurrent + deltaPx));
    editor.chain().focus().updateAttributes('image', { width: nextWidth }).run();
  };

  const resetImageWidth = () => {
    if (!editor || !editor.isActive('image')) return;
    editor.chain().focus().updateAttributes('image', { width: null }).run();
  };

  const activeFontColor = String(editor?.getAttributes('textStyle')?.color || '#111827');

  const applyFontColor = (color: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(color).run();
    setColorAnchor(null);
  };

  const clearFontColor = () => {
    if (!editor) return;
    editor.chain().focus().unsetColor().run();
    setColorAnchor(null);
  };

  return (
    <Box
      sx={{
        border: '1px solid #CBD5E1',
        borderRadius: 10,
        overflow: 'hidden',
        bgcolor: '#fff',
        boxSizing: 'border-box',
        ...sx,
      }}
    >
      {showToolbar && !readOnly && editor && (
        <Box
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 0.25,
            px: 0.5,
            py: 0.5,
            borderBottom: '1px solid #CBD5E1',
            bgcolor: '#F5F7FA',
            borderTopLeftRadius: 'inherit',
            borderTopRightRadius: 'inherit',
          }}
        >
          <ToolbarBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()}>
            <FormatBold fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()}>
            <FormatItalic fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Underline" onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <FormatUnderlined fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Strike" onClick={() => editor.chain().focus().toggleStrike().run()}>
            <FormatStrikethrough fontSize="small" />
          </ToolbarBtn>
          <Tooltip title="Font color">
            <IconButton
              size="small"
              onClick={(e) => setColorAnchor(e.currentTarget)}
              sx={{ borderRadius: 0 }}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1 }}>
                <FormatColorText fontSize="small" sx={{ color: activeFontColor === '#FFFFFF' ? '#111827' : activeFontColor }} />
                <Box
                  sx={{
                    mt: '1px',
                    width: 14,
                    height: 3,
                    borderRadius: 0.5,
                    bgcolor: activeFontColor,
                    border: activeFontColor.toLowerCase() === '#ffffff' ? '1px solid #CBD5E1' : 'none',
                  }}
                />
              </Box>
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(colorAnchor)}
            anchorEl={colorAnchor}
            onClose={() => setColorAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            transformOrigin={{ vertical: 'top', horizontal: 'left' }}
          >
            <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 168 }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 0.5 }}>
                {FONT_COLOR_PRESETS.map((color) => (
                  <Box
                    key={color}
                    component="button"
                    type="button"
                    title={color}
                    onClick={() => applyFontColor(color)}
                    sx={{
                      width: 28,
                      height: 28,
                      p: 0,
                      border:
                        activeFontColor.toLowerCase() === color.toLowerCase()
                          ? '2px solid #2563EB'
                          : '1px solid #CBD5E1',
                      borderRadius: 0.5,
                      bgcolor: color,
                      cursor: 'pointer',
                    }}
                  />
                ))}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="input"
                  type="color"
                  value={/^#[0-9A-Fa-f]{6}$/.test(activeFontColor) ? activeFontColor : '#111827'}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => applyFontColor(e.target.value)}
                  sx={{
                    width: 36,
                    height: 28,
                    border: '1px solid #CBD5E1',
                    borderRadius: 0.5,
                    p: 0,
                    bgcolor: 'transparent',
                    cursor: 'pointer',
                  }}
                />
                <IconButton size="small" onClick={clearFontColor} title="Reset color" sx={{ borderRadius: 0 }}>
                  <FormatColorReset fontSize="small" />
                </IconButton>
              </Box>
            </Box>
          </Popover>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <ToolbarBtn title="Heading" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
            <Title fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Quote" onClick={() => editor.chain().focus().toggleBlockquote().run()}>
            <FormatQuote fontSize="small" />
          </ToolbarBtn>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <ToolbarBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()}>
            <FormatListBulleted fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
            <FormatListNumbered fontSize="small" />
          </ToolbarBtn>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <ToolbarBtn title="Align left" onClick={() => setAlign('left')}>
            <FormatAlignLeft fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Align center" onClick={() => setAlign('center')}>
            <FormatAlignCenter fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Align right" onClick={() => setAlign('right')}>
            <FormatAlignRight fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Image smaller" onClick={() => adjustImageWidth(-40)}>
            <ZoomOut fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Image larger" onClick={() => adjustImageWidth(40)}>
            <ZoomIn fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Image default size" onClick={resetImageWidth}>
            <Straighten fontSize="small" />
          </ToolbarBtn>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <ToolbarBtn title="Insert image" onClick={() => imageInputRef.current?.click()}>
            <ImageIcon fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn
            title="Insert table"
            onClick={() =>
              editor
                .chain()
                .focus()
                .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                .run()
            }
          >
            <TableChart fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Horizontal line" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
            <HorizontalRule fontSize="small" />
          </ToolbarBtn>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.25 }} />
          <ToolbarBtn title="Undo" onClick={() => editor.chain().focus().undo().run()}>
            <Undo fontSize="small" />
          </ToolbarBtn>
          <ToolbarBtn title="Redo" onClick={() => editor.chain().focus().redo().run()}>
            <Redo fontSize="small" />
          </ToolbarBtn>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              handleImagePick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </Box>
      )}
      <Box
        sx={{
          ...editorContentSx(minHeight),
          borderBottomLeftRadius: 'inherit',
          borderBottomRightRadius: 'inherit',
          ...(placeholder
            ? {
                '& .tiptap p.is-editor-empty:first-child::before': {
                  content: 'attr(data-placeholder)',
                  color: 'text.disabled',
                  float: 'left',
                  height: 0,
                  pointerEvents: 'none',
                },
              }
            : {}),
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
};

function ToolbarBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" onClick={onClick} sx={{ borderRadius: 0 }}>
        {children}
      </IconButton>
    </Tooltip>
  );
}

export default RichTextEditor;
