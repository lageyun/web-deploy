import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default function Home() {
  const todos = getDb().prepare('SELECT id, title FROM todos ORDER BY id').all() as { id: number; title: string }[];
  return (
    <main>
      <h1>待办事项</h1>
      <p>访问地址（构建时注入）：{process.env.NEXT_PUBLIC_APP_URL ?? '未设置'}</p>
      <p>SQLite 版本：{(getDb().prepare('select sqlite_version() v').get() as { v: string }).v}</p>
      <ul>{todos.map((t) => <li key={t.id}>{t.title}</li>)}</ul>
    </main>
  );
}
