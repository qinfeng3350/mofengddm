/**
 * 钉钉数据同步脚本
 * 使用方法: node scripts/sync-dingtalk.js <appKey> <appSecret>
 */

const mysql = require('mysql2/promise');
const axios = require('axios');

// 从命令行参数或环境变量获取配置
const appKey = process.argv[2] || process.env.DINGTALK_APP_KEY;
const appSecret = process.argv[3] || process.env.DINGTALK_APP_SECRET;

if (!appKey || !appSecret) {
  console.error('使用方法: node scripts/sync-dingtalk.js <appKey> <appSecret>');
  console.error('或者设置环境变量: DINGTALK_APP_KEY 和 DINGTALK_APP_SECRET');
  console.error('\n请提供钉钉的 AppKey 和 AppSecret 才能执行同步。');
  console.error('您可以在钉钉开放平台获取这些信息：https://open.dingtalk.com/');
  process.exit(1);
}

// 数据库配置（从环境变量或默认值）
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mofengddm',
};

// API配置
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function syncDingtalk() {
  try {
    console.log('开始同步钉钉数据...');
    console.log(`AppKey: ${appKey}`);
    console.log(`API地址: ${API_BASE_URL}`);

    // 调用同步API
    const response = await axios.post(
      `${API_BASE_URL}/api/dingtalk/sync/organization`,
      {
        appKey,
        appSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 300000, // 5分钟超时
      }
    );

    if (response.data.success) {
      console.log('\n✅ 同步成功！');
      console.log(response.data.message);
      
      if (response.data.data) {
        const { departments, users } = response.data.data;
        console.log('\n📊 同步统计:');
        console.log(`  部门: 总计 ${departments.total} 个，新增 ${departments.created} 个，更新 ${departments.updated} 个`);
        if (departments.errors.length > 0) {
          console.log(`  部门错误: ${departments.errors.length} 个`);
        }
        console.log(`  用户: 总计 ${users.total} 人，新增 ${users.created} 人，更新 ${users.updated} 人`);
        if (users.errors.length > 0) {
          console.log(`  用户错误: ${users.errors.length} 个`);
        }
      }
    } else {
      console.error('\n❌ 同步失败:', response.data.message || '未知错误');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ 同步过程中发生错误:');
    if (error.response) {
      console.error(`  状态码: ${error.response.status}`);
      console.error(`  错误信息: ${error.response.data?.message || error.response.data || error.message}`);
    } else if (error.request) {
      console.error('  无法连接到API服务器，请确保后端服务正在运行');
      console.error(`  API地址: ${API_BASE_URL}`);
    } else {
      console.error(`  错误: ${error.message}`);
    }
    process.exit(1);
  }
}

// 执行同步
syncDingtalk();

