# HappyCD2 - CloudDrive2 GUI 管理器

一个基于 Tauri + React + Rust 的 CloudDrive2 桌面图形界面管理器（原生应用，无需 Node.js），通过 gRPC API 与 CloudDrive2 服务端通信，支持文件管理、任务管理、云盘挂载、离线下载、图片查看器、视频播放器等功能，并支持调用第三方播放器（VLC、PotPlayer 等）播放文件。

## 功能特性

- **文件管理**：浏览、搜索、上传、下载、复制、移动、重命名、删除文件和文件夹
- **云盘管理**：支持添加和管理多种云盘（115、阿里云盘、百度网盘、OneDrive、Google Drive、迅雷、123云盘、WebDAV、S3、SFTP、FTP、SMB 等）
- **离线下载**：添加、管理和清除离线下载任务
- **挂载管理**：管理本地挂载点，支持挂载/卸载操作
- **任务管理**：查看和管理上传、下载、复制任务
- **备份管理**：创建和管理文件备份任务
- **系统设置**：配置缓存策略、WebDAV 服务、访问令牌、Web 服务器等
- **系统监控**：查看系统运行信息、磁盘缓存统计、在线设备等
- **内置播放器**：内置视频播放器，支持倍速播放、静音、全屏等，可配置默认播放器
- **图片查看器**：支持缩放、旋转、幻灯片播放
- **第三方播放器**：支持调用 VLC、PotPlayer、MPC-HC、MPV 播放视频文件
- **主题切换**：支持夜间模式、日间模式、自动切换
- **账号管理**：修改密码、两步验证、会话管理、会员等级显示

## 系统要求

### 运行环境
- **操作系统**：Windows 10/11 (64位)
- **CloudDrive2 服务端**：需要运行中的 CloudDrive2 服务端

### 开发环境
- [Node.js](https://nodejs.org/) 18+（仅用于前端构建）
- [Rust](https://www.rust-lang.org/) (stable)
- [Tauri CLI](https://tauri.app/) v2

## 快速开始

### 从 Release 下载安装

1. 前往 [Releases 页面](https://github.com/knva/clouddirve2_gui/releases)
2. 下载最新的 `.exe` 或 `.msi` 安装包
3. 运行安装程序
4. 确保系统已安装 Node.js 18+
5. 启动 HappyCD2 应用

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/knva/clouddirve2_gui.git
cd clouddirve2_gui

# 安装前端依赖
npm install

# 安装后端依赖
cd backend && npm install && cd ..

# 下载 proto 文件（如果不存在）
node download-proto.cjs

# 开发模式运行
npm run start:all

# 或者分别启动
npm run backend    # 启动后端服务
npm run tauri dev  # 启动前端 Tauri 开发模式

# 构建生产版本
npm run tauri build
```

## 配置说明

### 首次使用

1. **启动 CloudDrive2 服务端**：确保 CloudDrive2 服务端正在运行（默认地址 `http://localhost:19798`）
2. **启动 HappyCD2**：打开应用后，会自动启动后端服务
3. **配置服务器地址**：
   - 在登录页面，输入 CloudDrive2 服务端的 gRPC 地址（默认 `localhost:19798`）
   - 如果服务端设置了访问令牌，请一并填写
4. **登录**：使用 CloudDrive2 账号密码登录

### 服务器地址格式

CloudDrive2 的 gRPC 地址格式为 `host:port`，例如：
- 本地运行：`localhost:19798`
- 远程服务器：`192.168.1.100:19798`

### 播放器配置

应用会自动检测系统中已安装的播放器。支持以下播放器：

| 播放器 | 默认安装路径 |
|--------|-------------|
| VLC | `C:\Program Files\VideoLAN\VLC\vlc.exe` |
| PotPlayer | `C:\Program Files\DAUM\PotPlayer\PotPlayerMini64.exe` |
| MPC-HC | `C:\Program Files\MPC-HC\mpc-hc64.exe` |
| MPV | `C:\Program Files\mpv\mpv.exe` |

如果播放器安装在非默认路径，请确保将其添加到系统 PATH 环境变量中。

### 后端服务

后端 Node.js 服务作为应用的一部分自动启动：
- **监听端口**：13666
- **API 前缀**：`/api`
- **WebSocket**：`ws://localhost:13666`（用于实时推送消息）

后端负责：
- 与 CloudDrive2 gRPC 服务端通信
- 提供 REST API 供前端调用
- WebSocket 推送实时消息（文件变化、任务进度等）

## 项目结构

```
happycd2/
├── src/                    # 前端 React 源码
│   ├── api/                # API 客户端
│   ├── components/         # 公共组件
│   ├── contexts/           # React Context
│   ├── pages/              # 页面组件
│   ├── types.ts            # 类型定义
│   ├── utils.ts            # 工具函数
│   └── main.tsx            # 入口文件
├── backend/                # Node.js 后端
│   ├── server.js           # Express 服务器
│   ├── grpc-client.js      # gRPC 客户端
│   └── package.json        # 后端依赖
├── src-tauri/              # Tauri Rust 项目
│   ├── src/
│   │   ├── main.rs         # 入口
│   │   └── lib.rs          # 核心逻辑
│   ├── Cargo.toml          # Rust 依赖
│   └── tauri.conf.json     # Tauri 配置
├── clouddrive.proto        # CloudDrive2 gRPC proto 文件
├── .github/workflows/      # GitHub Actions
│   ├── ci.yml              # CI 构建
│   └── release.yml         # 发布构建
└── package.json            # 前端依赖
```

## 构建和发布

### 本地构建

```bash
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录下。

### GitHub Actions 自动构建

项目配置了 GitHub Actions 自动构建：

1. **CI 构建**（`.github/workflows/ci.yml`）：每次推送到 main/master 分支时自动构建验证
2. **发布构建**（`.github/workflows/release.yml`）：推送 `v*` 格式的 tag 时自动构建并发布 Release

```bash
# 创建发布版本
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions 会自动：
- 构建 Windows 安装包（NSIS `.exe` 和 `.msi`）
- 创建 GitHub Release
- 上传构建产物供下载

## 技术栈

| 组件 | 技术 |
|------|------|
| 桌面框架 | Tauri v2 |
| 前端 | React 18 + TypeScript + Vite |
| 样式 | Tailwind CSS |
| 后端 | Node.js + Express.js |
| 通信 | gRPC + Protocol Buffers |
| 图标 | Lucide React |

## 支持的云盘

- 115 网盘
- 阿里云盘
- 百度网盘
- OneDrive
- Google Drive
- 迅雷云盘
- 123 云盘
- WebDAV
- S3 兼容存储
- SFTP / FTP
- SMB
- 本地文件夹

## 常见问题

### Q: 启动后提示"无法连接到后端服务"？

A: 请确保：
1. 系统已安装 Node.js 18+
2. 没有其他程序占用 13666 端口
3. 尝试以管理员身份运行

### Q: 提示"无法连接到 CloudDrive2 服务端"？

A: 请检查：
1. CloudDrive2 服务端是否正在运行
2. 服务器地址是否正确
3. 网络连接是否正常
4. 防火墙是否允许相应端口

### Q: 播放器无法启动？

A: 请确保：
1. 播放器已正确安装
2. 播放器路径在默认安装路径或已添加到 PATH
3. 尝试使用"系统默认应用"打开

### Q: 如何修改后端端口？

A: 设置环境变量 `PORT`，例如：`set PORT=8080`

## 许可证

MIT License

## 致谢

- [CloudDrive2](https://www.clouddrive2.com/) - 云盘管理服务
- [Tauri](https://tauri.app/) - 桌面应用框架
- [React](https://react.dev/) - UI 框架
