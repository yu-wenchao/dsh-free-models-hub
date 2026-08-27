==============================================
  dsh-free-models-hub 免费模型榜 · 一键安装说明
==============================================

【这是什么】
免费模型榜是一个用于 DeepSeek Harness（DSH）的社区插件，
在对话界面右侧边缘加一个「🎁」按钮，点开就能看到各家免费
模型排行，一键配置（只要粘贴你的免费网站 API Key 就能用）。

【怎么安装】（非常简单，适合不熟悉电脑的人）
1. 把整个「dsh-free-models-hub-一键安装」文件夹复制到电脑
   上任何一个位置（比如桌面），不要拆开里面的东西。
2. 双击运行里面的  install-free-models-hub.bat
   （如果 Windows 提示"是否允许此应用更改"→ 点"是"）。
3. 窗口会自动检测 DeepSeek Harness 装在哪，并自动装好插件。
4. 看到"插件已安装！"就说明成功了，按回车关闭窗口。

【命令行版 / npx 方式怎么装】（适合会用命令行的用户）
如果你的 DSH 是用命令行 / npx 方式启动的（不是双击 exe），
同样能一条命令装好：
1. 先确保命令行里能运行 dsh 和 pnpm。
2. 双击运行  install-npm-cli.bat，脚本会自动帮你装。
   或者手动运行下面这条：
     dsh plugin --profile web add "本文件夹\plugin\dsh-free-models-hub"
3. 重启 DeepSeek Harness 后生效。

【安装后怎么用】
1. 完全关闭并重新打开 DeepSeek Harness 软件。
2. 在对话界面右侧边缘找到「🎁」按钮，点开。
3. 按照提示一键配置（填你从免费 LLM 网站拿到的 API Key）。
4. 到 设置 → 模型 里选你刚配好的免费模型就能开始对话了。

【如果安装时提示"没有找到 DeepSeek Harness"】
说明脚本没自动找到你的软件，通常是你还没安装 DeepSeek
Harness，或软件被装在很特殊的位置。请先安装并启动过一次
DeepSeek Harness，然后再重新双击运行本安装脚本。
（桌面版"绿色版"会自带 dsh-home 文件夹；脚本会自动扫描
  C: D: E: 等盘符。）

【脚本会自动扫描的位置】
- 系统环境变量 DSH_HOME 指向的目录
- 默认用户目录下的 .dsh 文件夹
- C: D: E: 等固定盘符下的 dsh-home 文件夹
- 安装了 DeepSeekHarness.exe 的目录旁边

【会不会弄坏我的软件？】
不会。脚本只会做两件安全的事：
1. 把插件文件夹复制到 DSH 的 node_modules 里；
2. 在对应 profile 的 package.json 里登记插件名。
你原来装的其他插件不会被动到。如果哪天想卸载，把 node_modules\
dsh-free-models-hub 文件夹删掉，再把 package.json 里登记的
dsh-free-models-hub 那一行删掉即可。

【怎么卸载】
1. 双击运行  uninstall-free-models-hub.bat
2. 看到"插件已卸载"就说明成功了，按回车关闭窗口。
3. 完全关闭并重新打开 DeepSeek Harness 后生效。

【目录结构】
install-free-models-hub.bat      ← 双击这个=桌面版安装（小白）
install-npm-cli.bat              ← 双击这个=命令行/npx 版安装
uninstall-free-models-hub.bat    ← 双击这个=卸载
install.ps1                      ← 桌面版安装程序本体（无需动）
install-npm-cli.ps1              ← 命令行版安装程序本体（无需动）
uninstall.ps1                    ← 卸载程序本体（无需动）
plugin\dsh-free-models-hub\      ← 插件本体（无需动）

技术支持/GitHub：
https://github.com/yu-wenchao/dsh-free-models-hub
