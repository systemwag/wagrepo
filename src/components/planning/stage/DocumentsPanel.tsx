'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, File, FileImage, FileText, Loader2, Paperclip, Plus, X,
} from 'lucide-react'
import type { DesignStage, StageDocument } from '@/lib/constants/design-stages'
import { attachStageDocument, deleteStageDocument } from '@/lib/actions/stages'
import { MAX_DOCUMENT_BYTES } from '@/lib/constants/documents'
import { createClient } from '@/lib/supabase/client'
import SectionBlock from './SectionBlock'

const BUCKET = 'project-files'
const ALLOWED_TYPES = '.pdf,.jpg,.jpeg,.png'

function getMimeIcon(mime: string | null) {
  if (!mime) return <File size={16} style={{ color: 'var(--text-dim)' }} />
  if (mime === 'application/pdf') return <FileText size={16} style={{ color: '#f87171' }} />
  if (mime.startsWith('image/')) return <FileImage size={16} style={{ color: '#60a5fa' }} />
  return <File size={16} style={{ color: 'var(--text-dim)' }} />
}

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`
}

function splitName(filename: string): { base: string; ext: string } {
  const dot = filename.lastIndexOf('.')
  if (dot <= 0) return { base: filename, ext: '' }
  return { base: filename.slice(0, dot), ext: filename.slice(dot + 1).toLowerCase() }
}

export default function DocumentsPanel({
  stage,
  projectId,
  canManage,
}: {
  stage: DesignStage
  projectId: string
  canManage: boolean
}) {
  const router = useRouter()
  const [docs, setDocs] = useState<StageDocument[]>(stage.stage_documents ?? [])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  const dragCounterRef = useRef(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Двухшаговый upload: 1) выбрали файл → превью, 2) подтвердили → загрузка.
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [pendingBase, setPendingBase] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const pendingExt = pendingFile ? splitName(pendingFile.name).ext || 'bin' : ''
  const pendingIsImage = !!pendingFile?.type.startsWith('image/')
  const pendingTooBig = !!pendingFile && pendingFile.size > MAX_DOCUMENT_BYTES

  function resetInputs() {
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    acceptFile(file)
    resetInputs()
  }

  function acceptFile(file: File) {
    setUploadError(null)
    const { base } = splitName(file.name)
    setPendingFile(file)
    setPendingBase(base)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
  }

  // Drag-drop. Используем счётчик dragEnter/dragLeave — иначе при наведении
  // на дочерние элементы leave срабатывает преждевременно (event bubble).
  function handleDragEnter(e: React.DragEvent) {
    if (!canManage || pendingFile) return
    e.preventDefault()
    dragCounterRef.current += 1
    if (dragCounterRef.current === 1) setDragActive(true)
  }
  function handleDragLeave(e: React.DragEvent) {
    if (!canManage || pendingFile) return
    e.preventDefault()
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1)
    if (dragCounterRef.current === 0) setDragActive(false)
  }
  function handleDragOver(e: React.DragEvent) {
    if (!canManage || pendingFile) return
    e.preventDefault()
  }
  function handleDrop(e: React.DragEvent) {
    if (!canManage || pendingFile) return
    e.preventDefault()
    dragCounterRef.current = 0
    setDragActive(false)
    const file = e.dataTransfer.files?.[0]
    if (file) acceptFile(file)
  }

  function handleCancel() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPendingFile(null)
    setPendingBase('')
    setPreviewUrl(null)
    setUploadError(null)
  }

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  async function handleConfirmUpload() {
    if (!pendingFile || pendingTooBig) return
    setUploading(true)
    setUploadError(null)

    const supabase = createClient()

    const ext  = pendingExt
    const path = `projects/${projectId}/stages/${stage.id}/${Date.now()}.${ext}`
    const trimmedBase = pendingBase.trim() || splitName(pendingFile.name).base
    const displayName = ext ? `${trimmedBase}.${ext}` : trimmedBase

    const { error: storageError } = await supabase.storage
      .from(BUCKET)
      .upload(path, pendingFile, { upsert: false })

    if (storageError) {
      setUploadError(storageError.message)
      setUploading(false)
      return
    }

    // Insert в documents + запись в activity_log делает Server Action —
    // централизованный журнал прогресса проекта.
    const result = await attachStageDocument({
      stageId:   stage.id,
      projectId,
      name:      displayName,
      filePath:  path,
      fileSize:  pendingFile.size,
      mimeType:  pendingFile.type || null,
    })

    if (result.error) {
      setUploadError(result.error)
    } else if (result.doc) {
      const doc = result.doc as unknown as StageDocument
      setDocs(prev => [...prev, doc])
      handleCancel()
      router.refresh()
    }

    setUploading(false)
  }

  async function handleDelete(doc: StageDocument) {
    setDeletingId(doc.id)
    const result = await deleteStageDocument(doc.id, doc.file_path, projectId)
    if (!result.error) {
      setDocs(prev => prev.filter(d => d.id !== doc.id))
      router.refresh()
    }
    setDeletingId(null)
  }

  async function handleOpen(doc: StageDocument) {
    const supabase = createClient()
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_path, 60 * 60)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <SectionBlock icon={<Paperclip size={13} />} title="Документы" count={docs.length > 0 ? String(docs.length) : undefined}>
      <div
        className="rounded-xl overflow-hidden relative"
        style={{ border: '1px solid var(--border)' }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Drag-over оверлей */}
        {dragActive && (
          <div
            className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none rounded-xl"
            style={{
              background: 'color-mix(in oklab, var(--color-green) 12%, transparent)',
              border: '2px dashed var(--color-green)',
              backdropFilter: 'blur(2px)',
            }}
          >
            <Paperclip size={28} style={{ color: 'var(--color-green)' }} />
            <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-green)' }}>
              Отпустите файл для загрузки
            </p>
          </div>
        )}

        {/* Ошибка */}
        {uploadError && (
          <div className="px-3 py-2 flex items-center gap-2 text-sm"
            style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', borderBottom: '1px solid var(--border)' }}>
            <AlertTriangle size={13} />
            {uploadError}
          </div>
        )}

        {/* Список файлов */}
        {docs.length > 0 && (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {docs.map(doc => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 group">
                <span className="flex-shrink-0">{getMimeIcon(doc.mime_type)}</span>

                <button
                  type="button"
                  onClick={() => handleOpen(doc)}
                  aria-label={`Открыть документ: ${doc.name}`}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-medium truncate doc-name">
                    {doc.name}
                  </p>
                  {doc.file_size && (
                    <p className="text-xs" style={{ color: 'var(--text-dim)' }}>{formatBytes(doc.file_size)}</p>
                  )}
                </button>

                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleDelete(doc)}
                    disabled={deletingId === doc.id}
                    aria-label={`Удалить документ: ${doc.name}`}
                    className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-40 p-1 rounded-lg row-icon-danger"
                  >
                    {deletingId === doc.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <X size={14} />
                    }
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Пусто */}
        {docs.length === 0 && !uploading && (
          <div className="px-3 py-4 flex items-center gap-2 justify-center">
            <Paperclip size={13} style={{ color: 'var(--text-dim)' }} />
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Нет прикреплённых файлов</p>
          </div>
        )}

        {/* Превью перед загрузкой */}
        {pendingFile && (
          <div
            className="flex flex-col gap-3 px-3 py-3"
            style={{ borderTop: docs.length > 0 || uploadError ? '1px solid var(--border)' : 'none', background: 'var(--surface-2)' }}
          >
            {pendingIsImage && previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Превью"
                className="w-full max-h-64 object-contain rounded-lg"
                style={{ background: 'var(--bg)' }}
              />
            ) : (
              <div className="flex items-center gap-3 px-3 py-3 rounded-lg" style={{ background: 'var(--surface)' }}>
                <span className="flex-shrink-0">{getMimeIcon(pendingFile.type)}</span>
                <span className="text-sm truncate flex-1" style={{ color: 'var(--text)' }}>{pendingFile.name}</span>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <label className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Название</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={pendingBase}
                  onChange={e => setPendingBase(e.target.value)}
                  placeholder="Название файла"
                  className="input flex-1"
                />
                {pendingExt && (
                  <span className="text-sm num shrink-0" style={{ color: 'var(--text-dim)' }}>.{pendingExt}</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span
                className="text-xs"
                style={{ color: pendingTooBig ? 'var(--color-danger)' : 'var(--text-dim)' }}
              >
                {formatBytes(pendingFile.size)}
                {pendingTooBig && ' · слишком большой, лимит 10 МБ'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={uploading}
                  className="text-sm px-3 py-1.5 rounded-lg"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Отменить
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUpload}
                  disabled={uploading || pendingTooBig || !pendingBase.trim()}
                  className="text-sm px-3 py-1.5 rounded-lg font-medium flex items-center gap-1.5 disabled:opacity-40"
                  style={{ background: 'var(--color-green)', color: '#040d07' }}
                >
                  {uploading
                    ? <><Loader2 size={13} className="animate-spin" /> Загрузка...</>
                    : <>Загрузить</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Кнопки выбора файла — две: «Прикрепить файл» (всегда) и «Сделать фото»
            (только на тач-устройствах через capture="environment"). RLS на
            documents.INSERT разрешает всех аутентифицированных, см. миграцию 043. */}
        {!pendingFile && (
          <div
            className="flex"
            style={{ borderTop: docs.length > 0 || uploadError ? '1px solid var(--border)' : 'none' }}
          >
            <label
              className="flex-1 flex items-center justify-center gap-2 text-sm px-3 py-2.5 cursor-pointer"
              style={{ color: 'var(--green)', background: 'var(--surface-2)' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES}
                onChange={handlePick}
                className="sr-only"
              />
              <Plus size={14} /> Прикрепить файл
            </label>

            <label
              className="touch-only flex-1 items-center justify-center gap-2 text-sm px-3 py-2.5 cursor-pointer"
              style={{
                color: 'var(--green)',
                background: 'var(--surface-2)',
                borderLeft: '1px solid var(--border)',
              }}
            >
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePick}
                className="sr-only"
              />
              <FileImage size={14} /> Сделать фото
            </label>
          </div>
        )}
      </div>
    </SectionBlock>
  )
}
