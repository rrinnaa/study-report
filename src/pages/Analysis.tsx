import React from 'react'

export default function Analysis(){
  const fileName = sessionStorage.getItem('uploaded_file_name') || '(файл не загружен)'
  const sampleResult = `Результат анализа (каркас):\n\nФайл: ${fileName}\n\nЗдесь будет вывод: "Ошибок не обнаружено" / "Отсутствует: ..." / "Ошибка в слове: ..."`
  return (
    <div className="analysis">
      <h2 style={{color:'var(--text)'}}>Результат анализа</h2>
      <div style={{marginTop:12, color:'var(--muted)'}}>{sampleResult}</div>
    </div>
  )
}


