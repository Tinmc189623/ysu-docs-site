// Tailwind 4 走 PostCSS 插件接进构建。站点样式入口是 app/global.css，
// 那里再 @import fumadocs 的主题。
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
