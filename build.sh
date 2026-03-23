#!/bin/bash

echo "========================================"
echo "墨枫低代码平台 - 构建脚本"
echo "========================================"
echo ""

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo "[错误] 未找到 Node.js，请先安装 Node.js >= 20.0.0"
    exit 1
fi

# 检查 pnpm
if ! command -v pnpm &> /dev/null; then
    echo "[错误] 未找到 pnpm，正在安装..."
    npm install -g pnpm
    if [ $? -ne 0 ]; then
        echo "[错误] pnpm 安装失败"
        exit 1
    fi
fi

echo "[1/3] 检查依赖..."
if [ ! -d "node_modules" ]; then
    echo "正在安装依赖..."
    pnpm install
    if [ $? -ne 0 ]; then
        echo "[错误] 依赖安装失败"
        exit 1
    fi
fi

echo "[2/3] 构建前端..."
cd apps/portal
pnpm build
if [ $? -ne 0 ]; then
    echo "[错误] 前端构建失败"
    cd ../..
    exit 1
fi
cd ../..

echo "[3/3] 构建后端..."
cd services/core
pnpm build
if [ $? -ne 0 ]; then
    echo "[错误] 后端构建失败"
    cd ../..
    exit 1
fi
cd ../..

echo ""
echo "========================================"
echo "构建完成！"
echo "========================================"
echo "前端构建产物: apps/portal/dist"
echo "后端构建产物: services/core/dist"
echo ""
echo "启动生产服务: pnpm start:prod"
echo "或运行: NODE_ENV=production node services/core/dist/main.js"
echo ""

