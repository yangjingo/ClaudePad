/**
 * 简单的缓存性能测试脚本
 */

async function testCachePerformance() {
  console.log('Testing cache performance...');

  // 导入必要的模块来模拟测试
  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  try {
    // 测试第一次请求时间
    console.time('First Request (Cold Cache)');
    const firstResult = await execAsync('curl -s -w "\\nTime: %{time_total}s" "http://localhost:8080/api/sessions"');
    console.timeEnd('First Request (Cold Cache)');
    console.log(`Response length: ${firstResult.stdout.split('\n')[0].length} chars`);

    // 等待一小段时间确保缓存已设置
    await new Promise(resolve => setTimeout(resolve, 1000));

    // 测试第二次请求时间（应该更快，因为有缓存）
    console.time('Second Request (Warm Cache)');
    const secondResult = await execAsync('curl -s -w "\\nTime: %{time_total}s" "http://localhost:8080/api/sessions"');
    console.timeEnd('Second Request (Warm Cache)');
    console.log(`Response length: ${secondResult.stdout.split('\n')[0].length} chars`);

    console.log('\nCache performance test completed.');

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

// 运行测试
testCachePerformance();