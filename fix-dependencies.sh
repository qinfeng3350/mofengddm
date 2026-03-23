#!/bin/bash

# 修复依赖安装问题
# 使用方法: bash fix-dependencies.sh

set -e

echo "🔧 开始修复依赖问题..."

# 检查是否在项目根目录
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 请在项目根目录运行此脚本"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 正在安装 pnpm..."
    npm install -g pnpm
fi

echo "✅ pnpm 版本: $(pnpm -v)"

# 创建 .npmrc 配置文件（解决依赖提升问题）
echo "⚙️  创建 .npmrc 配置文件..."
cat > .npmrc << 'EOF'
# pnpm 配置
# 提升所有依赖到 node_modules（解决 concurrently 找不到 yargs 等问题）
shamefully-hoist=true

# 自动安装 peer dependencies
auto-install-peers=true
EOF

# 设置 pnpm 镜像（加速下载）
echo "⚙️  配置 pnpm 镜像..."
pnpm config set registry https://registry.npmmirror.com

# 清理旧的依赖
echo "🧹 正在清理旧的依赖..."
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf services/*/node_modules
rm -rf packages/*/node_modules

# 清理 lock 文件（可选，如果问题持续存在）
# rm -f pnpm-lock.yaml

# 重新安装依赖
echo "📦 正在重新安装依赖（这可能需要几分钟）..."
pnpm install --force

# 验证 concurrently 是否安装成功
if [ -d "node_modules/concurrently" ]; then
    echo "✅ concurrently 安装成功"
    
    # 检查 yargs 是否存在
    if [ -d "node_modules/yargs" ]; then
        echo "✅ yargs 依赖已安装"
    else
        echo "⚠️  警告: yargs 可能未正确安装，尝试手动安装..."
        pnpm add -D -w yargs
        # 如果还是不行，尝试安装 concurrently 的所有依赖
        pnpm install concurrently --force
    fi
else
    echo "❌ 错误: concurrently 安装失败"
    exit 1
fi

echo ""
echo "✅ 依赖修复完成！"
echo ""
echo "现在可以运行:"
echo "  pnpm dev          # 开发模式"
echo "  pnpm build        # 构建项目"
echo "  pnpm start:prod   # 生产模式启动"
echo ""

