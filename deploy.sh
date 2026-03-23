#!/bin/bash

# 墨枫低代码平台 - 宝塔部署脚本
# 使用方法: bash deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署墨枫低代码平台..."

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js，请先安装 Node.js 20+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ 错误: Node.js 版本过低，需要 >= 20.0.0，当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 正在安装 pnpm..."
    npm install -g pnpm
fi

PNPM_VERSION=$(pnpm -v | cut -d'.' -f1)
if [ "$PNPM_VERSION" -lt 10 ]; then
    echo "❌ 错误: pnpm 版本过低，需要 >= 10.0.0，当前版本: $(pnpm -v)"
    exit 1
fi

echo "✅ pnpm 版本: $(pnpm -v)"

# 检查 .env 文件
if [ ! -f "services/core/.env" ]; then
    echo "⚠️  警告: 未找到 services/core/.env 文件"
    echo "📝 正在从 env.example 创建 .env 文件..."
    cp services/core/env.example services/core/.env
    echo "⚠️  请编辑 services/core/.env 文件，填入正确的数据库配置！"
    read -p "按 Enter 继续（确保已配置好 .env）..."
fi

# 安装依赖
echo "📦 正在安装依赖..."
pnpm install

# 构建项目
echo "🔨 正在构建项目..."
pnpm build

# 检查构建结果
if [ ! -f "services/core/dist/main.js" ]; then
    echo "❌ 错误: 后端构建失败，未找到 services/core/dist/main.js"
    exit 1
fi

if [ ! -d "apps/portal/dist" ]; then
    echo "❌ 错误: 前端构建失败，未找到 apps/portal/dist 目录"
    exit 1
fi

echo "✅ 构建完成"

# 创建日志目录
mkdir -p logs

# 检查 PM2
if ! command -v pm2 &> /dev/null; then
    echo "📦 正在安装 PM2..."
    npm install -g pm2
fi

echo "✅ PM2 已安装"

# 停止旧进程（如果存在）
if pm2 list | grep -q "mofengddm"; then
    echo "🛑 正在停止旧进程..."
    pm2 stop mofengddm || true
    pm2 delete mofengddm || true
fi

# 启动应用
echo "🚀 正在启动应用..."
pm2 start ecosystem.config.js

# 保存 PM2 配置
pm2 save

echo ""
echo "✅ 部署完成！"
echo ""
echo "📋 常用命令:"
echo "  查看状态: pm2 list"
echo "  查看日志: pm2 logs mofengddm"
echo "  重启应用: pm2 restart mofengddm"
echo "  停止应用: pm2 stop mofengddm"
echo ""
echo "🌐 访问地址: http://$(hostname -I | awk '{print $1}'):4000"
echo "   或: http://localhost:4000"
echo ""

