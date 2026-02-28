# Release Checklist

每次发布新版本时需要同步更新的内容：

## 必须更新的文件

1. **README.md** - 更新日志部分
   - 在 `## Update` 章节顶部添加新版本号和功能描述
   - 格式：`- **v0.x.xx** - 功能描述`

2. **asserts/** - 截图文件
   - 截取新功能或界面变更的截图
   - 命名格式：`claudepad-v0.x.xx.png`
   - 使用 `git add asserts/claudepad-v*.png` 添加

## 提交流程

```bash
# 1. 添加新截图
git add asserts/claudepad-v0.x.xx.png

# 2. 提交截图（单独提交）
git commit -m "docs: add v0.x.xx screenshot for [功能描述]"

# 3. 更新 README 并提交
git add README.md
git commit -m "docs: update README with v0.x.xx release notes"
git push
```

## 版本发布流程

1. 完成功能开发并测试
2. 截取新功能截图保存到 `asserts/`
3. 更新 `README.md` 的 Update 章节
4. 按上述流程提交和推送

## 最近版本

- v0.2.30 - CC Tips 页面
- v0.2.29 - 导航栏统一样式
- v0.2.28 - CC Ideas 页面
