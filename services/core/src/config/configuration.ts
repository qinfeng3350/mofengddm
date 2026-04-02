export default () => ({
  port: parseInt(process.env.PORT ?? '4000', 10),
  /** 前端门户公网地址（钉钉待办/消息里的详情链接），与 PORTAL_BASE_URL 等价 */
  portal: {
    baseUrl:
      process.env.PORTAL_BASE_URL ||
      process.env.PORTAL_PUBLIC_BASE_URL ||
      process.env.PUBLIC_PORTAL_URL ||
      '',
  },
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '3306', 10),
    name: process.env.DB_NAME ?? 'mofengddm',
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'mofeng-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
});
