import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PROTO_PATH = path.join(__dirname, '..', 'clouddrive.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: false,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [
    // Provide the well-known proto imports if not found locally
    path.join(__dirname, 'protos'),
  ],
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
const clouddrive = protoDescriptor.clouddrive;

let client = null;
let token = null;
let serverUrl = 'http://localhost:19798';

/**
 * Initialise or reconfigure the gRPC client.
 * @param {string} url  gRPC server URL, e.g. http://localhost:19798
 * @param {string} [jwt]  optional pre-existing JWT token
 */
export function initClient(url, jwt) {
  serverUrl = url || serverUrl;
  if (jwt) token = jwt;

  client = new clouddrive.CloudDriveFileSrv(
    serverUrl.replace(/^https?:\/\//, ''),
    grpc.credentials.createInsecure()
  );
  return client;
}

/**
 * Build metadata with the current bearer token.
 */
function buildMetadata(extra) {
  const meta = new grpc.Metadata();
  if (token) {
    meta.add('Authorization', `Bearer ${token}`);
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      meta.add(k, String(v));
    }
  }
  return meta;
}

/**
 * Promisify a unary gRPC call.
 * @param {string} methodName
 * @param {object} request
 * @param {object} [extraMeta]
 */
function callUnary(methodName, request = {}, extraMeta) {
  return new Promise((resolve, reject) => {
    if (!client) {
      reject(new Error('gRPC client not initialised. Call initClient first.'));
      return;
    }
    const meta = buildMetadata(extraMeta);
    client[methodName](request, meta, (err, response) => {
      if (err) {
        reject(err);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Collect a server-streaming response into an array.
 * @param {string} methodName
 * @param {object} request
 */
function callServerStream(methodName, request = {}) {
  return new Promise((resolve, reject) => {
    if (!client) {
      reject(new Error('gRPC client not initialised.'));
      return;
    }
    const meta = buildMetadata();
    const stream = client[methodName](request, meta);
    const results = [];
    stream.on('data', (chunk) => {
      if (chunk.subFiles) {
        results.push(...chunk.subFiles);
      } else {
        results.push(chunk);
      }
    });
    stream.on('end', () => resolve(results));
    stream.on('error', (err) => reject(err));
  });
}

/**
 * Subscribe to a long-lived server-streaming push channel.
 * Calls onMessage for every message received.
 * @param {string} methodName
 * @param {object} request
 * @param {function} onMessage
 * @param {function} [onError]
 * @returns {grpc.ClientReadableStream}
 */
function subscribeStream(methodName, request, onMessage, onError) {
  const meta = buildMetadata();
  const stream = client[methodName](request, meta);
  stream.on('data', (msg) => onMessage(msg));
  stream.on('error', (err) => {
    if (onError) onError(err);
  });
  return stream;
}

// ==================== Public API ====================

export function setToken(jwt) {
  token = jwt;
}

export function getToken() {
  return token;
}

export function getClient() {
  return client;
}

// ---- System / Auth ----
export const getSystemInfo = () => callUnary('GetSystemInfo', {});
export const getTokenReq = (userName, password, totpCode) =>
  callUnary('GetToken', { userName, password, totpCode });
export const login = (userName, password, synDataToCloud, cloudfsProxy) =>
  callUnary('Login', { userName, password, synDataToCloud, cloudfsProxy });
export const loginWithThirdPartyAccount = (req) =>
  callUnary('LoginWithThirdPartyAccount', req);
export const register = (userName, password, cloudfsProxy) =>
  callUnary('Register', { userName, password, cloudfsProxy });
export const logout = (logoutFromCloudFS) =>
  callUnary('Logout', { logoutFromCloudFS });
export const getAccountStatus = () => callUnary('GetAccountStatus', {});
export const changePassword = (oldPassword, newPassword, totpCode) =>
  callUnary('ChangePassword', { oldPassword, newPassword, totpCode });
export const getRuntimeInfo = () => callUnary('GetRuntimeInfo', {});
export const getRunningInfo = () => callUnary('GetRunningInfo', {});
export const getServiceCapabilities = () => callUnary('GetServiceCapabilities', {});
export const restartService = () => callUnary('RestartService', {});
export const shutdownService = () => callUnary('ShutdownService', {});
export const hasUpdate = () => callUnary('HasUpdate', {});
export const checkUpdate = () => callUnary('CheckUpdate', {});
export const downloadUpdate = () => callUnary('DownloadUpdate', {});
export const updateSystem = () => callUnary('UpdateSystem', {});

// ---- File Operations ----
export const getSubFiles = (path, forceRefresh) =>
  callServerStream('GetSubFiles', { path, forceRefresh });
export const getSearchResults = (path, searchFor, forceRefresh, fuzzyMatch, contentSearch) =>
  callServerStream('GetSearchResults', { path, searchFor, forceRefresh, fuzzyMatch, contentSearch });
export const findFileByPath = (parentPath, p) =>
  callUnary('FindFileByPath', { parentPath, path: p });
export const createFolder = (parentPath, folderName) =>
  callUnary('CreateFolder', { parentPath, folderName });
export const createEncryptedFolder = (parentPath, folderName, password, savePassword) =>
  callUnary('CreateEncryptedFolder', { parentPath, folderName, password, savePassword });
export const unlockEncryptedFile = (path, password, permanentUnlock) =>
  callUnary('UnlockEncryptedFile', { path, password, permanentUnlock });
export const lockEncryptedFile = (path) =>
  callUnary('LockEncryptedFile', { path });
export const renameFile = (theFilePath, newName) =>
  callUnary('RenameFile', { theFilePath, newName });
export const renameFiles = (renameFiles) =>
  callUnary('RenameFiles', { renameFiles });
export const moveFile = (theFilePaths, destPath, conflictPolicy, moveAcrossClouds, handleConflictRecursively) =>
  callUnary('MoveFile', { theFilePaths, destPath, conflictPolicy, moveAcrossClouds, handleConflictRecursively });
export const copyFile = (theFilePaths, destPath, conflictPolicy, handleConflictRecursively) =>
  callUnary('CopyFile', { theFilePaths, destPath, conflictPolicy, handleConflictRecursively });
export const deleteFile = (path) =>
  callUnary('DeleteFile', { path });
export const deleteFilePermanently = (path) =>
  callUnary('DeleteFilePermanently', { path });
export const deleteFiles = (paths) =>
  callUnary('DeleteFiles', { path: paths });
export const deleteFilesPermanently = (paths) =>
  callUnary('DeleteFilesPermanently', { path: paths });
export const getFileDetailProperties = (path) =>
  callUnary('GetFileDetailProperties', { path });
export const getSpaceInfo = (path) =>
  callUnary('GetSpaceInfo', { path });
export const getCloudMemberships = (path) =>
  callUnary('GetCloudMemberships', { path });
export const getMetaData = (path) =>
  callUnary('GetMetaData', { path });
export const getDownloadUrlPath = (path, preview, lazy_read, get_direct_url) =>
  callUnary('GetDownloadUrlPath', { path, preview, lazy_read, get_direct_url });
export const closeFileReader = (path) =>
  callUnary('CloseFileReader', { path });
export const forceExpireDirCache = (path) =>
  callUnary('ForceExpireDirCache', { path });
export const getOriginalPath = (path) =>
  callUnary('GetOriginalPath', { path });

// ---- Offline Download ----
export const addOfflineFiles = (urls, toFolder, checkFolderAfterSecs) =>
  callUnary('AddOfflineFiles', { urls, toFolder, checkFolderAfterSecs });
export const removeOfflineFiles = (cloudName, cloudAccountId, deleteFiles, infoHashes, path) =>
  callUnary('RemoveOfflineFiles', { cloudName, cloudAccountId, deleteFiles, infoHashes, path });
export const listOfflineFilesByPath = (path) =>
  callUnary('ListOfflineFilesByPath', { path });
export const listAllOfflineFiles = (cloudName, cloudAccountId, page, path) =>
  callUnary('ListAllOfflineFiles', { cloudName, cloudAccountId, page, path });
export const getOfflineQuotaInfo = (cloudName, cloudAccountId, path) =>
  callUnary('GetOfflineQuotaInfo', { cloudName, cloudAccountId, path });
export const clearOfflineFiles = (cloudName, cloudAccountId, filter, deleteFiles, path) =>
  callUnary('ClearOfflineFiles', { cloudName, cloudAccountId, filter, deleteFiles, path });
export const restartOfflineTask = (cloudName, cloudAccountId, infoHash, url, parentId, path) =>
  callUnary('RestartOfflineTask', { cloudName, cloudAccountId, infoHash, url, parentId, path });

// ---- Shared Links ----
export const addSharedLink = (sharedLinkUrl, sharedPassword, toFolder) =>
  callUnary('AddSharedLink', { sharedLinkUrl, sharedPassword, toFolder });

// ---- Mount Points ----
export const canAddMoreMountPoints = () => callUnary('CanAddMoreMountPoints', {});
export const getMountPoints = () => callUnary('GetMountPoints', {});
export const addMountPoint = (mountOption) => callUnary('AddMountPoint', mountOption);
export const removeMountPoint = (mountPoint) => callUnary('RemoveMountPoint', { MountPoint: mountPoint });
export const mount = (mountPoint) => callUnary('Mount', { MountPoint: mountPoint });
export const unmount = (mountPoint) => callUnary('Unmount', { MountPoint: mountPoint });
export const updateMountPoint = (mountPoint, newMountOption) =>
  callUnary('UpdateMountPoint', { mountPoint, newMountOption });
export const getAvailableDriveLetters = () => callUnary('GetAvailableDriveLetters', {});
export const hasDriveLetters = () => callUnary('HasDriveLetters', {});
export const canMountBothLocalAndCloud = () => callUnary('CanMountBothLocalAndCloud', {});
export const localGetSubFiles = (parentFolder, folderOnly, includeCloudDrive, includeAvailableDrive) =>
  callServerStream('LocalGetSubFiles', { parentFolder, folderOnly, includeCloudDrive, includeAvailableDrive });
export const localCreateFolder = (parentFolder, folderName) =>
  callUnary('LocalCreateFolder', { parentFolder, folderName });

// ---- Tasks ----
export const getAllTasksCount = () => callUnary('GetAllTasksCount', {});
export const getDownloadFileCount = () => callUnary('GetDownloadFileCount', {});
export const getDownloadFileList = () => callUnary('GetDownloadFileList', {});
export const getUploadFileCount = () => callUnary('GetUploadFileCount', {});
export const getUploadFileList = (getAll, itemsPerPage, pageNumber, filter, statusFilter, operatorTypeFilter) =>
  callUnary('GetUploadFileList', { getAll, itemsPerPage, pageNumber, filter, statusFilter, operatorTypeFilter });
export const cancelAllUploadFiles = () => callUnary('CancelAllUploadFiles', {});
export const cancelUploadFiles = (keys) => callUnary('CancelUploadFiles', { keys });
export const pauseAllUploadFiles = () => callUnary('PauseAllUploadFiles', {});
export const pauseUploadFiles = (keys) => callUnary('PauseUploadFiles', { keys });
export const resumeAllUploadFiles = () => callUnary('ResumeAllUploadFiles', {});
export const resumeUploadFiles = (keys) => callUnary('ResumeUploadFiles', { keys });
export const getCopyTasks = () => callUnary('GetCopyTasks', {});
export const getMergeTasks = () => callUnary('GetMergeTasks', {});
export const cancelMergeTask = (sourcePath, destPath) =>
  callUnary('CancelMergeTask', { sourcePath, destPath });
export const cancelCopyTask = (sourcePath, destPath) =>
  callUnary('CancelCopyTask', { sourcePath, destPath });
export const pauseCopyTask = (sourcePath, destPath, pause) =>
  callUnary('PauseCopyTask', { sourcePath, destPath, pause });
export const restartCopyTask = (sourcePath, destPath) =>
  callUnary('RestartCopyTask', { sourcePath, destPath });
export const removeCompletedCopyTasks = () => callUnary('RemoveCompletedCopyTasks', {});
export const removeAllCopyTasks = () => callUnary('RemoveAllCopyTasks', {});
export const removeCopyTasks = (taskKeys) => callUnary('RemoveCopyTasks', { taskKeys });
export const pauseAllCopyTasks = (pause) => callUnary('PauseAllCopyTasks', { pause });
export const pauseCopyTasks = (taskKeys, pause) => callUnary('PauseCopyTasks', { taskKeys, pause });
export const resumeAllCopyTasks = () => callUnary('ResumeAllCopyTasks', {});
export const resumeCopyTasks = (taskKeys) => callUnary('ResumeCopyTasks', { taskKeys });
export const getOpenFileHandles = () => callUnary('GetOpenFileHandles', {});

// ---- Cloud API Management ----
export const canAddMoreCloudApis = () => callUnary('CanAddMoreCloudApis', {});
export const getAllCloudApis = () => callUnary('GetAllCloudApis', {});
export const getCloudAPIConfig = (cloudName, userName) =>
  callUnary('GetCloudAPIConfig', { cloudName, userName });
export const setCloudAPIConfig = (cloudName, userName, config) =>
  callUnary('SetCloudAPIConfig', { cloudName, userName, config });
export const removeCloudAPI = (cloudName, userName, permanentRemove) =>
  callUnary('RemoveCloudAPI', { cloudName, userName, permanentRemove });
export const apiLogin115Editthiscookie = (editThiscookieString) =>
  callUnary('APILogin115Editthiscookie', { editThiscookieString });
export const apiLogin115OpenOAuth = (req) => callUnary('APILogin115OpenOAuth', req);
export const apiLoginAliyundriveOAuth = (req) => callUnary('APILoginAliyundriveOAuth', req);
export const apiLoginAliyundriveRefreshtoken = (refreshToken, useOpenAPI) =>
  callUnary('APILoginAliyundriveRefreshtoken', { refreshToken, useOpenAPI });
export const apiLoginBaiduPanOAuth = (req) => callUnary('APILoginBaiduPanOAuth', req);
export const apiLoginOneDriveOAuth = (req) => callUnary('APILoginOneDriveOAuth', req);
export const apiLoginGoogleDriveOAuth = (req) => callUnary('ApiLoginGoogleDriveOAuth', req);
export const apiLoginGoogleDriveRefreshToken = (req) => callUnary('ApiLoginGoogleDriveRefreshToken', req);
export const apiLoginXunleiOAuth = (req) => callUnary('ApiLoginXunleiOAuth', req);
export const apiLoginXunleiOpenOAuth = (req) => callUnary('ApiLoginXunleiOpenOAuth', req);
export const apiLogin123panOAuth = (req) => callUnary('ApiLogin123panOAuth', req);
export const apiLoginWebDav = (req) => callUnary('APILoginWebDav', req);
export const apiLoginS3 = (req) => callUnary('APILoginS3', req);
export const apiAddLocalFolder = (localFolderPath) => callUnary('APIAddLocalFolder', { localFolderPath });
export const apiLoginCloudDrive = (req) => callUnary('APILoginCloudDrive', req);
export const apiLoginSftp = (req) => callUnary('APILoginSftp', req);
export const apiLoginFtp = (req) => callUnary('APILoginFtp', req);
export const apiLoginSmb = (req) => callUnary('APILoginSmb', req);
export const discoverSmbServers = () => callUnary('DiscoverSmbServers', {});
export const discoverSmbShares = (req) => callUnary('DiscoverSmbShares', req);
export const createOAuthState = (req) => callUnary('CreateOAuthState', req);

// ---- System Settings ----
export const getSystemSettings = () => callUnary('GetSystemSettings', {});
export const setSystemSettings = (settings) => callUnary('SetSystemSettings', settings);
export const setDirCacheTimeSecs = (path, dirCachTimeToLiveSecs) =>
  callUnary('SetDirCacheTimeSecs', { path, dirCachTimeToLiveSecs });
export const getEffectiveDirCacheTimeSecs = (path) =>
  callUnary('GetEffectiveDirCacheTimeSecs', { path });
export const vacuumDirCache = () => callUnary('VacuumDirCache', {});
export const getVacuumProgress = () => callUnary('GetVacuumProgress', {});
export const getDirCacheDbSize = () => callUnary('GetDirCacheDbSize', {});
export const getOpenFileTable = (includeDir) => callUnary('GetOpenFileTable', { includeDir });
export const getDirCacheTable = () => callUnary('GetDirCacheTable', {});
export const getReferencedEntryPaths = (path) => callUnary('GetReferencedEntryPaths', { path });
export const getTempFileTable = () => callUnary('GetTempFileTable', {});
export const getMachineId = () => callUnary('GetMachineId', {});
export const getOnlineDevices = () => callUnary('GetOnlineDevices', {});
export const kickoutDevice = (deviceId) => callUnary('KickoutDevice', { deviceId });
export const listLogFiles = () => callUnary('ListLogFiles', {});

// ---- Disk Cache ----
export const getFileBufferDiskCacheStats = () => callUnary('GetFileBufferDiskCacheStats', {});
export const purgeFileBufferDiskCache = () => callUnary('PurgeFileBufferDiskCache', {});
export const setDiskCacheEvictionStrategy = (strategy) =>
  callUnary('SetDiskCacheEvictionStrategy', { strategy });
export const setFolderDiskCache = (req) => callUnary('SetFolderDiskCache', req);
export const removeFolderDiskCache = (path) => callUnary('RemoveFolderDiskCache', { path });
export const listDiskCacheFolders = () => callUnary('ListDiskCacheFolders', {});
export const prefetchFileRanges = (req) => callUnary('PrefetchFileRanges', req);
export const cancelFilePrefetch = (path, hintIds) =>
  callUnary('CancelFilePrefetch', { path, hintIds });
export const getActivePrefetchHints = () => callUnary('GetActivePrefetchHints', {});

// ---- Push Messages ----
export const pushMessage = (onMessage, onError) =>
  subscribeStream('PushMessage', {}, onMessage, onError);
export const pushTaskChange = (onMessage, onError) =>
  subscribeStream('PushTaskChange', {}, onMessage, onError);

// ---- 2FA ----
export const check2FAStatus = () => callUnary('Check2FAStatus', {});
export const setup2FA = (password) => callUnary('Setup2FA', { password });
export const enable2FA = (totpCode) => callUnary('Enable2FA', { totpCode });
export const disable2FA = (totpCode) => callUnary('Disable2FA', { totpCode });
export const getRecoveryCodes = (totpCode) => callUnary('GetRecoveryCodes', { totpCode });
export const regenerateRecoveryCodes = (totpCode) => callUnary('RegenerateRecoveryCodes', { totpCode });
export const unbindDevice = (password, totpCode) => callUnary('UnbindDevice', { password, totpCode });
export const loginWith2FA = (userName, password, totpCode, synDataToCloud, cloudfsProxy) =>
  callUnary('LoginWith2FA', { userName, password, totp_code: totpCode, synDataToCloud, cloudfsProxy });
export const sendDisable2FAEmail = (email, cloudfsProxy) =>
  callUnary('SendDisable2FAEmail', { email, cloudfsProxy });
export const disable2FAByEmail = (disableCode, password, cloudfsProxy) =>
  callUnary('Disable2FAByEmail', { disable_code: disableCode, password, cloudfsProxy });

// ---- Sessions ----
export const getSessions = () => callUnary('GetSessions', {});
export const revokeSession = (sessionId) => callUnary('RevokeSession', { sessionId });
export const revokeOtherSessions = () => callUnary('RevokeOtherSessions', {});

// ---- Backup ----
export const backupGetAll = () => callUnary('BackupGetAll', {});
export const backupGetStatus = (sourcePath) => callUnary('BackupGetStatus', { value: sourcePath });
export const backupAdd = (backup) => callUnary('BackupAdd', backup);
export const backupRemove = (sourcePath) => callUnary('BackupRemove', { value: sourcePath });
export const backupUpdate = (backup) => callUnary('BackupUpdate', backup);
export const backupAddDestination = (req) => callUnary('BackupAddDestination', req);
export const backupRemoveDestination = (req) => callUnary('BackupRemoveDestination', req);
export const backupSetEnabled = (sourcePath, isEnabled) =>
  callUnary('BackupSetEnabled', { sourcePath, isEnabled });
export const backupSetFileSystemWatchEnabled = (req) => callUnary('BackupSetFileSystemWatchEnabled', req);
export const backupRestartWalkingThrough = (sourcePath) =>
  callUnary('BackupRestartWalkingThrough', { value: sourcePath });
export const canAddMoreBackups = () => callUnary('CanAddMoreBackups', {});

// ---- Webhooks ----
export const getWebhookConfigTemplate = () => callUnary('GetWebhookConfigTemplate', {});
export const getWebhookConfigs = () => callUnary('GetWebhookConfigs', {});
export const addWebhookConfig = (fileName, content) => callUnary('AddWebhookConfig', { fileName, content });
export const removeWebhookConfig = (fileName) => callUnary('RemoveWebhookConfig', { value: fileName });
export const changeWebhookConfig = (fileName, content) => callUnary('ChangeWebhookConfig', { fileName, content });

// ---- DAV ----
export const addDavUser = (req) => callUnary('AddDavUser', req);
export const removeDavUser = (userName) => callUnary('RemoveDavUser', { value: userName });
export const modifyDavUser = (req) => callUnary('ModifyDavUser', req);
export const getDavUser = (userName) => callUnary('GetDavUser', { value: userName });
export const getDavServerConfig = () => callUnary('GetDavServerConfig', {});
export const setDavServerConfig = (req) => callUnary('SetDavServerConfig', req);

// ---- Token Management ----
export const createToken = (req) => callUnary('CreateToken', req);
export const modifyToken = (req) => callUnary('ModifyToken', req);
export const removeToken = (tokenStr) => callUnary('RemoveToken', { value: tokenStr });
export const listTokens = () => callUnary('ListTokens', {});
export const getApiTokenInfo = (tokenStr) => callUnary('GetApiTokenInfo', { value: tokenStr });

// ---- Web Server Config ----
export const getWebServerConfig = () => callUnary('GetWebServerConfig', {});
export const setWebServerConfig = (req) => callUnary('SetWebServerConfig', req);
export const generateSelfSignedCert = (restartServers) =>
  callUnary('GenerateSelfSignedCert', { restartServers });

// ---- Sync ----
export const syncFileChangesFromCloud = (path) => callUnary('SyncFileChangesFromCloud', { path });
export const startCloudEventListener = (path) => callUnary('StartCloudEventListener', { path });
export const stopCloudEventListener = (path) => callUnary('StopCloudEventListener', { path });
export const walkThroughFolderTest = (path) => callUnary('WalkThroughFolderTest', { path });

// ---- File Create/Write ----
export const createFile = (parentPath, fileName) => callUnary('CreateFile', { parentPath, fileName });
export const closeFile = (fileHandle) => callUnary('CloseFile', { fileHandle });
export const writeToFile = (fileHandle, startPos, length, buffer, closeFile) =>
  callUnary('WriteToFile', { fileHandle, startPos, length, buffer, closeFile });

// ---- Email ----
export const sendConfirmEmail = () => callUnary('SendConfirmEmail', {});
export const confirmEmail = (confirmCode) => callUnary('ConfirmEmail', { confirmCode });
export const sendChangeEmailCode = (newEmail, password) =>
  callUnary('SendChangeEmailCode', { newEmail, password });
export const changeEmail = (newEmail, password, changeCode, totpCode) =>
  callUnary('ChangeEmail', { newEmail, password, changeCode, totpCode });

// ---- Promotions / Plans ----
export const getPromotions = () => callUnary('GetPromotions', {});
export const getPromotionsByCloud = (cloudName) => callUnary('GetPromotionsByCloud', { cloudName });
export const updatePromotionResult = () => callUnary('UpdatePromotionResult', {});
export const updatePromotionResultByCloud = (cloudName, cloudAccountId, promotionId) =>
  callUnary('UpdatePromotionResultByCloud', { cloudName, cloudAccountId, promotionId });
export const sendPromotionAction = (cloudName, cloudAccountId, promotionId) =>
  callUnary('SendPromotionAction', { cloudName, cloudAccountId, promotionId });
export const getCloudDrivePlans = () => callUnary('GetCloudDrivePlans', {});
export const joinPlan = (planId, couponCode) => callUnary('JoinPlan', { planId, couponCode });
export const bindCloudAccount = (cloudName, cloudAccountId) =>
  callUnary('BindCloudAccount', { cloudName, cloudAccountId });
export const transferBalance = (toUserName, amount, password) =>
  callUnary('TransferBalance', { toUserName, amount, password });
export const getBalanceLog = () => callUnary('GetBalanceLog', {});
export const checkActivationCode = (code) => callUnary('CheckActivationCode', { value: code });
export const activatePlan = (code) => callUnary('ActivatePlan', { value: code });
export const checkCouponCode = (planId, couponCode) =>
  callUnary('CheckCouponCode', { planId, couponCode });
export const getStorePurchaseQuote = (productId, couponCode) =>
  callUnary('GetStorePurchaseQuote', { productId, couponCode });
export const verifyStorePurchase = (req) => callUnary('VerifyStorePurchase', req);
export const getReferralCode = () => callUnary('GetReferralCode', {});
export const getCloudDrive1UserData = () => callUnary('GetCloudDrive1UserData', {});

// ---- Remote Upload ----
export const startRemoteUpload = (req) => callUnary('StartRemoteUpload', req);
export const remoteUploadControl = (uploadId, control) =>
  callUnary('RemoteUploadControl', { uploadId, ...control });
