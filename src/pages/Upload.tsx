import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface UploadedFile {
  file: File
  preview?: string
  type: 'pdf' | 'image' | 'word' | 'text'
}

export default function Upload() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [selectedWorkType, setSelectedWorkType] = useState<string>('auto')
  const [uploadMode, setUploadMode] = useState<'single' | 'screenshots'>('single') // Новый state

  function getFileType(file: File): 'pdf' | 'image' | 'word' | 'text' | 'invalid' {
    const fileName = file.name.toLowerCase()
    
    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      return 'pdf'
    }
    
    if (file.type.startsWith('image/')) {
      return 'image'
    }
    
    if (file.type.includes('word') || 
        fileName.endsWith('.doc') || 
        fileName.endsWith('.docx') ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return 'word'
    }
    
    if (file.type === 'text/plain' || fileName.endsWith('.txt')) {
      return 'text'
    }
    
    return 'invalid'
  }

  function resetPreviews() {
    uploadedFiles.forEach(file => {
      if (file.preview) {
        URL.revokeObjectURL(file.preview)
      }
    })
  }

  function handleFiles(files: FileList | null) {
    setError(null)
    if (!files || files.length === 0) return

    const newFiles: UploadedFile[] = []
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file) continue

      const fileType = getFileType(file)
      
      if (fileType === 'invalid') {
        setError(`Файл "${file.name}" имеет неподдерживаемый формат.`)
        continue
      }

      if (uploadMode === 'screenshots' && fileType !== 'image') {
        setError(`В режиме скриншотов разрешены только изображения. Файл "${file.name}" не является изображением.`)
        continue
      }

      let preview: string | undefined
      if (fileType === 'image') {
        preview = URL.createObjectURL(file)
      }

      newFiles.push({
        file,
        preview,
        type: fileType
      })
    }
    
    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles])
    }
  }

  async function submitAndGo() {
    if (uploadedFiles.length === 0) {
      setError('Сначала выберите файлы.')
      return
    }

    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      const token = localStorage.getItem('token')
      
      if (!token) {
        throw new Error('Требуется авторизация. Пожалуйста, войдите в систему.')
      }

      let url = 'http://127.0.0.1:8000/api/analyze'
      
      if (uploadMode === 'screenshots') {
        url = 'http://127.0.0.1:8000/api/analyze-screenshots'
        uploadedFiles.forEach(uploadedFile => {
          formData.append('files', uploadedFile.file)
        })
      } else {
        formData.append('file', uploadedFiles[0].file)
      }

      if (selectedWorkType !== 'auto') {
        url += `?work_type=${selectedWorkType}`
      }
      
      console.log(`Sending files to ${url}...`)

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      console.log('Response status:', response.status)

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Ошибка авторизации. Пожалуйста, войдите заново.')
        }
        const errorText = await response.text()
        throw new Error(`Ошибка сервера: ${response.status} - ${errorText}`)
      }

      const result = await response.json()
      console.log('Analysis result:', result)
      
      sessionStorage.setItem('analysis_result', JSON.stringify(result))
      
      if (uploadMode === 'screenshots') {
        sessionStorage.setItem('uploaded_file_name', `Объединенные скриншоты (${uploadedFiles.length} файлов)`)
      } else {
        sessionStorage.setItem('uploaded_file_name', uploadedFiles[0].file.name)
      }
      
      sessionStorage.setItem('uploaded_file_type', uploadMode === 'screenshots' ? 'combined_screenshots' : uploadedFiles[0].type)
      
      navigate('/analysis')
      
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Ошибка при анализе файлов')
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
  }

  function removeFile(index: number) {
    if (uploadedFiles[index]?.preview) {
      URL.revokeObjectURL(uploadedFiles[index].preview!)
    }
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  function clearAllFiles() {
    resetPreviews()
    setUploadedFiles([])
  }

  const renderFileIcon = (file: UploadedFile) => {
    if (file.preview) {
      return <img src={file.preview} alt="preview" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />
    }
    
    const iconStyle = {
      width: 64, 
      height: 64, 
      borderRadius: 8, 
      background: '#f3f4f6',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      border: '1px solid rgba(15,23,32,0.06)', 
      color: 'var(--text)',
      fontSize: '12px',
      fontWeight: 600
    }

    switch (file.type) {
      case 'pdf':
        return <div style={iconStyle}>PDF</div>
      case 'word':
        return <div style={iconStyle}>WORD</div>
      case 'image':
        return <div style={iconStyle}>IMG</div>
      case 'text':
        return <div style={iconStyle}>TXT</div>
      default:
        return <div style={iconStyle}>FILE</div>
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div style={{ maxWidth: 820, margin: '40px auto' }}>
      <div className="upload-card">
        <h2 className="upload-title">Загрузка отчетов</h2>
        
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
            Режим загрузки:
          </label>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                value="single"
                checked={uploadMode === 'single'}
                onChange={(e) => {
                  setUploadMode(e.target.value as 'single' | 'screenshots')
                  clearAllFiles()
                }}
              />
              <span>Один файл (PDF, Word, TXT, изображение)</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="radio"
                value="screenshots"
                checked={uploadMode === 'screenshots'}
                onChange={(e) => {
                  setUploadMode(e.target.value as 'single' | 'screenshots')
                  clearAllFiles()
                }}
              />
              <span>Несколько скриншотов (объединенный анализ)</span>
            </label>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {uploadMode === 'single' 
              ? 'Загрузите один файл любого поддерживаемого формата'
              : 'Загрузите несколько скриншотов - они будут объединены в один документ для анализа'
            }
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: 'var(--text)' }}>
            Тип работы:
          </label>
          <select 
            value={selectedWorkType}
            onChange={(e) => setSelectedWorkType(e.target.value)}
            className="input"
            style={{ width: '100%', padding: '10px' }}
          >
            <option value="auto">Автоопределение</option>
            <option value="lab_report">Лабораторная работа</option>
            <option value="course_work">Курсовая работа</option>
            <option value="essay">Реферат/Эссе</option>
            <option value="thesis">Дипломная работа</option>
          </select>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            {selectedWorkType === 'auto' 
              ? 'Система сама определит тип работы по содержимому' 
              : `Будет проверяться как: ${{
                  'lab_report': 'Лабораторная работа',
                  'course_work': 'Курсовая работа', 
                  'essay': 'Реферат/Эссе',
                  'thesis': 'Дипломная работа'
                }[selectedWorkType]}`
            }
          </div>
        </div>

        <div 
          className="dropzone" 
          onDrop={onDrop} 
          onDragOver={(e) => e.preventDefault()}
        >
          <p style={{ color: 'var(--text)', fontWeight: 600 }}>
            {uploadMode === 'single' 
              ? 'Перетащите файл сюда или выберите вручную'
              : 'Перетащите скриншоты сюда или выберите вручную'
            }
          </p>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            {uploadMode === 'single'
              ? 'Поддерживаемые форматы: .pdf, .doc, .docx, .txt, .jpg, .png, .gif'
              : 'Разрешены только изображения: .jpg, .png, .gif'
            }
            <br />
            <strong>Выбрано файлов: {uploadedFiles.length}</strong>
          </p>

          <input 
            ref={inputRef} 
            id="file" 
            className="file-input" 
            type="file"
            accept={uploadMode === 'single' ? ".pdf,.doc,.docx,.txt,image/*" : "image/*"}
            onChange={onInput} 
            multiple={uploadMode === 'screenshots'}
          />

          <label htmlFor="file" className="file-btn" role="button">
            {uploadMode === 'single' ? 'Выберите файл' : 'Выберите скриншоты'}
          </label>

          {error && (
            <div style={{ 
              color: '#c53030', 
              marginTop: 12, 
              padding: '8px 12px',
              backgroundColor: '#fff5f5',
              border: '1px solid #fed7d7',
              borderRadius: 8
            }}>
              {error}
            </div>
          )}
        </div>

        {uploadedFiles.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: 16
            }}>
              <h3 style={{ margin: 0, color: 'var(--text)' }}>
                {uploadMode === 'single' ? 'Выбранный файл' : `Выбранные скриншоты (${uploadedFiles.length})`}
              </h3>
              <button 
                className="btn" 
                onClick={clearAllFiles}
                disabled={uploading}
                style={{ fontSize: '14px' }}
              >
                Очистить все
              </button>
            </div>

            <div style={{ 
              display: 'grid', 
              gap: '12px',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '8px'
            }}>
              {uploadedFiles.map((uploadedFile, index) => (
                <div 
                  key={index}
                  style={{ 
                    padding: '16px',
                    border: '1px solid var(--control-border)',
                    borderRadius: '8px',
                    background: 'var(--page-bg)',
                    display: 'flex',
                    gap: '16px',
                    alignItems: 'center'
                  }}
                >
                  {renderFileIcon(uploadedFile)}
                  
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                      {uploadedFile.file.name}
                    </div>
                    <div style={{ color: 'var(--muted)', marginTop: 4, fontSize: '14px' }}>
                      {formatFileSize(uploadedFile.file.size)} • {uploadedFile.type.toUpperCase()}
                    </div>
                  </div>

                  <button 
                    className="btn" 
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                    style={{ fontSize: '14px', padding: '6px 12px' }}
                  >
                    Удалить
                  </button>
                </div>
              ))}
            </div>

            <div style={{ 
              marginTop: 20, 
              paddingTop: 20, 
              borderTop: '1px solid var(--control-border)',
              display: 'flex',
              justifyContent: 'flex-end'
            }}>
              <button 
                className="btn btn-primary btn-large" 
                onClick={submitAndGo}
                disabled={uploading}
              >
                {uploading 
                  ? `Анализ...` 
                  : uploadMode === 'screenshots' 
                    ? `Анализировать ${uploadedFiles.length} скриншотов как один документ`
                    : 'Анализировать файл'
                }
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}