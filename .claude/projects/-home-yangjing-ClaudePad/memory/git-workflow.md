# Git 工作流程

## 提交前检查清单

1. **启动测试界面** - 在提交前重启服务器并测试功能
2. **提醒变化点** - 向用户展示本次提交的变更内容
3. **等待用户确认** - 获得用户允许后再执行 `git push`

## 命令流程

```bash
# 1. 重启服务器测试
pkill -f "node server" && sleep 1 && node server.js &

# 2. 测试路由
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/idea.html

# 3. 展示变更
git diff HEAD~1 --stat
git diff HEAD~1

# 4. 等待用户确认后才 push
git push
```

## 沟通模板

**提交前提醒：**
```
变更摘要：
- 文件 1: 描述变更
- 文件 2: 描述变更

测试状态：
- [x] 服务器已重启
- [x] 路由测试通过

确认后可以 push 吗？
```
