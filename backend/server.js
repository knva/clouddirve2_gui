import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'http';
import * as grpcClient from './grpc-client.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const PORT = process.env.PORT || 13666;

// Track active push streams for cleanup
let pushStream = null;

// Helper: wrap async handler
function wrap(fn) {
  return async (req, res) => {
    try {
      const result = await fn(req, res);
      if (result !== undefined) {
        res.json(result);
      }
    } catch (err) {
      console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
      res.status(500).json({
        error: err.message,
        code: err.code || 'UNKNOWN',
        details: err.details || '',
      });
    }
  };
}

// ==================== Health & Config ====================
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/config', (req, res) => {
  const { url, token } = req.body;
  grpcClient.initClient(url, token);
  res.json({ success: true });
});

app.get('/api/token', (req, res) => {
  res.json({ token: grpcClient.getToken() });
});

app.post('/api/token', (req, res) => {
  grpcClient.setToken(req.body.token);
  res.json({ success: true });
});

// ==================== System & Auth ====================
app.get('/api/system/info', wrap(() => grpcClient.getSystemInfo()));
app.post('/api/auth/get-token', wrap((req) => grpcClient.getTokenReq(req.body.userName, req.body.password, req.body.totpCode)));
app.post('/api/auth/login', wrap(async (req) => {
  const result = await grpcClient.login(req.body.userName, req.body.password, req.body.synDataToCloud, req.body.cloudfsProxy);
  return result;
}));
app.post('/api/auth/login-2fa', wrap((req) => grpcClient.loginWith2FA(req.body.userName, req.body.password, req.body.totpCode, req.body.synDataToCloud, req.body.cloudfsProxy)));
app.post('/api/auth/login-third-party', wrap((req) => grpcClient.loginWithThirdPartyAccount(req.body)));
app.post('/api/auth/register', wrap((req) => grpcClient.register(req.body.userName, req.body.password, req.body.cloudfsProxy)));
app.post('/api/auth/logout', wrap((req) => grpcClient.logout(req.body.logoutFromCloudFS)));
app.get('/api/account/status', wrap(() => grpcClient.getAccountStatus()));
app.post('/api/account/change-password', wrap((req) => grpcClient.changePassword(req.body.oldPassword, req.body.newPassword, req.body.totpCode)));

app.get('/api/runtime-info', wrap(() => grpcClient.getRuntimeInfo()));
app.get('/api/running-info', wrap(() => grpcClient.getRunningInfo()));
app.get('/api/service/capabilities', wrap(() => grpcClient.getServiceCapabilities()));
app.post('/api/service/restart', wrap(() => grpcClient.restartService()));
app.post('/api/service/shutdown', wrap(() => grpcClient.shutdownService()));
app.get('/api/update/check', wrap(() => grpcClient.checkUpdate()));
app.get('/api/update/has', wrap(() => grpcClient.hasUpdate()));
app.post('/api/update/download', wrap(() => grpcClient.downloadUpdate()));
app.post('/api/update/system', wrap(() => grpcClient.updateSystem()));

// ==================== File Operations ====================
app.get('/api/files/list', wrap((req) => grpcClient.getSubFiles(req.query.path || '/', req.query.forceRefresh === 'true')));
app.get('/api/files/search', wrap((req) => grpcClient.getSearchResults(
  req.query.path || '/',
  req.query.searchFor || '',
  req.query.forceRefresh === 'true',
  req.query.fuzzyMatch === 'true',
  req.query.contentSearch === 'true'
)));
app.get('/api/files/find', wrap((req) => grpcClient.findFileByPath(req.query.parentPath, req.query.path)));
app.post('/api/files/create-folder', wrap((req) => grpcClient.createFolder(req.body.parentPath, req.body.folderName)));
app.post('/api/files/create-encrypted-folder', wrap((req) => grpcClient.createEncryptedFolder(req.body.parentPath, req.body.folderName, req.body.password, req.body.savePassword)));
app.post('/api/files/unlock', wrap((req) => grpcClient.unlockEncryptedFile(req.body.path, req.body.password, req.body.permanentUnlock)));
app.post('/api/files/lock', wrap((req) => grpcClient.lockEncryptedFile(req.body.path)));
app.post('/api/files/rename', wrap((req) => grpcClient.renameFile(req.body.path, req.body.newName)));
app.post('/api/files/rename-batch', wrap((req) => grpcClient.renameFiles(req.body.renameFiles)));
app.post('/api/files/move', wrap((req) => grpcClient.moveFile(req.body.paths, req.body.destPath, req.body.conflictPolicy, req.body.moveAcrossClouds, req.body.handleConflictRecursively)));
app.post('/api/files/copy', wrap((req) => grpcClient.copyFile(req.body.paths, req.body.destPath, req.body.conflictPolicy, req.body.handleConflictRecursively)));
app.post('/api/files/delete', wrap((req) => grpcClient.deleteFile(req.body.path)));
app.post('/api/files/delete-permanently', wrap((req) => grpcClient.deleteFilePermanently(req.body.path)));
app.post('/api/files/delete-batch', wrap((req) => grpcClient.deleteFiles(req.body.paths)));
app.post('/api/files/delete-batch-permanently', wrap((req) => grpcClient.deleteFilesPermanently(req.body.paths)));
app.get('/api/files/detail-properties', wrap((req) => grpcClient.getFileDetailProperties(req.query.path)));
app.get('/api/files/space-info', wrap((req) => grpcClient.getSpaceInfo(req.query.path)));
app.get('/api/files/cloud-memberships', wrap((req) => grpcClient.getCloudMemberships(req.query.path)));
app.get('/api/files/metadata', wrap((req) => grpcClient.getMetaData(req.query.path)));
app.get('/api/files/download-url', wrap((req) => grpcClient.getDownloadUrlPath(req.query.path, req.query.preview === 'true', req.query.lazy_read === 'true', req.query.get_direct_url === 'true')));
app.post('/api/files/close-reader', wrap((req) => grpcClient.closeFileReader(req.body.path)));
app.post('/api/files/force-expire-cache', wrap((req) => grpcClient.forceExpireDirCache(req.body.path)));
app.get('/api/files/original-path', wrap((req) => grpcClient.getOriginalPath(req.query.path)));

// ==================== Offline Download ====================
app.post('/api/offline/add', wrap((req) => grpcClient.addOfflineFiles(req.body.urls, req.body.toFolder, req.body.checkFolderAfterSecs)));
app.post('/api/offline/remove', wrap((req) => grpcClient.removeOfflineFiles(req.body.cloudName, req.body.cloudAccountId, req.body.deleteFiles, req.body.infoHashes, req.body.path)));
app.get('/api/offline/list', wrap((req) => grpcClient.listOfflineFilesByPath(req.query.path)));
app.get('/api/offline/list-all', wrap((req) => grpcClient.listAllOfflineFiles(req.query.cloudName, req.query.cloudAccountId, parseInt(req.query.page) || 1, req.query.path)));
app.get('/api/offline/quota', wrap((req) => grpcClient.getOfflineQuotaInfo(req.query.cloudName, req.query.cloudAccountId, req.query.path)));
app.post('/api/offline/clear', wrap((req) => grpcClient.clearOfflineFiles(req.body.cloudName, req.body.cloudAccountId, req.body.filter, req.body.deleteFiles, req.body.path)));
app.post('/api/offline/restart', wrap((req) => grpcClient.restartOfflineTask(req.body.cloudName, req.body.cloudAccountId, req.body.infoHash, req.body.url, req.body.parentId, req.body.path)));

// ==================== Shared Links ====================
app.post('/api/shared-link/add', wrap((req) => grpcClient.addSharedLink(req.body.sharedLinkUrl, req.body.sharedPassword, req.body.toFolder)));

// ==================== Mount Points ====================
app.get('/api/mount/can-add', wrap(() => grpcClient.canAddMoreMountPoints()));
app.get('/api/mount/points', wrap(() => grpcClient.getMountPoints()));
app.post('/api/mount/add', wrap((req) => grpcClient.addMountPoint(req.body)));
app.post('/api/mount/remove', wrap((req) => grpcClient.removeMountPoint(req.body.mountPoint)));
app.post('/api/mount/mount', wrap((req) => grpcClient.mount(req.body.mountPoint)));
app.post('/api/mount/unmount', wrap((req) => grpcClient.unmount(req.body.mountPoint)));
app.post('/api/mount/update', wrap((req) => grpcClient.updateMountPoint(req.body.mountPoint, req.body.newMountOption)));
app.get('/api/mount/drive-letters', wrap(() => grpcClient.getAvailableDriveLetters()));
app.get('/api/mount/has-drive-letters', wrap(() => grpcClient.hasDriveLetters()));
app.get('/api/mount/can-both', wrap(() => grpcClient.canMountBothLocalAndCloud()));
app.get('/api/mount/local-subfiles', wrap((req) => grpcClient.localGetSubFiles(
  req.query.parentFolder || '',
  req.query.folderOnly === 'true',
  req.query.includeCloudDrive === 'true',
  req.query.includeAvailableDrive === 'true'
)));
app.post('/api/mount/local-create-folder', wrap((req) => grpcClient.localCreateFolder(req.body.parentFolder, req.body.folderName)));

// ==================== Tasks ====================
app.get('/api/tasks/count', wrap(() => grpcClient.getAllTasksCount()));
app.get('/api/tasks/download/count', wrap(() => grpcClient.getDownloadFileCount()));
app.get('/api/tasks/download/list', wrap(() => grpcClient.getDownloadFileList()));
app.get('/api/tasks/upload/count', wrap(() => grpcClient.getUploadFileCount()));
app.get('/api/tasks/upload/list', wrap((req) => grpcClient.getUploadFileList(
  req.query.getAll === 'true',
  parseInt(req.query.itemsPerPage) || 50,
  parseInt(req.query.pageNumber) || 1,
  req.query.filter || '',
  req.query.statusFilter ? parseInt(req.query.statusFilter) : undefined,
  req.query.operatorTypeFilter ? parseInt(req.query.operatorTypeFilter) : undefined
)));
app.post('/api/tasks/upload/cancel-all', wrap(() => grpcClient.cancelAllUploadFiles()));
app.post('/api/tasks/upload/cancel', wrap((req) => grpcClient.cancelUploadFiles(req.body.keys)));
app.post('/api/tasks/upload/pause-all', wrap(() => grpcClient.pauseAllUploadFiles()));
app.post('/api/tasks/upload/pause', wrap((req) => grpcClient.pauseUploadFiles(req.body.keys)));
app.post('/api/tasks/upload/resume-all', wrap(() => grpcClient.resumeAllUploadFiles()));
app.post('/api/tasks/upload/resume', wrap((req) => grpcClient.resumeUploadFiles(req.body.keys)));

app.get('/api/tasks/copy/list', wrap(() => grpcClient.getCopyTasks()));
app.get('/api/tasks/merge/list', wrap(() => grpcClient.getMergeTasks()));
app.post('/api/tasks/merge/cancel', wrap((req) => grpcClient.cancelMergeTask(req.body.sourcePath, req.body.destPath)));
app.post('/api/tasks/copy/cancel', wrap((req) => grpcClient.cancelCopyTask(req.body.sourcePath, req.body.destPath)));
app.post('/api/tasks/copy/pause', wrap((req) => grpcClient.pauseCopyTask(req.body.sourcePath, req.body.destPath, req.body.pause)));
app.post('/api/tasks/copy/restart', wrap((req) => grpcClient.restartCopyTask(req.body.sourcePath, req.body.destPath)));
app.post('/api/tasks/copy/remove-completed', wrap(() => grpcClient.removeCompletedCopyTasks()));
app.post('/api/tasks/copy/remove-all', wrap(() => grpcClient.removeAllCopyTasks()));
app.post('/api/tasks/copy/remove', wrap((req) => grpcClient.removeCopyTasks(req.body.taskKeys)));
app.post('/api/tasks/copy/pause-all', wrap((req) => grpcClient.pauseAllCopyTasks(req.body.pause)));
app.post('/api/tasks/copy/pause-batch', wrap((req) => grpcClient.pauseCopyTasks(req.body.taskKeys, req.body.pause)));
app.post('/api/tasks/copy/resume-all', wrap(() => grpcClient.resumeAllCopyTasks()));
app.post('/api/tasks/copy/resume', wrap((req) => grpcClient.resumeCopyTasks(req.body.taskKeys)));
app.get('/api/tasks/open-handles', wrap(() => grpcClient.getOpenFileHandles()));

// ==================== Cloud API Management ====================
app.get('/api/cloud-apis/can-add', wrap(() => grpcClient.canAddMoreCloudApis()));
app.get('/api/cloud-apis', wrap(() => grpcClient.getAllCloudApis()));
app.get('/api/cloud-apis/config', wrap((req) => grpcClient.getCloudAPIConfig(req.query.cloudName, req.query.userName)));
app.post('/api/cloud-apis/config', wrap((req) => grpcClient.setCloudAPIConfig(req.body.cloudName, req.body.userName, req.body.config)));
app.post('/api/cloud-apis/remove', wrap((req) => grpcClient.removeCloudAPI(req.body.cloudName, req.body.userName, req.body.permanentRemove)));

app.post('/api/cloud-apis/login/115-editthiscookie', wrap((req) => grpcClient.apiLogin115Editthiscookie(req.body.editThiscookieString)));
app.post('/api/cloud-apis/login/115-open-oauth', wrap((req) => grpcClient.apiLogin115OpenOAuth(req.body)));
app.post('/api/cloud-apis/login/aliyundrive-oauth', wrap((req) => grpcClient.apiLoginAliyundriveOAuth(req.body)));
app.post('/api/cloud-apis/login/aliyundrive-refreshtoken', wrap((req) => grpcClient.apiLoginAliyundriveRefreshtoken(req.body.refreshToken, req.body.useOpenAPI)));
app.post('/api/cloud-apis/login/baidupan-oauth', wrap((req) => grpcClient.apiLoginBaiduPanOAuth(req.body)));
app.post('/api/cloud-apis/login/onedrive-oauth', wrap((req) => grpcClient.apiLoginOneDriveOAuth(req.body)));
app.post('/api/cloud-apis/login/google-drive-oauth', wrap((req) => grpcClient.apiLoginGoogleDriveOAuth(req.body)));
app.post('/api/cloud-apis/login/google-drive-refreshtoken', wrap((req) => grpcClient.apiLoginGoogleDriveRefreshToken(req.body)));
app.post('/api/cloud-apis/login/xunlei-oauth', wrap((req) => grpcClient.apiLoginXunleiOAuth(req.body)));
app.post('/api/cloud-apis/login/xunlei-open-oauth', wrap((req) => grpcClient.apiLoginXunleiOpenOAuth(req.body)));
app.post('/api/cloud-apis/login/123pan-oauth', wrap((req) => grpcClient.apiLogin123panOAuth(req.body)));
app.post('/api/cloud-apis/login/webdav', wrap((req) => grpcClient.apiLoginWebDav(req.body)));
app.post('/api/cloud-apis/login/s3', wrap((req) => grpcClient.apiLoginS3(req.body)));
app.post('/api/cloud-apis/login/local-folder', wrap((req) => grpcClient.apiAddLocalFolder(req.body.localFolderPath)));
app.post('/api/cloud-apis/login/clouddrive', wrap((req) => grpcClient.apiLoginCloudDrive(req.body)));
app.post('/api/cloud-apis/login/sftp', wrap((req) => grpcClient.apiLoginSftp(req.body)));
app.post('/api/cloud-apis/login/ftp', wrap((req) => grpcClient.apiLoginFtp(req.body)));
app.post('/api/cloud-apis/login/smb', wrap((req) => grpcClient.apiLoginSmb(req.body)));
app.get('/api/cloud-apis/discover-smb-servers', wrap(() => grpcClient.discoverSmbServers()));
app.post('/api/cloud-apis/discover-smb-shares', wrap((req) => grpcClient.discoverSmbShares(req.body)));
app.post('/api/cloud-apis/oauth-state', wrap((req) => grpcClient.createOAuthState(req.body)));

// ==================== System Settings ====================
app.get('/api/settings', wrap(() => grpcClient.getSystemSettings()));
app.post('/api/settings', wrap((req) => grpcClient.setSystemSettings(req.body)));
app.post('/api/settings/dir-cache-time', wrap((req) => grpcClient.setDirCacheTimeSecs(req.body.path, req.body.dirCachTimeToLiveSecs)));
app.get('/api/settings/effective-dir-cache-time', wrap((req) => grpcClient.getEffectiveDirCacheTimeSecs(req.query.path)));
app.post('/api/settings/vacuum-dir-cache', wrap(() => grpcClient.vacuumDirCache()));
app.get('/api/settings/vacuum-progress', wrap(() => grpcClient.getVacuumProgress()));
app.get('/api/settings/dir-cache-db-size', wrap(() => grpcClient.getDirCacheDbSize()));
app.get('/api/settings/open-file-table', wrap((req) => grpcClient.getOpenFileTable(req.query.includeDir === 'true')));
app.get('/api/settings/dir-cache-table', wrap(() => grpcClient.getDirCacheTable()));
app.get('/api/settings/referenced-entry-paths', wrap((req) => grpcClient.getReferencedEntryPaths(req.query.path)));
app.get('/api/settings/temp-file-table', wrap(() => grpcClient.getTempFileTable()));
app.get('/api/machine-id', wrap(() => grpcClient.getMachineId()));
app.get('/api/online-devices', wrap(() => grpcClient.getOnlineDevices()));
app.post('/api/kickout-device', wrap((req) => grpcClient.kickoutDevice(req.body.deviceId)));
app.get('/api/log-files', wrap(() => grpcClient.listLogFiles()));

// ==================== Disk Cache ====================
app.get('/api/disk-cache/stats', wrap(() => grpcClient.getFileBufferDiskCacheStats()));
app.post('/api/disk-cache/purge', wrap(() => grpcClient.purgeFileBufferDiskCache()));
app.post('/api/disk-cache/eviction-strategy', wrap((req) => grpcClient.setDiskCacheEvictionStrategy(req.body.strategy)));
app.post('/api/disk-cache/folder', wrap((req) => grpcClient.setFolderDiskCache(req.body)));
app.post('/api/disk-cache/folder/remove', wrap((req) => grpcClient.removeFolderDiskCache(req.body.path)));
app.get('/api/disk-cache/folders', wrap(() => grpcClient.listDiskCacheFolders()));
app.post('/api/disk-cache/prefetch', wrap((req) => grpcClient.prefetchFileRanges(req.body)));
app.post('/api/disk-cache/cancel-prefetch', wrap((req) => grpcClient.cancelFilePrefetch(req.body.path, req.body.hintIds)));
app.get('/api/disk-cache/active-prefetch', wrap(() => grpcClient.getActivePrefetchHints()));

// ==================== 2FA ====================
app.get('/api/2fa/status', wrap(() => grpcClient.check2FAStatus()));
app.post('/api/2fa/setup', wrap((req) => grpcClient.setup2FA(req.body.password)));
app.post('/api/2fa/enable', wrap((req) => grpcClient.enable2FA(req.body.totpCode)));
app.post('/api/2fa/disable', wrap((req) => grpcClient.disable2FA(req.body.totpCode)));
app.post('/api/2fa/recovery-codes', wrap((req) => grpcClient.getRecoveryCodes(req.body.totpCode)));
app.post('/api/2fa/regenerate-recovery-codes', wrap((req) => grpcClient.regenerateRecoveryCodes(req.body.totpCode)));
app.post('/api/2fa/unbind-device', wrap((req) => grpcClient.unbindDevice(req.body.password, req.body.totpCode)));
app.post('/api/2fa/send-disable-email', wrap((req) => grpcClient.sendDisable2FAEmail(req.body.email, req.body.cloudfsProxy)));
app.post('/api/2fa/disable-by-email', wrap((req) => grpcClient.disable2FAByEmail(req.body.disableCode, req.body.password, req.body.cloudfsProxy)));

// ==================== Sessions ====================
app.get('/api/sessions', wrap(() => grpcClient.getSessions()));
app.post('/api/sessions/revoke', wrap((req) => grpcClient.revokeSession(req.body.sessionId)));
app.post('/api/sessions/revoke-others', wrap(() => grpcClient.revokeOtherSessions()));

// ==================== Backup ====================
app.get('/api/backup/all', wrap(() => grpcClient.backupGetAll()));
app.get('/api/backup/status', wrap((req) => grpcClient.backupGetStatus(req.query.sourcePath)));
app.post('/api/backup/add', wrap((req) => grpcClient.backupAdd(req.body)));
app.post('/api/backup/remove', wrap((req) => grpcClient.backupRemove(req.body.sourcePath)));
app.post('/api/backup/update', wrap((req) => grpcClient.backupUpdate(req.body)));
app.post('/api/backup/add-destination', wrap((req) => grpcClient.backupAddDestination(req.body)));
app.post('/api/backup/remove-destination', wrap((req) => grpcClient.backupRemoveDestination(req.body)));
app.post('/api/backup/set-enabled', wrap((req) => grpcClient.backupSetEnabled(req.body.sourcePath, req.body.isEnabled)));
app.post('/api/backup/set-watch', wrap((req) => grpcClient.backupSetFileSystemWatchEnabled(req.body)));
app.post('/api/backup/restart-walk', wrap((req) => grpcClient.backupRestartWalkingThrough(req.body.sourcePath)));
app.get('/api/backup/can-add', wrap(() => grpcClient.canAddMoreBackups()));

// ==================== Webhooks ====================
app.get('/api/webhook/template', wrap(() => grpcClient.getWebhookConfigTemplate()));
app.get('/api/webhook/list', wrap(() => grpcClient.getWebhookConfigs()));
app.post('/api/webhook/add', wrap((req) => grpcClient.addWebhookConfig(req.body.fileName, req.body.content)));
app.post('/api/webhook/remove', wrap((req) => grpcClient.removeWebhookConfig(req.body.fileName)));
app.post('/api/webhook/change', wrap((req) => grpcClient.changeWebhookConfig(req.body.fileName, req.body.content)));

// ==================== DAV ====================
app.post('/api/dav/user/add', wrap((req) => grpcClient.addDavUser(req.body)));
app.post('/api/dav/user/remove', wrap((req) => grpcClient.removeDavUser(req.body.userName)));
app.post('/api/dav/user/modify', wrap((req) => grpcClient.modifyDavUser(req.body)));
app.get('/api/dav/user', wrap((req) => grpcClient.getDavUser(req.query.userName)));
app.get('/api/dav/config', wrap(() => grpcClient.getDavServerConfig()));
app.post('/api/dav/config', wrap((req) => grpcClient.setDavServerConfig(req.body)));

// ==================== Token Management ====================
app.post('/api/tokens/create', wrap((req) => grpcClient.createToken(req.body)));
app.post('/api/tokens/modify', wrap((req) => grpcClient.modifyToken(req.body)));
app.post('/api/tokens/remove', wrap((req) => grpcClient.removeToken(req.body.token)));
app.get('/api/tokens/list', wrap(() => grpcClient.listTokens()));
app.get('/api/tokens/info', wrap((req) => grpcClient.getApiTokenInfo(req.query.token)));

// ==================== Web Server Config ====================
app.get('/api/web-server/config', wrap(() => grpcClient.getWebServerConfig()));
app.post('/api/web-server/config', wrap((req) => grpcClient.setWebServerConfig(req.body)));
app.post('/api/web-server/generate-cert', wrap((req) => grpcClient.generateSelfSignedCert(req.body.restartServers)));

// ==================== Sync & Misc ====================
app.post('/api/sync/file-changes', wrap((req) => grpcClient.syncFileChangesFromCloud(req.body.path)));
app.post('/api/sync/start-listener', wrap((req) => grpcClient.startCloudEventListener(req.body.path)));
app.post('/api/sync/stop-listener', wrap((req) => grpcClient.stopCloudEventListener(req.body.path)));
app.post('/api/walk-through', wrap((req) => grpcClient.walkThroughFolderTest(req.body.path)));

// ==================== File Create/Write ====================
app.post('/api/files/create', wrap((req) => grpcClient.createFile(req.body.parentPath, req.body.fileName)));
app.post('/api/files/close', wrap((req) => grpcClient.closeFile(req.body.fileHandle)));
app.post('/api/files/write', wrap((req) => grpcClient.writeToFile(req.body.fileHandle, req.body.startPos, req.body.length, Buffer.from(req.body.buffer, 'base64'), req.body.closeFile)));

// ==================== Email ====================
app.post('/api/email/send-confirm', wrap(() => grpcClient.sendConfirmEmail()));
app.post('/api/email/confirm', wrap((req) => grpcClient.confirmEmail(req.body.confirmCode)));
app.post('/api/email/send-change-code', wrap((req) => grpcClient.sendChangeEmailCode(req.body.newEmail, req.body.password)));
app.post('/api/email/change', wrap((req) => grpcClient.changeEmail(req.body.newEmail, req.body.password, req.body.changeCode, req.body.totpCode)));

// ==================== Promotions / Plans ====================
app.get('/api/promotions', wrap(() => grpcClient.getPromotions()));
app.get('/api/promotions/by-cloud', wrap((req) => grpcClient.getPromotionsByCloud(req.query.cloudName)));
app.post('/api/promotions/update-result', wrap(() => grpcClient.updatePromotionResult()));
app.post('/api/promotions/update-result-by-cloud', wrap((req) => grpcClient.updatePromotionResultByCloud(req.body.cloudName, req.body.cloudAccountId, req.body.promotionId)));
app.post('/api/promotions/send-action', wrap((req) => grpcClient.sendPromotionAction(req.body.cloudName, req.body.cloudAccountId, req.body.promotionId)));
app.get('/api/plans', wrap(() => grpcClient.getCloudDrivePlans()));
app.post('/api/plans/join', wrap((req) => grpcClient.joinPlan(req.body.planId, req.body.couponCode)));
app.post('/api/bind-cloud-account', wrap((req) => grpcClient.bindCloudAccount(req.body.cloudName, req.body.cloudAccountId)));
app.post('/api/transfer-balance', wrap((req) => grpcClient.transferBalance(req.body.toUserName, req.body.amount, req.body.password)));
app.get('/api/balance-log', wrap(() => grpcClient.getBalanceLog()));
app.post('/api/check-activation-code', wrap((req) => grpcClient.checkActivationCode(req.body.code)));
app.post('/api/activate-plan', wrap((req) => grpcClient.activatePlan(req.body.code)));
app.post('/api/check-coupon', wrap((req) => grpcClient.checkCouponCode(req.body.planId, req.body.couponCode)));
app.post('/api/store/quote', wrap((req) => grpcClient.getStorePurchaseQuote(req.body.productId, req.body.couponCode)));
app.post('/api/store/verify', wrap((req) => grpcClient.verifyStorePurchase(req.body)));
app.get('/api/referral-code', wrap(() => grpcClient.getReferralCode()));
app.get('/api/clouddrive1-user-data', wrap(() => grpcClient.getCloudDrive1UserData()));

// ==================== Remote Upload ====================
app.post('/api/remote-upload/start', wrap((req) => grpcClient.startRemoteUpload(req.body)));
app.post('/api/remote-upload/control', wrap((req) => grpcClient.remoteUploadControl(req.body.uploadId, req.body.control)));

// ==================== HTTP + WebSocket Server ====================
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('[WS] Client connected');
  
  // Start push message stream
  try {
    pushStream = grpcClient.pushMessage(
      (msg) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'push', data: msg }));
        }
      },
      (err) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'error', data: { message: err.message } }));
        }
      }
    );
  } catch (e) {
    console.error('[WS] Failed to start push stream:', e.message);
  }

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
    if (pushStream) {
      pushStream.cancel();
      pushStream = null;
    }
  });
});

// Initialise gRPC client with default URL on startup
grpcClient.initClient('http://localhost:19798');

server.listen(PORT, () => {
  console.log(`[Backend] CloudDrive2 API server running on http://localhost:${PORT}`);
  console.log(`[Backend] WebSocket at ws://localhost:${PORT}/ws`);
  console.log(`[Backend] gRPC target: localhost:19798`);
});
