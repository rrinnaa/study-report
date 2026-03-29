import { Link } from 'react-router-dom'
import { ROUTES } from '../constants/routes'

export default function NotFound() {
  return (
    <main className="container" style={{ textAlign: 'center', padding: '64px 20px' }}>
      <h1 className="h1">Страница не найдена</h1>
      <p className="lead" style={{ marginBottom: 24 }}>
        Такой страницы нет или она была перемещена.
      </p>
      <Link to={ROUTES.HOME} className="btn btn-primary">
        На главную
      </Link>
    </main>
  )
}
