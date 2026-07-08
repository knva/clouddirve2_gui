import axios from "axios";

const BASE_URL = "http://localhost:13666/api";

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.error) {
      throw new Error(error.response.data.error);
    }
    if (error.code === "ERR_NETWORK") {
      throw new Error("无法连接到后端服务，请确保后端服务已启动 (npm run backend)");
    }
    throw error;
  }
);

// ==================== System & Auth ====================
export const systemApi = {
  health: () => api.get("/health").then((r) => r.data),
  getSystemInfo: () => api.get("/system/info").then((r) => r.data),
  getConfig: () => api.get("/token").then((r) => r.data),
  setConfig: (url: string, token?: string) =>
    api.post("/config", { url, token }).then((r) => r.data),
  setToken: (token: string) => api.post("/token", { token }).then((r) => r.data),
  getRuntimeInfo: () => api.get("/runtime-info").then((r) => r.data),
  getRunningInfo: () => api.get("/running-info").then((r) => r.data),
  getServiceCapabilities: () => api.get("/service/capabilities").then((r) => r.data),
  restartService: () => api.post("/service/restart").then((r) => r.data),
  shutdownService: () => api.post("/service/shutdown").then((r) => r.data),
};

export const authApi = {
  getToken: (userName: string, password: string, totpCode?: string) =>
    api.post("/auth/get-token", { userName, password, totpCode }).then((r) => r.data),
  login: (userName: string, password: string, synDataToCloud = true) =>
    api.post("/auth/login", { userName, password, synDataToCloud }).then((r) => r.data),
  login2FA: (userName: string, password: string, totpCode: string, synDataToCloud = true) =>
    api.post("/auth/login-2fa", { userName, password, totpCode, synDataToCloud }).then((r) => r.data),
  logout: (logoutFromCloudFS = true) =>
    api.post("/auth/logout", { logoutFromCloudFS }).then((r) => r.data),
  getAccountStatus: () => api.get("/account/status").then((r) => r.data),
  changePassword: (oldPassword: string, newPassword: string, totpCode?: string) =>
    api.post("/account/change-password", { oldPassword, newPassword, totpCode }).then((r) => r.data),
  register: (userName: string, password: string) =>
    api.post("/auth/register", { userName, password }).then((r) => r.data),
};

// ==================== Files ====================
export const fileApi = {
  list: (path: string, forceRefresh = false) =>
    api.get("/files/list", { params: { path, forceRefresh } }).then((r) => r.data),
  search: (path: string, searchFor: string, fuzzyMatch = true, contentSearch = false) =>
    api.get("/files/search", { params: { path, searchFor, fuzzyMatch, contentSearch } }).then((r) => r.data),
  find: (parentPath: string, path: string) =>
    api.get("/files/find", { params: { parentPath, path } }).then((r) => r.data),
  createFolder: (parentPath: string, folderName: string) =>
    api.post("/files/create-folder", { parentPath, folderName }).then((r) => r.data),
  createEncryptedFolder: (parentPath: string, folderName: string, password: string, savePassword: boolean) =>
    api.post("/files/create-encrypted-folder", { parentPath, folderName, password, savePassword }).then((r) => r.data),
  unlock: (path: string, password: string, permanentUnlock: boolean) =>
    api.post("/files/unlock", { path, password, permanentUnlock }).then((r) => r.data),
  lock: (path: string) => api.post("/files/lock", { path }).then((r) => r.data),
  rename: (path: string, newName: string) =>
    api.post("/files/rename", { path, newName }).then((r) => r.data),
  move: (paths: string[], destPath: string, conflictPolicy = "Rename") =>
    api.post("/files/move", { paths, destPath, conflictPolicy }).then((r) => r.data),
  copy: (paths: string[], destPath: string, conflictPolicy = "Rename") =>
    api.post("/files/copy", { paths, destPath, conflictPolicy }).then((r) => r.data),
  delete: (path: string) => api.post("/files/delete", { path }).then((r) => r.data),
  deletePermanently: (path: string) =>
    api.post("/files/delete-permanently", { path }).then((r) => r.data),
  deleteBatch: (paths: string[]) =>
    api.post("/files/delete-batch", { paths }).then((r) => r.data),
  deleteBatchPermanently: (paths: string[]) =>
    api.post("/files/delete-batch-permanently", { paths }).then((r) => r.data),
  detailProperties: (path: string) =>
    api.get("/files/detail-properties", { params: { path } }).then((r) => r.data),
  spaceInfo: (path: string) => api.get("/files/space-info", { params: { path } }).then((r) => r.data),
  cloudMemberships: (path: string) =>
    api.get("/files/cloud-memberships", { params: { path } }).then((r) => r.data),
  metadata: (path: string) => api.get("/files/metadata", { params: { path } }).then((r) => r.data),
  downloadUrl: (path: string, preview = false, lazy_read = false, get_direct_url = false) =>
    api.get("/files/download-url", { params: { path, preview, lazy_read, get_direct_url } }).then((r) => r.data),
  closeReader: (path: string) => api.post("/files/close-reader", { path }).then((r) => r.data),
  forceExpireCache: (path: string) => api.post("/files/force-expire-cache", { path }).then((r) => r.data),
  originalPath: (path: string) => api.get("/files/original-path", { params: { path } }).then((r) => r.data),
};

// ==================== Offline ====================
export const offlineApi = {
  add: (urls: string, toFolder: string, checkFolderAfterSecs?: number) =>
    api.post("/offline/add", { urls, toFolder, checkFolderAfterSecs }).then((r) => r.data),
  remove: (cloudName: string, cloudAccountId: string, deleteFiles: boolean, infoHashes: string[], path?: string) =>
    api.post("/offline/remove", { cloudName, cloudAccountId, deleteFiles, infoHashes, path }).then((r) => r.data),
  list: (path: string) => api.get("/offline/list", { params: { path } }).then((r) => r.data),
  listAll: (cloudName: string, cloudAccountId: string, page = 1, path?: string) =>
    api.get("/offline/list-all", { params: { cloudName, cloudAccountId, page, path } }).then((r) => r.data),
  quota: (cloudName: string, cloudAccountId: string, path?: string) =>
    api.get("/offline/quota", { params: { cloudName, cloudAccountId, path } }).then((r) => r.data),
  clear: (cloudName: string, cloudAccountId: string, filter: string, deleteFiles: boolean, path?: string) =>
    api.post("/offline/clear", { cloudName, cloudAccountId, filter, deleteFiles, path }).then((r) => r.data),
  restart: (cloudName: string, cloudAccountId: string, infoHash: string, url: string, parentId: string, path?: string) =>
    api.post("/offline/restart", { cloudName, cloudAccountId, infoHash, url, parentId, path }).then((r) => r.data),
};

// ==================== Mount ====================
export const mountApi = {
  canAdd: () => api.get("/mount/can-add").then((r) => r.data),
  list: () => api.get("/mount/points").then((r) => r.data),
  add: (mountOption: any) => api.post("/mount/add", mountOption).then((r) => r.data),
  remove: (mountPoint: string) => api.post("/mount/remove", { mountPoint }).then((r) => r.data),
  mount: (mountPoint: string) => api.post("/mount/mount", { mountPoint }).then((r) => r.data),
  unmount: (mountPoint: string) => api.post("/mount/unmount", { mountPoint }).then((r) => r.data),
  update: (mountPoint: string, newMountOption: any) =>
    api.post("/mount/update", { mountPoint, newMountOption }).then((r) => r.data),
  driveLetters: () => api.get("/mount/drive-letters").then((r) => r.data),
  hasDriveLetters: () => api.get("/mount/has-drive-letters").then((r) => r.data),
  canBoth: () => api.get("/mount/can-both").then((r) => r.data),
  localSubFiles: (parentFolder: string, folderOnly = false, includeCloudDrive = false, includeAvailableDrive = false) =>
    api.get("/mount/local-subfiles", { params: { parentFolder, folderOnly, includeCloudDrive, includeAvailableDrive } }).then((r) => r.data),
  localCreateFolder: (parentFolder: string, folderName: string) =>
    api.post("/mount/local-create-folder", { parentFolder, folderName }).then((r) => r.data),
};

// ==================== Tasks ====================
export const taskApi = {
  allCount: () => api.get("/tasks/count").then((r) => r.data),
  downloadCount: () => api.get("/tasks/download/count").then((r) => r.data),
  downloadList: () => api.get("/tasks/download/list").then((r) => r.data),
  uploadCount: () => api.get("/tasks/upload/count").then((r) => r.data),
  uploadList: (getAll = true, itemsPerPage = 50, pageNumber = 1, filter = "") =>
    api.get("/tasks/upload/list", { params: { getAll, itemsPerPage, pageNumber, filter } }).then((r) => r.data),
  cancelAllUploads: () => api.post("/tasks/upload/cancel-all").then((r) => r.data),
  cancelUploads: (keys: string[]) => api.post("/tasks/upload/cancel", { keys }).then((r) => r.data),
  pauseAllUploads: () => api.post("/tasks/upload/pause-all").then((r) => r.data),
  pauseUploads: (keys: string[]) => api.post("/tasks/upload/pause", { keys }).then((r) => r.data),
  resumeAllUploads: () => api.post("/tasks/upload/resume-all").then((r) => r.data),
  resumeUploads: (keys: string[]) => api.post("/tasks/upload/resume", { keys }).then((r) => r.data),
  copyList: () => api.get("/tasks/copy/list").then((r) => r.data),
  mergeList: () => api.get("/tasks/merge/list").then((r) => r.data),
  cancelMerge: (sourcePath: string, destPath: string) =>
    api.post("/tasks/merge/cancel", { sourcePath, destPath }).then((r) => r.data),
  cancelCopy: (sourcePath: string, destPath: string) =>
    api.post("/tasks/copy/cancel", { sourcePath, destPath }).then((r) => r.data),
  pauseCopy: (sourcePath: string, destPath: string, pause: boolean) =>
    api.post("/tasks/copy/pause", { sourcePath, destPath, pause }).then((r) => r.data),
  restartCopy: (sourcePath: string, destPath: string) =>
    api.post("/tasks/copy/restart", { sourcePath, destPath }).then((r) => r.data),
  removeCompletedCopy: () => api.post("/tasks/copy/remove-completed").then((r) => r.data),
  removeAllCopy: () => api.post("/tasks/copy/remove-all").then((r) => r.data),
  removeCopy: (taskKeys: string[]) => api.post("/tasks/copy/remove", { taskKeys }).then((r) => r.data),
  pauseAllCopy: (pause: boolean) => api.post("/tasks/copy/pause-all", { pause }).then((r) => r.data),
  pauseCopyBatch: (taskKeys: string[], pause: boolean) =>
    api.post("/tasks/copy/pause-batch", { taskKeys, pause }).then((r) => r.data),
  resumeAllCopy: () => api.post("/tasks/copy/resume-all").then((r) => r.data),
  resumeCopy: (taskKeys: string[]) => api.post("/tasks/copy/resume", { taskKeys }).then((r) => r.data),
  openHandles: () => api.get("/tasks/open-handles").then((r) => r.data),
};

// ==================== Cloud APIs ====================
export const cloudApi = {
  canAdd: () => api.get("/cloud-apis/can-add").then((r) => r.data),
  list: () => api.get("/cloud-apis").then((r) => r.data),
  getConfig: (cloudName: string, userName: string) =>
    api.get("/cloud-apis/config", { params: { cloudName, userName } }).then((r) => r.data),
  setConfig: (cloudName: string, userName: string, config: any) =>
    api.post("/cloud-apis/config", { cloudName, userName, config }).then((r) => r.data),
  remove: (cloudName: string, userName: string, permanentRemove = false) =>
    api.post("/cloud-apis/remove", { cloudName, userName, permanentRemove }).then((r) => r.data),
  login115Editthiscookie: (editThiscookieString: string) =>
    api.post("/cloud-apis/login/115-editthiscookie", { editThiscookieString }).then((r) => r.data),
  login115OpenOAuth: (req: any) => api.post("/cloud-apis/login/115-open-oauth", req).then((r) => r.data),
  loginAliyundriveOAuth: (req: any) => api.post("/cloud-apis/login/aliyundrive-oauth", req).then((r) => r.data),
  loginAliyundriveRefreshtoken: (refreshToken: string, useOpenAPI = false) =>
    api.post("/cloud-apis/login/aliyundrive-refreshtoken", { refreshToken, useOpenAPI }).then((r) => r.data),
  loginBaiduPanOAuth: (req: any) => api.post("/cloud-apis/login/baidupan-oauth", req).then((r) => r.data),
  loginOneDriveOAuth: (req: any) => api.post("/cloud-apis/login/onedrive-oauth", req).then((r) => r.data),
  loginGoogleDriveOAuth: (req: any) => api.post("/cloud-apis/login/google-drive-oauth", req).then((r) => r.data),
  loginGoogleDriveRefreshToken: (req: any) =>
    api.post("/cloud-apis/login/google-drive-refreshtoken", req).then((r) => r.data),
  loginXunleiOAuth: (req: any) => api.post("/cloud-apis/login/xunlei-oauth", req).then((r) => r.data),
  loginXunleiOpenOAuth: (req: any) => api.post("/cloud-apis/login/xunlei-open-oauth", req).then((r) => r.data),
  login123panOAuth: (req: any) => api.post("/cloud-apis/login/123pan-oauth", req).then((r) => r.data),
  loginWebDav: (req: any) => api.post("/cloud-apis/login/webdav", req).then((r) => r.data),
  loginS3: (req: any) => api.post("/cloud-apis/login/s3", req).then((r) => r.data),
  loginLocalFolder: (localFolderPath: string) =>
    api.post("/cloud-apis/login/local-folder", { localFolderPath }).then((r) => r.data),
  loginCloudDrive: (req: any) => api.post("/cloud-apis/login/clouddrive", req).then((r) => r.data),
  loginSftp: (req: any) => api.post("/cloud-apis/login/sftp", req).then((r) => r.data),
  loginFtp: (req: any) => api.post("/cloud-apis/login/ftp", req).then((r) => r.data),
  loginSmb: (req: any) => api.post("/cloud-apis/login/smb", req).then((r) => r.data),
  discoverSmbServers: () => api.get("/cloud-apis/discover-smb-servers").then((r) => r.data),
  discoverSmbShares: (req: any) => api.post("/cloud-apis/discover-smb-shares", req).then((r) => r.data),
  createOAuthState: (req: any) => api.post("/cloud-apis/oauth-state", req).then((r) => r.data),
};

// ==================== Settings ====================
export const settingsApi = {
  get: () => api.get("/settings").then((r) => r.data),
  set: (settings: any) => api.post("/settings", settings).then((r) => r.data),
  setDirCacheTime: (path: string, dirCachTimeToLiveSecs?: number) =>
    api.post("/settings/dir-cache-time", { path, dirCachTimeToLiveSecs }).then((r) => r.data),
  effectiveDirCacheTime: (path: string) =>
    api.get("/settings/effective-dir-cache-time", { params: { path } }).then((r) => r.data),
  vacuumDirCache: () => api.post("/settings/vacuum-dir-cache").then((r) => r.data),
  vacuumProgress: () => api.get("/settings/vacuum-progress").then((r) => r.data),
  dirCacheDbSize: () => api.get("/settings/dir-cache-db-size").then((r) => r.data),
  openFileTable: (includeDir = false) =>
    api.get("/settings/open-file-table", { params: { includeDir } }).then((r) => r.data),
  dirCacheTable: () => api.get("/settings/dir-cache-table").then((r) => r.data),
  referencedEntryPaths: (path: string) =>
    api.get("/settings/referenced-entry-paths", { params: { path } }).then((r) => r.data),
  tempFileTable: () => api.get("/settings/temp-file-table").then((r) => r.data),
  machineId: () => api.get("/machine-id").then((r) => r.data),
  onlineDevices: () => api.get("/online-devices").then((r) => r.data),
  kickoutDevice: (deviceId: string) => api.post("/kickout-device", { deviceId }).then((r) => r.data),
  logFiles: () => api.get("/log-files").then((r) => r.data),
};

// ==================== Disk Cache ====================
export const diskCacheApi = {
  stats: () => api.get("/disk-cache/stats").then((r) => r.data),
  purge: () => api.post("/disk-cache/purge").then((r) => r.data),
  setEvictionStrategy: (strategy: string) =>
    api.post("/disk-cache/eviction-strategy", { strategy }).then((r) => r.data),
  setFolder: (req: any) => api.post("/disk-cache/folder", req).then((r) => r.data),
  removeFolder: (path: string) => api.post("/disk-cache/folder/remove", { path }).then((r) => r.data),
  folders: () => api.get("/disk-cache/folders").then((r) => r.data),
  prefetch: (req: any) => api.post("/disk-cache/prefetch", req).then((r) => r.data),
  cancelPrefetch: (path: string, hintIds: number[]) =>
    api.post("/disk-cache/cancel-prefetch", { path, hintIds }).then((r) => r.data),
  activePrefetch: () => api.get("/disk-cache/active-prefetch").then((r) => r.data),
};

// ==================== 2FA ====================
export const twoFAApi = {
  status: () => api.get("/2fa/status").then((r) => r.data),
  setup: (password: string) => api.post("/2fa/setup", { password }).then((r) => r.data),
  enable: (totpCode: string) => api.post("/2fa/enable", { totpCode }).then((r) => r.data),
  disable: (totpCode: string) => api.post("/2fa/disable", { totpCode }).then((r) => r.data),
  recoveryCodes: (totpCode: string) => api.post("/2fa/recovery-codes", { totpCode }).then((r) => r.data),
  regenerateRecoveryCodes: (totpCode: string) =>
    api.post("/2fa/regenerate-recovery-codes", { totpCode }).then((r) => r.data),
  unbindDevice: (password: string, totpCode?: string) =>
    api.post("/2fa/unbind-device", { password, totpCode }).then((r) => r.data),
  sendDisableEmail: (email: string) =>
    api.post("/2fa/send-disable-email", { email }).then((r) => r.data),
  disableByEmail: (disableCode: string, password: string) =>
    api.post("/2fa/disable-by-email", { disableCode, password }).then((r) => r.data),
};

// ==================== Sessions ====================
export const sessionApi = {
  list: () => api.get("/sessions").then((r) => r.data),
  revoke: (sessionId: string) => api.post("/sessions/revoke", { sessionId }).then((r) => r.data),
  revokeOthers: () => api.post("/sessions/revoke-others").then((r) => r.data),
};

// ==================== Backup ====================
export const backupApi = {
  all: () => api.get("/backup/all").then((r) => r.data),
  status: (sourcePath: string) => api.get("/backup/status", { params: { sourcePath } }).then((r) => r.data),
  add: (backup: any) => api.post("/backup/add", backup).then((r) => r.data),
  remove: (sourcePath: string) => api.post("/backup/remove", { sourcePath }).then((r) => r.data),
  update: (backup: any) => api.post("/backup/update", backup).then((r) => r.data),
  setEnabled: (sourcePath: string, isEnabled: boolean) =>
    api.post("/backup/set-enabled", { sourcePath, isEnabled }).then((r) => r.data),
  restartWalk: (sourcePath: string) => api.post("/backup/restart-walk", { sourcePath }).then((r) => r.data),
  canAdd: () => api.get("/backup/can-add").then((r) => r.data),
};

// ==================== Webhooks ====================
export const webhookApi = {
  template: () => api.get("/webhook/template").then((r) => r.data),
  list: () => api.get("/webhook/list").then((r) => r.data),
  add: (fileName: string, content: string) =>
    api.post("/webhook/add", { fileName, content }).then((r) => r.data),
  remove: (fileName: string) => api.post("/webhook/remove", { fileName }).then((r) => r.data),
  change: (fileName: string, content: string) =>
    api.post("/webhook/change", { fileName, content }).then((r) => r.data),
};

// ==================== DAV ====================
export const davApi = {
  addUser: (req: any) => api.post("/dav/user/add", req).then((r) => r.data),
  removeUser: (userName: string) => api.post("/dav/user/remove", { userName }).then((r) => r.data),
  modifyUser: (req: any) => api.post("/dav/user/modify", req).then((r) => r.data),
  getUser: (userName: string) => api.get("/dav/user", { params: { userName } }).then((r) => r.data),
  config: () => api.get("/dav/config").then((r) => r.data),
  setConfig: (req: any) => api.post("/dav/config", req).then((r) => r.data),
};

// ==================== Tokens ====================
export const tokenApi = {
  create: (req: any) => api.post("/tokens/create", req).then((r) => r.data),
  modify: (req: any) => api.post("/tokens/modify", req).then((r) => r.data),
  remove: (token: string) => api.post("/tokens/remove", { token }).then((r) => r.data),
  list: () => api.get("/tokens/list").then((r) => r.data),
  info: (token: string) => api.get("/tokens/info", { params: { token } }).then((r) => r.data),
};

// ==================== Web Server ====================
export const webServerApi = {
  config: () => api.get("/web-server/config").then((r) => r.data),
  setConfig: (req: any) => api.post("/web-server/config", req).then((r) => r.data),
  generateCert: (restartServers = true) =>
    api.post("/web-server/generate-cert", { restartServers }).then((r) => r.data),
};

// ==================== Shared Links ====================
export const sharedLinkApi = {
  add: (sharedLinkUrl: string, toFolder: string, sharedPassword?: string) =>
    api.post("/shared-link/add", { sharedLinkUrl, sharedPassword, toFolder }).then((r) => r.data),
};

// ==================== Sync ====================
export const syncApi = {
  fileChanges: (path: string) => api.post("/sync/file-changes", { path }).then((r) => r.data),
  startListener: (path: string) => api.post("/sync/start-listener", { path }).then((r) => r.data),
  stopListener: (path: string) => api.post("/sync/stop-listener", { path }).then((r) => r.data),
  walkThrough: (path: string) => api.post("/walk-through", { path }).then((r) => r.data),
};

// ==================== Update ====================
export const updateApi = {
  check: () => api.get("/update/check").then((r) => r.data),
  has: () => api.get("/update/has").then((r) => r.data),
  download: () => api.post("/update/download").then((r) => r.data),
  system: () => api.post("/update/system").then((r) => r.data),
};

// ==================== Misc ====================
export const miscApi = {
  promotions: () => api.get("/promotions").then((r) => r.data),
  promotionsByCloud: (cloudName: string) =>
    api.get("/promotions/by-cloud", { params: { cloudName } }).then((r) => r.data),
  plans: () => api.get("/plans").then((r) => r.data),
  joinPlan: (planId: string, couponCode?: string) =>
    api.post("/plans/join", { planId, couponCode }).then((r) => r.data),
  balanceLog: () => api.get("/balance-log").then((r) => r.data),
  referralCode: () => api.get("/referral-code").then((r) => r.data),
  checkActivationCode: (code: string) => api.post("/check-activation-code", { code }).then((r) => r.data),
  activatePlan: (code: string) => api.post("/activate-plan", { code }).then((r) => r.data),
  checkCoupon: (planId: string, couponCode: string) =>
    api.post("/check-coupon", { planId, couponCode }).then((r) => r.data),
  storeQuote: (productId: string, couponCode?: string) =>
    api.post("/store/quote", { productId, couponCode }).then((r) => r.data),
  storeVerify: (req: any) => api.post("/store/verify", req).then((r) => r.data),
};

export { api };
