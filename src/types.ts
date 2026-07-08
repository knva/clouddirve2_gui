// ==================== Core Types ====================

export interface CloudDriveFile {
  id: string;
  name: string;
  fullPathName: string;
  size: string | number;
  fileType: "Directory" | "File" | "Other";
  isDirectory: boolean;
  isRoot: boolean;
  isCloudRoot: boolean;
  isCloudDirectory: boolean;
  isCloudFile: boolean;
  isSearchResult: boolean;
  isForbidden: boolean;
  isLocal: boolean;
  createTime?: string;
  writeTime?: string;
  accessTime?: string;
  cloudAPI?: CloudAPI;
  thumbnailUrl?: string;
  previewUrl?: string;
  originalPath?: string;
  canMount?: boolean;
  canUnmount?: boolean;
  canDirectAccessThumbnailURL?: boolean;
  canSearch?: boolean;
  hasDetailProperties?: boolean;
  detailProperties?: FileDetailProperties;
  canOfflineDownload?: boolean;
  canAddShareLink?: boolean;
  readOnly?: boolean;
  fileEncryptionType?: "None" | "Encrypted" | "Unlocked";
  CanCreateEncryptedFolder?: boolean;
  CanLock?: boolean;
  CanSyncFileChangesFromCloud?: boolean;
  supportOfflineDownloadManagement?: boolean;
  canContentSearch?: boolean;
  canDeletePermanently?: boolean;
  downloadUrlPath?: DownloadUrlPathInfo;
}

export interface CloudAPI {
  name: string;
  userName: string;
  nickName: string;
  isLocked: boolean;
  supportMultiThreadUploading: boolean;
  supportQpsLimit: boolean;
  isCloudEventListenerRunning: boolean;
  hasPromotions: boolean;
  promotionTitle?: string;
  path?: string;
  supportHttpDownload?: boolean;
  readOnly?: boolean;
}

export interface FileDetailProperties {
  totalFileCount: string | number;
  totalFolderCount: string | number;
  totalSize: string | number;
  isFaved: boolean;
  isShared: boolean;
  originalPath: string;
}

export interface DownloadUrlPathInfo {
  downloadUrlPath: string;
  expiresIn?: string | number;
  directUrl?: string;
  userAgent?: string;
  additionalHeaders?: Record<string, string>;
}

export interface CloudDriveSystemInfo {
  IsLogin: boolean;
  UserName: string;
  SystemReady: boolean;
  SystemMessage?: string;
  hasError?: boolean;
  devicePowerType?: "DESKTOP" | "SLOW_STORAGE" | "BATTERY";
  diskCacheDisabled?: boolean;
}

export interface JWTToken {
  success: boolean;
  errorMessage: string;
  token: string;
  expiration?: string;
}

export interface AccountStatusResult {
  userName: string;
  emailConfirmed: string;
  accountBalance: number;
  accountPlan?: AccountPlan;
  accountRoles?: AccountRole[];
  secondPlan?: AccountPlan;
  partnerReferralCode?: string;
  trustedDevice?: boolean;
  userNameIsDeviceId?: boolean;
  boundDevices?: BoundDevice[];
  subscription?: SubscriptionInfo;
}

export interface AccountPlan {
  planName: string;
  description: string;
  fontAwesomeIcon: string;
  durationDescription: string;
  endTime?: string;
  planId: string;
}

export interface AccountRole {
  roleName: string;
  description: string;
  value?: number;
}

export interface BoundDevice {
  deviceId: string;
  manufacturerId: string;
  status: string;
  createTime: string;
  partnerName: string;
}

export interface SubscriptionInfo {
  store: string;
  productId: string;
  autoRenew: boolean;
  inGracePeriod: boolean;
  expiresAt: string;
}

export interface FileOperationResult {
  success: boolean;
  errorMessage: string;
  resultFilePaths?: string[];
}

export interface SpaceInfo {
  totalSpace: string | number;
  usedSpace: string | number;
  freeSpace: string | number;
}

export interface UploadFileInfo {
  key: string;
  destPath: string;
  size: string | number;
  transferedBytes: string | number;
  status: string;
  errorMessage: string;
  operatorType: "Mount" | "Copy" | "BackupFile" | "RemoteUpload";
  statusEnum: number;
}

export interface DownloadFileInfo {
  filePath: string;
  fileLength: string | number;
  totalBufferUsed: string | number;
  downloadThreadCount: number;
  process: string[];
  detailDownloadInfo: string;
  lastDownloadError?: string;
  bytesPerSecond: number;
}

export interface CopyTask {
  taskMode: "Copy" | "Move";
  sourcePath: string;
  destPath: string;
  status: "Pending" | "Scanning" | "Scanned" | "Completed" | "Failed";
  totalFolders: string | number;
  totalFiles: string | number;
  failedFolders: string | number;
  failedFiles: string | number;
  uploadedFiles: string | number;
  cancelledFiles: string | number;
  skippedFiles: string | number;
  totalBytes: string | number;
  uploadedBytes: string | number;
  paused: boolean;
  errors?: TaskError[];
  startTime?: string;
  endTime?: string;
}

export interface TaskError {
  time: string;
  message: string;
}

export interface MountPoint {
  mountPoint: string;
  sourceDir: string;
  localMount: boolean;
  readOnly: boolean;
  autoMount: boolean;
  uid: number;
  gid: number;
  permissions: string;
  isMounted: boolean;
  failReason: string;
  name: string;
}

export interface SystemSettings {
  dirCacheTimeToLiveSecs?: string | number;
  maxPreProcessTasks?: string | number;
  maxProcessTasks?: string | number;
  tempFileLocation?: string;
  syncWithCloud?: boolean;
  readDownloaderTimeoutSecs?: string | number;
  uploadDelaySecs?: string | number;
  processBlackList?: string[];
  uploadIgnoredExtensions?: string[];
  updateChannel?: "Release" | "Beta";
  maxDownloadSpeedKBytesPerSecond?: number;
  maxUploadSpeedKBytesPerSecond?: number;
  deviceName?: string;
  dirCachePersistence?: boolean;
  fileLogLevel?: number;
  terminalLogLevel?: number;
  fileBufferDiskCacheLocation?: string;
  fileBufferDiskCacheMaxBytes?: string | number;
}

export interface RuntimeInfo {
  productName: string;
  productVersion: string;
  CloudAPIVersion: string;
  osInfo: string;
}

export interface RunInfo {
  cpuUsage: number;
  memUsageKB: string | number;
  uptime: number;
  totalMemoryKB: string | number;
  downloadBytesPerSecond: number;
  uploadBytesPerSecond: number;
}

export interface OfflineFile {
  name: string;
  size: string | number;
  url: string;
  status: number;
  infoHash: string;
  fileId: string;
  add_time: string | number;
  parentId: string;
  percendDone: number;
  peers: string | number;
}

export interface Backup {
  sourcePath: string;
  destinations: { destinationPath: string; isEnabled: boolean }[];
  isEnabled: boolean;
  fileSystemWatchEnabled: boolean;
  walkingThroughIntervalSecs: string | number;
}

export interface BackupStatus {
  backup: Backup;
  status: number;
  statusMessage: string;
  watcherStatus: number;
  watcherStatusMessage: string;
  errors?: TaskError[];
}

export interface DavUser {
  userName: string;
  password: string;
  rootPath: string;
  readOnly: boolean;
  enabled: boolean;
  guest: boolean;
}

export interface DavServerConfig {
  davServerEnabled: boolean;
  davServerPath: string;
  enableClouddriveAccount: boolean;
  clouddriveAccountRootPath: string;
  clouddriveAccountReadOnly: boolean;
  enableAnonymousAccess: boolean;
  anonymousRootPath: string;
  anonymousReadOnly: boolean;
  users: DavUser[];
  enableAccessLog: boolean;
}

export interface TokenInfo {
  token: string;
  rootDir: string;
  permissions: Record<string, boolean>;
  expires_in?: string | number;
  friendly_name: string;
}

export interface Session {
  id: string;
  device_id: string;
  device_name: string;
  device_os_type: string;
  created_at: string;
  last_used_at: string;
  expires_at: string;
  last_ip_address: string;
}

export interface TwoFactorAuthStatusResult {
  two_factor_enabled: boolean;
}

export interface TwoFactorAuthSetupResult {
  secret: string;
  qr_code: string;
  manual_entry_key: string;
}

export interface WebServerConfig {
  http_port: number;
  https_port: number;
  cert_file?: string;
  key_file?: string;
  enable_https: boolean;
}

export interface FileBufferDiskCacheStats {
  enabled: boolean;
  totalBytes: string | number;
  maxBytes: string | number;
  entryCount: string | number;
  segmentCount: string | number;
  rootDir: string;
  scanCompleted: boolean;
  evictionStrategy: number;
}
