'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic } from 'lucide-react'

// ── Голосовой ввод ─────────────────────────────────────────────────────────
// Web Speech API. В Firefox нет — fallback: textarea без mic-кнопки.
type SpeechRecognitionAPI = new () => {
  lang: string; continuous: boolean; interimResults: boolean
  start(): void; stop(): void; abort(): void
  onstart: (() => void) | null
  onresult: ((e: {
    resultIndex: number
    results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>
  }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionAPI
  webkitSpeechRecognition?: SpeechRecognitionAPI
}

export default function VoiceTextarea({
  value, onChange, rows = 3, placeholder, maxLength, required,
}: {
  value: string
  onChange: (v: string) => void
  rows?: number
  placeholder?: string
  maxLength?: number
  required?: boolean
}) {
  const [isListening, setIsListening] = useState(false)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const recRef = useRef<InstanceType<SpeechRecognitionAPI> | null>(null)
  const baseRef = useRef<string>('')

  useEffect(() => {
    if (!isListening) baseRef.current = value
  }, [value, isListening])

  function stopListening() {
    recRef.current?.stop()
    setIsListening(false)
  }

  function startListening() {
    const SR = (window as WindowWithSpeech).SpeechRecognition || (window as WindowWithSpeech).webkitSpeechRecognition
    if (!SR) { setVoiceError('Браузер не поддерживает голосовой ввод'); return }
    try {
      const rec = new SR()
      rec.lang = 'ru-RU'
      rec.continuous     = true
      rec.interimResults = true
      baseRef.current = value
      rec.onstart = () => { setIsListening(true); setVoiceError(null) }
      rec.onresult = (e) => {
        let finalText = ''
        let interimText = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i] as ArrayLike<{ transcript: string }> & { isFinal: boolean }
          const t = r[0].transcript
          if (r.isFinal) finalText += t
          else interimText += t
        }
        if (finalText) {
          baseRef.current = (baseRef.current + ' ' + finalText).trimStart()
          onChange(baseRef.current)
        } else if (interimText) {
          onChange((baseRef.current + ' ' + interimText).trimStart())
        }
      }
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return
        setVoiceError('Ошибка: ' + e.error)
        setIsListening(false)
      }
      rec.onend = () => setIsListening(false)
      recRef.current = rec
      rec.start()
    } catch {
      setIsListening(false)
      setVoiceError('Не удалось запустить микрофон. Проверьте разрешения.')
    }
  }

  useEffect(() => () => { recRef.current?.abort() }, [])

  // Counter для maxLength — показывается, когда осталось ≤20% или есть лимит и юзер что-то ввёл.
  const showCounter = maxLength != null && value.length > 0
  const remainingPct = maxLength ? (maxLength - value.length) / maxLength : 1
  const counterColor = remainingPct < 0.1 ? 'var(--color-danger)'
                     : remainingPct < 0.2 ? 'var(--color-warn)'
                     : 'var(--color-text-dim)'

  return (
    <div>
      <div className="relative">
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          rows={rows} placeholder={placeholder}
          maxLength={maxLength}
          required={required}
          spellCheck={false}
          className="w-full outline-none resize-none text-sm rounded-xl p-3 transition-all focus:outline-none"
          style={{
            background: 'var(--color-surface-2)',
            border: `1px solid ${isListening ? 'var(--color-green)' : 'var(--color-border)'}`,
            color: 'var(--color-text)', fontFamily: 'inherit', paddingRight: '60px',
            caretColor: 'var(--color-green)',
            boxShadow: isListening ? '0 0 0 3px color-mix(in oklab, var(--color-green) 18%, transparent)' : 'none',
            transition: 'border-color 0.2s, box-shadow 0.2s',
          }}
        />
        <button type="button" onClick={isListening ? stopListening : startListening}
          aria-label={isListening ? 'Остановить запись' : 'Голосовой ввод'}
          title={isListening ? 'Остановить запись' : 'Голосовой ввод'}
          className="absolute right-2 top-2 w-11 h-11 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: isListening ? 'var(--color-green)' : 'color-mix(in oklab, var(--color-green) 8%, transparent)',
            color: isListening ? '#fff' : 'var(--color-green)',
            border: `1px solid ${isListening ? 'rgba(34,197,94,0.5)' : 'color-mix(in oklab, var(--color-green) 30%, transparent)'}`,
          }}>
          <Mic size={17} className={isListening ? 'animate-pulse' : ''} />
          {isListening && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{ background: '#f87171', boxShadow: '0 0 6px rgba(239,68,68,0.8)' }} />
          )}
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 mt-1 px-1 min-h-[16px]">
        {voiceError
          ? <p className="text-xs" style={{ color: '#f87171' }}>{voiceError}</p>
          : <span />}
        {showCounter && (
          <span className="text-xs num tabular-nums" style={{ color: counterColor }}>
            {value.length} / {maxLength}
          </span>
        )}
      </div>
    </div>
  )
}
