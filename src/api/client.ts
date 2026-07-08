import { invoke } from "@tauri-apps/api/core";

// Helper: call a gRPC method via Tauri
async function grpc(method: string, params?: any): Promise<any> {
  return invoke("grpc_call", { method, params: params || {} });
}

// ==================== System & Auth ====================
export const systemApi = {
  health: () => invoke("grpc_health"),
  getSystemInfo: () => grpc("GetSystemInfo"),
  getConfig: () => invoke("grpc_get_token"),
  setConfig: (url: string, token?: string) => invoke("grpc_set_config", { url, token: token || null }),
  setToken: (token: string) => invoke("grpc_set_token", { token }),
  getRuntimeInfo: () => grpc("GetRuntimeInfo"),
  getRunningInfo: () => grpc("GetRunningInfo"),
  getServiceCapabilities: () => grpc("GetServiceCapabilities"),
  restartService: () => grpc("RestartService"),
  shutdownService: () => grpc("ShutdownService"),
};

export const authApi = {
  getToken: (userName: string, password: string, totpCode?: string) => grpc("GetToken", { userName, password, totpCode }),
  login: (userName: string, password: string, synDataToCloud = true) => grpc("Login", { userName, password, synDataToCloud }),
  login2FA: (userName: string, password: string, totpCode: string, synDataToCloud = true) => grpc("LoginWith2FA", { userName, password, totpCode, synDataToCloud }),
  logout: (logoutFromCloudFS = true) => grpc("Logout", { logoutFromCloudFS }),
  getAccountStatus: () => grpc("GetAccountStatus"),
  changePassword: (oldPassword: string, newPassword: string, totpCode?: string) => grpc("ChangePassword", { oldPassword, newPassword, totpCode }),
  register: (userName: string, password: string) => grpc("Register", { userName, password }),
};

// ==================== Files ====================
export const fileApi = {
  list: (path: string, forceRefresh = false) => grpc("GetSubFiles", { path, forceRefresh }),
  search: (path: string, searchFor: string, fuzzyMatch = true, contentSearch = false) => grpc("GetSearchResults", { path, searchFor, fuzzyMatch, contentSearch }),
  find: (parentPath: string, path: string) => grpc("FindFileByPath", { parentPath, path }),
  createFolder: (parentPath: string, folderName: string) => grpc("CreateFolder", { parentPath, folderName }),
  createEncryptedFolder: (parentPath: string, folderName: string, password: string, savePassword: boolean) => grpc("CreateEncryptedFolder", { parentPath, folderName, password, savePassword }),
  unlock: (path: string, password: string, permanentUnlock: boolean) => grpc("UnlockEncryptedFile", { path, password, permanentUnlock }),
  lock: (path: string) => grpc("LockEncryptedFile", { path }),
  rename: (path: string, newName: string) => grpc("RenameFile", { path, newName }),
  move: (paths: string[], destPath: string, conflictPolicy = "Rename") => grpc("MoveFile", { paths, destPath, conflictPolicy }),
  copy: (paths: string[], destPath: string, conflictPolicy = "Rename") => grpc("CopyFile", { paths, destPath, conflictPolicy }),
  delete: (path: string) => grpc("DeleteFile", { path }),
  deletePermanently: (path: string) => grpc("DeleteFilePermanently", { path }),
  deleteBatch: (paths: string[]) => grpc("DeleteFiles", { paths }),
  deleteBatchPermanently: (paths: string[]) => grpc("DeleteFilesPermanently", { paths }),
  detailProperties: (path: string) => grpc("GetFileDetailProperties", { path }),
  spaceInfo: (path: string) => grpc("GetSpaceInfo", { path }),
  cloudMemberships: (path: string) => grpc("GetCloudMemberships", { path }),
  metadata: (path: string) => grpc("GetMetaData", { path }),
  downloadUrl: (path: string, preview = false, lazy_read = false, get_direct_url = false) => grpc("GetDownloadUrlPath", { path, preview, lazy_read, get_direct_url }),
  closeReader: (path: string) => grpc("CloseFileReader", { path }),
  forceExpireCache: (path: string) => grpc("ForceExpireDirCache", { path }),
  originalPath: (path: string) => grpc("GetOriginalPath", { path }),
};

// ==================== Offline ====================
export const offlineApi = {
  add: (urls: string, toFolder: string, checkFolderAfterSecs?: number) => grpc("AddOfflineFiles", { urls, toFolder, checkFolderAfterSecs }),
  remove: (cloudName: string, cloudAccountId: string, deleteFiles: boolean, infoHashes: string[], path?: string) => grpc("RemoveOfflineFiles", { cloudName, cloudAccountId, deleteFiles, infoHashes, path }),
  list: (path: string) => grpc("ListOfflineFilesByPath", { path }),
  listAll: (cloudName: string, cloudAccountId: string, page = 1, path?: string) => grpc("ListAllOfflineFiles", { cloudName, cloudAccountId, page, path }),
  quota: (cloudName: string, cloudAccountId: string, path?: string) => grpc("GetOfflineQuotaInfo", { cloudName, cloudAccountId, path }),
  clear: (cloudName: string, cloudAccountId: string, filter: string, deleteFiles: boolean, path?: string) => grpc("ClearOfflineFiles", { cloudName, cloudAccountId, filter, deleteFiles, path }),
  restart: (cloudName: string, cloudAccountId: string, infoHash: string, url: string, parentId: string, path?: string) => grpc("RestartOfflineTask", { cloudName, cloudAccountId, infoHash, url, parentId, path }),
};

// ==================== Mount ====================
export const mountApi = {
  canAdd: () => grpc("CanAddMoreMountPoints"),
  list: () => grpc("GetMountPoints"),
  add: (mountOption: any) => grpc("AddMountPoint", mountOption),
  remove: (mountPoint: string) => grpc("RemoveMountPoint", { mountPoint }),
  mount: (mountPoint: string) => grpc("Mount", { mountPoint }),
  unmount: (mountPoint: string) => grpc("Unmount", { mountPoint }),
  update: (mountPoint: string, newMountOption: any) => grpc("UpdateMountPoint", { mountPoint, ...newMountOption }),
  driveLetters: () => grpc("GetAvailableDriveLetters"),
  hasDriveLetters: () => grpc("HasDriveLetters"),
  canBoth: () => grpc("CanMountBothLocalAndCloud"),
  localSubFiles: (parentFolder: string) => grpc("LocalGetSubFiles", { parentFolder }),
  localCreateFolder: (parentFolder: string, folderName: string) => grpc("LocalCreateFolder", { parentFolder, folderName }),
};

// ==================== Tasks ====================
export const taskApi = {
  allCount: () => grpc("GetAllTasksCount"),
  downloadCount: () => grpc("GetDownloadFileCount"),
  downloadList: () => grpc("GetDownloadFileList"),
  uploadCount: () => grpc("GetUploadFileCount"),
  uploadList: (getAll = true, itemsPerPage = 50, pageNumber = 1, filter = "") => grpc("GetUploadFileList", { getAll, itemsPerPage, pageNumber, filter }),
  cancelAllUploads: () => grpc("CancelAllUploadFiles"),
  cancelUploads: (keys: string[]) => grpc("CancelUploadFiles", { keys }),
  pauseAllUploads: () => grpc("PauseAllUploadFiles"),
  pauseUploads: (keys: string[]) => grpc("PauseUploadFiles", { keys }),
  resumeAllUploads: () => grpc("ResumeAllUploadFiles"),
  resumeUploads: (keys: string[]) => grpc("ResumeUploadFiles", { keys }),
  copyList: () => grpc("GetCopyTasks"),
  mergeList: () => grpc("GetMergeTasks"),
  cancelMerge: (sourcePath: string, destPath: string) => grpc("CancelMergeTask", { sourcePath, destPath }),
  cancelCopy: (sourcePath: string, destPath: string) => grpc("CancelCopyTask", { sourcePath, destPath }),
  pauseCopy: (sourcePath: string, destPath: string, pause: boolean) => grpc("PauseCopyTask", { sourcePath, destPath, pause }),
  restartCopy: (sourcePath: string, destPath: string) => grpc("RestartCopyTask", { sourcePath, destPath }),
  removeCompletedCopy: () => grpc("RemoveCompletedCopyTasks"),
  removeAllCopy: () => grpc("RemoveAllCopyTasks"),
  removeCopy: (taskKeys: string[]) => grpc("RemoveCopyTasks", { taskKeys }),
  pauseAllCopy: (pause: boolean) => grpc("PauseAllCopyTasks", { pause }),
  pauseCopyBatch: (taskKeys: string[], pause: boolean) => grpc("PauseCopyTasks", { taskKeys, pause }),
  resumeAllCopy: () => grpc("ResumeAllCopyTasks"),
  resumeCopy: (taskKeys: string[]) => grpc("ResumeCopyTasks", { taskKeys }),
  openHandles: () => grpc("GetOpenFileHandles"),
};

// ==================== Cloud APIs ====================
export const cloudApi = {
  canAdd: () => grpc("CanAddMoreCloudApis"),
  list: () => grpc("GetAllCloudApis"),
  getConfig: (cloudName: string, userName: string) => grpc("GetCloudAPIConfig", { cloudName, userName }),
  setConfig: (cloudName: string, userName: string, config: any) => grpc("SetCloudAPIConfig", { cloudName, userName, config }),
  remove: (cloudName: string, userName: string, permanentRemove = false) => grpc("RemoveCloudAPI", { cloudName, userName, permanentRemove }),
  login115Editthiscookie: (editThiscookieString: string) => grpc("APILogin115Editthiscookie", { editThiscookieString }),
  login115OpenOAuth: (req: any) => grpc("APILogin115OpenOAuth", req),
  loginAliyundriveOAuth: (req: any) => grpc("APILoginAliyundriveOAuth", req),
  loginAliyundriveRefreshtoken: (refreshToken: string, useOpenAPI = false) => grpc("APILoginAliyundriveRefreshtoken", { refreshToken, useOpenAPI }),
  loginBaiduPanOAuth: (req: any) => grpc("APILoginBaiduPanOAuth", req),
  loginOneDriveOAuth: (req: any) => grpc("APILoginOneDriveOAuth", req),
  loginGoogleDriveOAuth: (req: any) => grpc("ApiLoginGoogleDriveOAuth", req),
  loginGoogleDriveRefreshToken: (req: any) => grpc("ApiLoginGoogleDriveRefreshToken", req),
  loginXunleiOAuth: (req: any) => grpc("ApiLoginXunleiOAuth", req),
  loginXunleiOpenOAuth: (req: any) => grpc("ApiLoginXunleiOpenOAuth", req),
  login123panOAuth: (req: any) => grpc("ApiLogin123panOAuth", req),
  loginWebDav: (req: any) => grpc("APILoginWebDav", req),
  loginS3: (req: any) => grpc("APILoginS3", req),
  loginLocalFolder: (localFolderPath: string) => grpc("APIAddLocalFolder", { localFolderPath }),
  loginCloudDrive: (req: any) => grpc("APILoginCloudDrive", req),
  loginSftp: (req: any) => grpc("APILoginSftp", req),
  loginFtp: (req: any) => grpc("APILoginFtp", req),
  loginSmb: (req: any) => grpc("APILoginSmb", req),
  discoverSmbServers: () => grpc("DiscoverSmbServers"),
  discoverSmbShares: (req: any) => grpc("DiscoverSmbShares", req),
  createOAuthState: (req: any) => grpc("CreateOAuthState", req),
};

// ==================== Settings ====================
export const settingsApi = {
  get: () => grpc("GetSystemSettings"),
  set: (settings: any) => grpc("SetSystemSettings", settings),
  setDirCacheTime: (path: string, dirCachTimeToLiveSecs?: number) => grpc("SetDirCacheTimeSecs", { path, dirCachTimeToLiveSecs }),
  effectiveDirCacheTime: (path: string) => grpc("GetEffectiveDirCacheTimeSecs", { path }),
  vacuumDirCache: () => grpc("VacuumDirCache"),
  vacuumProgress: () => grpc("GetVacuumProgress"),
  dirCacheDbSize: () => grpc("GetDirCacheDbSize"),
  openFileTable: (includeDir = false) => grpc("GetOpenFileTable", { includeDir }),
  dirCacheTable: () => grpc("GetDirCacheTable"),
  referencedEntryPaths: (path: string) => grpc("GetReferencedEntryPaths", { path }),
  tempFileTable: () => grpc("GetTempFileTable"),
  machineId: () => grpc("GetMachineId"),
  onlineDevices: () => grpc("GetOnlineDevices"),
  kickoutDevice: (deviceId: string) => grpc("KickoutDevice", { deviceId }),
  logFiles: () => grpc("ListLogFiles"),
};

// ==================== Disk Cache ====================
export const diskCacheApi = {
  stats: () => grpc("GetFileBufferDiskCacheStats"),
  purge: () => grpc("PurgeFileBufferDiskCache"),
  setEvictionStrategy: (strategy: string) => grpc("SetDiskCacheEvictionStrategy", { strategy }),
  setFolder: (req: any) => grpc("SetFolderDiskCache", req),
  removeFolder: (path: string) => grpc("RemoveFolderDiskCache", { path }),
  folders: () => grpc("ListDiskCacheFolders"),
  prefetch: (req: any) => grpc("PrefetchFileRanges", req),
  cancelPrefetch: (path: string, hintIds: number[]) => grpc("CancelFilePrefetch", { path, hintIds }),
  activePrefetch: () => grpc("GetActivePrefetchHints"),
};

// ==================== 2FA ====================
export const twoFAApi = {
  status: () => grpc("Check2FAStatus"),
  setup: (password: string) => grpc("Setup2FA", { password }),
  enable: (totpCode: string) => grpc("Enable2FA", { totpCode }),
  disable: (totpCode: string) => grpc("Disable2FA", { totpCode }),
  recoveryCodes: (totpCode: string) => grpc("GetRecoveryCodes", { totpCode }),
  regenerateRecoveryCodes: (totpCode: string) => grpc("RegenerateRecoveryCodes", { totpCode }),
  unbindDevice: (password: string, totpCode?: string) => grpc("UnbindDevice", { password, totpCode }),
  sendDisableEmail: (email: string) => grpc("SendDisable2FAEmail", { email }),
  disableByEmail: (disableCode: string, password: string) => grpc("Disable2FAByEmail", { disableCode, password }),
};

// ==================== Sessions ====================
export const sessionApi = {
  list: () => grpc("GetSessions"),
  revoke: (sessionId: string) => grpc("RevokeSession", { sessionId }),
  revokeOthers: () => grpc("RevokeOtherSessions"),
};

// ==================== Backup ====================
export const backupApi = {
  all: () => grpc("BackupGetAll"),
  status: (sourcePath: string) => grpc("BackupGetStatus", { sourcePath }),
  add: (backup: any) => grpc("BackupAdd", backup),
  remove: (sourcePath: string) => grpc("BackupRemove", { sourcePath }),
  update: (backup: any) => grpc("BackupUpdate", backup),
  setEnabled: (sourcePath: string, isEnabled: boolean) => grpc("BackupSetEnabled", { sourcePath, isEnabled }),
  restartWalk: (sourcePath: string) => grpc("BackupRestartWalkingThrough", { sourcePath }),
  canAdd: () => grpc("CanAddMoreBackups"),
};

// ==================== Webhooks ====================
export const webhookApi = {
  template: () => grpc("GetWebhookConfigTemplate"),
  list: () => grpc("GetWebhookConfigs"),
  add: (fileName: string, content: string) => grpc("AddWebhookConfig", { fileName, content }),
  remove: (fileName: string) => grpc("RemoveWebhookConfig", { fileName }),
  change: (fileName: string, content: string) => grpc("ChangeWebhookConfig", { fileName, content }),
};

// ==================== DAV ====================
export const davApi = {
  addUser: (req: any) => grpc("AddDavUser", req),
  removeUser: (userName: string) => grpc("RemoveDavUser", { userName }),
  modifyUser: (req: any) => grpc("ModifyDavUser", req),
  getUser: (userName: string) => grpc("GetDavUser", { userName }),
  config: () => grpc("GetDavServerConfig"),
  setConfig: (req: any) => grpc("SetDavServerConfig", req),
};

// ==================== Tokens ====================
export const tokenApi = {
  create: (req: any) => grpc("CreateToken", req),
  modify: (req: any) => grpc("ModifyToken", req),
  remove: (token: string) => grpc("RemoveToken", { token }),
  list: () => grpc("ListTokens"),
  info: (token: string) => grpc("GetApiTokenInfo", { token }),
};

// ==================== Web Server ====================
export const webServerApi = {
  config: () => grpc("GetWebServerConfig"),
  setConfig: (req: any) => grpc("SetWebServerConfig", req),
  generateCert: (restartServers = true) => grpc("GenerateSelfSignedCert", { restartServers }),
};

// ==================== Shared Links ====================
export const sharedLinkApi = {
  add: (sharedLinkUrl: string, toFolder: string, sharedPassword?: string) => grpc("AddSharedLink", { sharedLinkUrl, sharedPassword, toFolder }),
};

// ==================== Sync ====================
export const syncApi = {
  fileChanges: (path: string) => grpc("SyncFileChangesFromCloud", { path }),
  startListener: (path: string) => grpc("StartCloudEventListener", { path }),
  stopListener: (path: string) => grpc("StopCloudEventListener", { path }),
  walkThrough: (path: string) => grpc("WalkThroughFolderTest", { path }),
};

// ==================== Update ====================
export const updateApi = {
  check: () => grpc("CheckUpdate"),
  has: () => grpc("HasUpdate"),
  download: () => grpc("DownloadUpdate"),
  system: () => grpc("UpdateSystem"),
};

// ==================== Misc ====================
export const miscApi = {
  promotions: () => grpc("GetPromotions"),
  promotionsByCloud: (cloudName: string) => grpc("GetPromotionsByCloud", { cloudName }),
  plans: () => grpc("GetCloudDrivePlans"),
  joinPlan: (planId: string, couponCode?: string) => grpc("JoinPlan", { planId, couponCode }),
  balanceLog: () => grpc("GetBalanceLog"),
  referralCode: () => grpc("GetReferralCode"),
  checkActivationCode: (code: string) => grpc("CheckActivationCode", { code }),
  activatePlan: (code: string) => grpc("ActivatePlan", { code }),
};
