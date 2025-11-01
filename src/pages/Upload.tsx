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
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedWorkType, setSelectedWorkType] = useState<string>('auto')

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

  function resetPreview() {
    if (uploadedFile?.preview) {
      URL.revokeObjectURL(uploadedFile.preview)
    }
  }

  function handleFiles(files: FileList | null) {
    setError(null)
    if (!files || files.length === 0) return

    const file = files.item(0)
    if (!file) return

    const fileType = getFileType(file)
    
    if (fileType === 'invalid') {
      setError('Разрешены только PDF, Word документы (.doc, .docx), текстовые файлы (.txt) или изображения (JPG, PNG, GIF).')
      return
    }

    let preview: string | undefined
    if (fileType === 'image') {
      preview = URL.createObjectURL(file)
    }

    const uploaded: UploadedFile = {
      file,
      preview,
      type: fileType
    }
    
    setUploadedFile(uploaded)
  }

  async function submitAndGo() {
    if (!uploadedFile) {
      setError('Сначала выберите файл.')
      return
    }

    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', uploadedFile.file)
      
      const token = localStorage.getItem('token')
      
      if (!token) {
        throw new Error('Требуется авторизация. Пожалуйста, войдите в систему.')
      }

      console.log('Sending file to analyze...', uploadedFile.file.name)
      
      let url = 'http://127.0.0.1:8000/api/analyze'
      if (selectedWorkType !== 'auto') {
        url += `?work_type=${selectedWorkType}`
      }
      
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
      sessionStorage.setItem('uploaded_file_name', uploadedFile.file.name)
      sessionStorage.setItem('uploaded_file_type', uploadedFile.type)
      
      navigate('/analysis')
      
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Ошибка при анализе файла')
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

  function removeFile() {
    resetPreview()
    setUploadedFile(null)
  }

  const renderFileIcon = () => {
    if (uploadedFile?.preview) {
      return <img src={uploadedFile.preview} alt="preview" className="thumb" />
    }
    
    const iconStyle = {
      width: 96, 
      height: 96, 
      borderRadius: 8, 
      background: '#f3f4f6',
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      border: '1px solid rgba(15,23,32,0.06)', 
      color: 'var(--text)',
      fontSize: '14px',
      fontWeight: 600
    }

    switch (uploadedFile?.type) {
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
        <h2 className="upload-title">Загрузка отчета</h2>
        <p className="upload-desc">
          Загрузите файл для анализа структуры. Поддерживаются PDF, Word документы, текстовые файлы и изображения.
        </p>

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
            Перетащите файл сюда или выберите вручную
          </p>
          <p style={{ color: 'var(--muted)', marginTop: 6 }}>
            Поддерживаемые форматы: .pdf, .doc, .docx, .txt, .jpg, .png, .gif
          </p>

          <input 
            ref={inputRef} 
            id="file" 
            className="file-input" 
            type="file"
            accept=".pdf,.doc,.docx,.txt,image/*"
            onChange={onInput} 
          />

          <label htmlFor="file" className="file-btn" role="button">
            Выберите файл
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

        {uploadedFile && (
          <div className="upload-meta" style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              {renderFileIcon()}
              
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                  {uploadedFile.file.name}
                </div>
                <div style={{ color: 'var(--muted)', marginTop: 4 }}>
                  {formatFileSize(uploadedFile.file.size)} • {uploadedFile.type.toUpperCase()}
                </div>
                {uploading && (
                  <div style={{ color: 'var(--accent)', marginTop: 4, fontSize: '14px' }}>
                    ⏳ Анализируется...
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button 
                  className="btn" 
                  onClick={removeFile} 
                  disabled={uploading}
                >
                  Удалить
                </button>
                <button 
                  className="btn btn-primary btn-large" 
                  onClick={submitAndGo}
                  disabled={uploading}
                >
                  {uploading ? 'Анализ...' : 'Анализировать'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


