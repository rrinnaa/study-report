import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

interface SectionInfo {
  id: string
  name: string
  found: boolean
  patterns: string[]
  optional?: boolean
  notes?: string[]
  bonusPoints?: number
}

interface StructureDetails {
  totalSectionsChecked: number
  requiredSectionsFound: number
  totalRequiredSections: number
  contentLength: number
  detectionConfidence: 'high' | 'medium' | 'low'
}

interface AnalysisResult {
  fileName: string
  fileType: string
  workType: string
  detectedType: string
  isValid: boolean
  score: number
  bonusPoints?: number
  penaltyPoints?: number
  sectionsFound: SectionInfo[]
  sectionsMissing: string[]
  errors: string[]
  warnings: string[]
  recommendations: string[]
  structureDetails: StructureDetails
}

export default function Analysis() {
  const navigate = useNavigate()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedResult = sessionStorage.getItem('analysis_result')
    if (!savedResult) {
      navigate(ROUTES.UPLOAD)
      return
    }

    try {
      const analysisResult: AnalysisResult = JSON.parse(savedResult)
      setResult(analysisResult)
    } catch {
      navigate(ROUTES.UPLOAD)
    } finally {
      setLoading(false)
    }
  }, [navigate])

  const handleNewAnalysis = () => {
    sessionStorage.removeItem('analysis_result')
    sessionStorage.removeItem('uploaded_file_name')
    sessionStorage.removeItem('uploaded_file_type')
    navigate(ROUTES.UPLOAD)
  }

  const formatContentSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} символов`
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  const getWorkTypeIcon = (workType: string) => {
    const icons: Record<string, string> = {
      'Лабораторная работа': '🔬',
      'Курсовая работа': '📚',
      'Реферат/Эссе': '📝',
      'Дипломная работа': '🎓'
    }
    return icons[workType] || '📄'
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>🔍 Загружаем результаты анализа...</div>
  if (!result) return <div>Ошибка загрузки анализа</div>

  return (
    <main className="analysis" style={{ padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ margin: 0 }}>Результаты анализа</h1>
        <button className="btn" onClick={handleNewAnalysis}>📊 Новый анализ</button>
      </div>

      <div style={{
        background: result.isValid ? '#f0f9ff' : '#fff5f5',
        border: `1px solid ${result.isValid ? '#bae6fd' : '#fed7d7'}`,
        borderRadius: '8px',
        padding: '16px',
        marginTop: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '24px' }}>{getWorkTypeIcon(result.workType)}</span>
          <div>
            <div style={{ fontWeight: 600 }}>{result.fileName}</div>
            <div style={{ color: '#6b7280', fontSize: '14px' }}>
              {result.workType} • {formatContentSize(result.structureDetails.contentLength)}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '14px', color: '#6b7280' }}>
          <div>
            Оценка структуры: <span style={{ 
              color: result.score > 80 ? '#059669' : result.score > 60 ? '#d97706' : '#dc2626',
              fontWeight: 600
            }}>
              {result.score}%
            </span>
            {result.bonusPoints ? <span style={{ marginLeft: '6px', color: '#2563eb' }}>+{result.bonusPoints} бонус</span> : null}
            {result.penaltyPoints ? <span style={{ marginLeft: '6px', color: '#dc2626' }}>-{result.penaltyPoints} штраф</span> : null}
          </div>
          <div>Найдено разделов: {result.structureDetails.requiredSectionsFound}/{result.structureDetails.totalRequiredSections}</div>
          <div>
            Автоопределение: <span style={{ 
              color: result.structureDetails.detectionConfidence === 'high' ? '#059669' : result.structureDetails.detectionConfidence === 'medium' ? '#d97706' : '#dc2626',
              fontWeight: 500
            }}>
              {result.structureDetails.detectionConfidence === 'high' ? 'высокая' : result.structureDetails.detectionConfidence === 'medium' ? 'средняя' : 'низкая'} точность
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '10px', marginTop: '16px' }}>
        {result.sectionsFound.map((section, i) => (
          <div key={i} style={{
            padding: '12px',
            background: section.found ? (section.optional ? '#f0f9ff' : '#f0fdf4') : (section.optional ? '#fffbeb' : '#fef2f2'),
            border: `1px solid ${section.found ? (section.optional ? '#bae6fd' : '#bbf7d0') : (section.optional ? '#fed7aa' : '#fecaca')}`,
            borderRadius: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', alignItems: 'center' }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>
                {section.name} {section.optional && <span style={{ fontSize: '10px', color: '#d97706', marginLeft: '6px', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px' }}>опционально</span>}
              </div>
              <div style={{ color: section.found ? '#059669' : '#dc2626', fontWeight: 600 }}>{section.found ? '✓' : '✗'}</div>
            </div>
            
            {section.notes && section.notes.length > 0 && (
              <ul style={{ fontSize: '11px', marginTop: '4px', color: '#2563eb', paddingLeft: '16px' }}>
                {section.notes.map((note, j) => <li key={j}>💡 {note}</li>)}
              </ul>
            )}

            {section.bonusPoints && <div style={{ fontSize: '11px', color: '#059669', marginTop: '4px' }}>💰 Бонус: {section.bonusPoints}</div>}
          </div>
        ))}
      </div>

      {result.errors.length > 0 && (
        <div style={{ marginTop: '24px' }}>
          <h4 style={{ color: '#dc2626' }}>❌ Критические ошибки ({result.errors.length}):</h4>
          <div style={{ background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: '8px', padding: '16px' }}>
            {result.errors.map((err, i) => (
              <div key={i} style={{ color: '#dc2626', marginBottom: '8px', padding: '8px', background: '#fef2f2', borderRadius: '4px', borderLeft: '3px solid #dc2626' }}>
                • {err}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#d97706' }}>⚠️ Предупреждения ({result.warnings.length}):</h4>
          <div style={{ background: '#fffbeb', border: '1px solid #fed7aa', borderRadius: '8px', padding: '16px' }}>
            {result.warnings.map((warn, i) => (
              <div key={i} style={{ color: '#d97706', marginBottom: '8px', padding: '8px', background: '#fefce8', borderRadius: '4px', borderLeft: '3px solid #d97706' }}>
                • {warn}
              </div>
            ))}
          </div>
        </div>
      )}

      {result.recommendations.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4 style={{ color: '#2563eb' }}>💡 Рекомендации ({result.recommendations.length}):</h4>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
            {result.recommendations.map((rec, i) => (
              <div key={i} style={{ color: '#2563eb', marginBottom: '8px', padding: '8px', background: '#f0f9ff', borderRadius: '4px', borderLeft: '3px solid #2563eb' }}>
                • {rec}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '24px', padding: '20px', background: result.isValid ? '#f0fdf4' : '#fef2f2', border: `2px solid ${result.isValid ? '#059669' : '#dc2626'}`, borderRadius: '12px', textAlign: 'center' }}>
        <div style={{ fontWeight: 600, fontSize: '20px', color: result.isValid ? '#059669' : '#dc2626', marginBottom: '8px' }}>
          {result.isValid ? '✅ Структура соответствует требованиям' : '❌ Структура требует доработки'}
        </div>
        {!result.isValid && result.sectionsMissing.length > 0 && (
          <div style={{ color: '#6b7280', marginBottom: '12px' }}>
            Отсутствуют обязательные разделы: <strong>{result.sectionsMissing.join(', ')}</strong>
          </div>
        )}
        <div style={{ fontSize: '14px', color: '#6b7280', lineHeight: 1.5 }}>
          {result.isValid ? 
            'Документ имеет правильную структуру для данного типа работы. Рекомендуется проверить содержание разделов.' :
            'Для соответствия требованиям необходимо добавить отсутствующие разделы и исправить критические ошибки.'
          }
        </div>
      </div>
    </main>
  )
}