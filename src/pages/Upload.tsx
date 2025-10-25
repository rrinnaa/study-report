import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Upload() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<File | null>(null) 
  const [preview, setPreview] = useState<string | null>(null) 

  function resetPreview() {
    if (preview) {
      URL.revokeObjectURL(preview)
      setPreview(null)
    }
  }

  function handleFiles(files: FileList | null) {
    setError(null)
    if (!files || files.length === 0) return

    const f = files.item(0)
    if (!f) return

    const isPdf = f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    const isImage = f.type.startsWith('image/')
    if (!isPdf && !isImage) {
      setError('Разрешены только PDF или изображения (JPG, PNG).')
      return
    }
    
    const maxBytes = 20 * 1024 * 1024
    if (f.size > maxBytes) {
      setError('Файл слишком большой — максимум 20 MB.')
      return
    }

    // Сохраняем имя для анализа (каркас)
    sessionStorage.setItem('uploaded_file_name', f.name)
    setSelected(f)

    // Создаём превью для изображений
    resetPreview()
    if (isImage) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
  }

  function submitAndGo() {
    if (!selected) {
      setError('Сначала выберите файл.')
      return
    }
    navigate('/analysis')
  }

  return (
    <div style={{ maxWidth: 820, margin: '40px auto' }}>
      <div className="dropzone" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
        <p style={{ color: 'var(--text)', fontWeight: 600 }}>Перетащите файл сюда или выберите вручную</p>
        <p style={{ color: 'var(--muted)', marginTop: 6 }}>Только .pdf, .jpg, .png — остальные форматы отклоняются</p>

        <input ref={inputRef} id="file" className="file-input" type="file"
               accept=".pdf,image/*"
               onChange={onInput} />

        <label htmlFor="file" className="file-btn" role="button" aria-label="Выбрать файл">
          Выберите файл
        </label>

        <button onClick={() => inputRef.current?.click()} className="file-btn secondary" style={{ marginLeft: 12 }}>
          Выбрать ещё
        </button>

        {error && <div style={{ color: '#c53030', marginTop: 12 }}>{error}</div>}
      </div>

      {/* Превью и мета */}
      {selected && (
        <div className="upload-meta" style={{ marginTop: 16, display: 'flex', gap: 16, alignItems: 'center' }}>
          {preview ? (
            <img src={preview} alt="preview" className="thumb" />
          ) : (
            <div style={{
              width: 96, height: 96, borderRadius: 8, background: '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(15,23,32,0.06)', color: 'var(--text)'
            }}>
              PDF
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{selected.name}</div>
            <div style={{ color: 'var(--muted)', marginTop: 6 }}>{(selected.size / 1024 / 1024).toFixed(2)} MB</div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => {
              resetPreview()
              setSelected(null)
              sessionStorage.removeItem('uploaded_file_name')
            }}>Удалить</button>
            <button className="btn btn-primary btn-large" onClick={submitAndGo}>Продолжить</button>
          </div>
        </div>
      )}
    </div>
  )
}


