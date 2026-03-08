#!/usr/bin/env python3
"""
CC Tips 收集和转换脚本

功能：
- 读取 docs/cc-tips/ 目录下的所有 .md 文件
- 从 Markdown 表格中提取 tips
- 转换为 JSON 格式输出到 asserts/data/tips.json

用法：
    python scripts/collect_tips.py
"""

import json
import re
import os
from pathlib import Path
from datetime import datetime


def extract_tips_from_markdown(file_path: Path) -> list[dict]:
    """从 Markdown 文件中提取 tips"""

    content = file_path.read_text(encoding='utf-8')
    tips = []

    # 提取分类（从 ## 或 ### 标题）
    current_category = "通用"
    category_pattern = re.compile(r'^#{2,3}\s+(.+)$', re.MULTILINE)

    # 表格行匹配（格式：| 标题 | 内容 |）
    table_row_pattern = re.compile(
        r'^\|\s*`?([^|`]+)`?\s*\|\s*([^|]+)\s*\|$',
        re.MULTILINE
    )

    # 快捷键表格匹配（特殊格式：| 快捷键 | 功能 |）
    shortcut_pattern = re.compile(
        r'^\|\s*`?([^|`]+)`?\s*\|\s*([^|]+)\s*\|$',
        re.MULTILINE
    )

    lines = content.split('\n')
    for i, line in enumerate(lines):
        # 更新当前分类
        category_match = category_pattern.match(line)
        if category_match:
            current_category = category_match.group(1).strip()
            # 清理分类名称
            current_category = re.sub(r'[📋⌨️🔧🚀⚡💡❓📚]', '', current_category).strip()
            continue

        # 匹配表格行
        row_match = table_row_pattern.match(line)
        if row_match:
            title = row_match.group(1).strip()
            content_text = row_match.group(2).strip()

            # 跳过表头行
            if title.lower() in ['命令', '快捷键', '符号', '工具', '模式', '文件']:
                continue
            if '---' in title:
                continue

            # 确定分类
            category = current_category
            if '快捷键' in line or '`' in title and any(k in title for k in ['Ctrl', 'Shift', 'Alt', 'Cmd', 'Esc', 'Tab']):
                category = "快捷键"
            elif title.startswith('/') or title.startswith('!'):
                category = "命令"
            elif 'MCP' in category or 'Skill' in category:
                category = "MCP技能"

            tip = {
                "title": title,
                "content": content_text,
                "category": category,
                "source": file_path.name
            }

            # 去重检查
            if not any(t['title'] == title and t['content'] == content_text for t in tips):
                tips.append(tip)

    return tips


def collect_all_tips(input_dir: Path) -> list[dict]:
    """收集所有 Markdown 文件中的 tips"""

    all_tips = []
    tip_id = 1

    # 按文件名排序处理
    md_files = sorted(input_dir.glob('*.md'))

    for md_file in md_files:
        print(f"📄 处理: {md_file.name}")
        tips = extract_tips_from_markdown(md_file)

        for tip in tips:
            tip['id'] = tip_id
            all_tips.append(tip)
            tip_id += 1

        print(f"   提取 {len(tips)} 条 tips")

    return all_tips


def save_tips_json(tips: list[dict], output_path: Path):
    """保存 tips 为 JSON 文件"""

    output_path.parent.mkdir(parents=True, exist_ok=True)

    data = {
        "metadata": {
            "generated_at": datetime.now().isoformat(),
            "total_tips": len(tips),
            "version": "1.0"
        },
        "tips": tips
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n✅ 已保存 {len(tips)} 条 tips 到: {output_path}")


def main():
    """主函数"""

    # 路径配置 - 脚本位于 docs/cc-tips/，项目根目录是其父目录的父目录
    script_dir = Path(__file__).parent
    project_root = script_dir.parent.parent
    input_dir = script_dir  # 当前目录就是输入目录
    output_path = project_root / 'asserts' / 'data' / 'tips.json'

    print("=" * 50)
    print("📝 CC Tips 收集转换工具")
    print("=" * 50)
    print(f"\n📂 输入目录: {input_dir}")
    print(f"📂 输出文件: {output_path}\n")

    # 检查输入目录
    if not input_dir.exists():
        print(f"❌ 错误: 输入目录不存在: {input_dir}")
        return 1

    # 收集 tips
    tips = collect_all_tips(input_dir)

    if not tips:
        print("⚠️ 警告: 未找到任何 tips")
        return 1

    # 保存 JSON
    save_tips_json(tips, output_path)

    # 统计信息
    categories = {}
    for tip in tips:
        cat = tip['category']
        categories[cat] = categories.get(cat, 0) + 1

    print("\n📊 分类统计:")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        print(f"   - {cat}: {count} 条")

    print("\n" + "=" * 50)
    print("✨ 完成!")
    print("=" * 50)

    return 0


if __name__ == '__main__':
    exit(main())
