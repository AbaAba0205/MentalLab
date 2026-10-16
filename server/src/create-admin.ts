import { Store } from './database.js';

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase(), password = process.env.ADMIN_PASSWORD, name = process.env.ADMIN_NAME?.trim() || '管理员';
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 10 || password.length > 128 || name.length > 40) {
  console.error('请在服务器环境中配置有效 ADMIN_EMAIL、10–128 位 ADMIN_PASSWORD 和不超过 40 字的 ADMIN_NAME。');
  process.exitCode = 1;
} else {
  const store = new Store();
  try {
    if (store.email(email)) throw new Error('该邮箱已存在；请使用新的管理员邮箱。');
    await store.createUser(email, name, password, 'admin');
    console.log('管理员已创建。请登录 /admin，随后移除环境中的 ADMIN_PASSWORD。');
  } finally { store.close(); }
}
