use std::sync::Mutex;
use serde_json::{json, Value};
use tonic::transport::Channel;

mod gen {
    include!(concat!(env!("OUT_DIR"), "/clouddrive.rs"));
}

use gen::cloud_drive_file_srv_client::CloudDriveFileSrvClient;

pub struct GrpcState {
    channel: Mutex<Option<Channel>>,
    token: Mutex<Option<String>>,
    server_url: Mutex<String>,
}

fn mk_req<T>(msg: T, token: &Option<String>) -> tonic::Request<T> {
    let mut req = tonic::Request::new(msg);
    if let Some(t) = token {
        if !t.is_empty() {
            if let Ok(v) = format!("Bearer {}", t).parse() { req.metadata_mut().insert("authorization", v); }
        }
    }
    req
}
fn ferr(e: &tonic::Status) -> String { format!("gRPC {}: {}", e.code(), e.message()) }
fn os(v: &Option<String>) -> Value { v.clone().map(|s| json!(s)).unwrap_or(Value::Null) }
fn ob(v: &Option<bool>) -> Value { v.map(|b| json!(b)).unwrap_or(Value::Null) }
fn ou(v: &Option<u64>) -> Value { v.map(|n| json!(n)).unwrap_or(Value::Null) }
fn ou32(v: &Option<u32>) -> Value { v.map(|n| json!(n)).unwrap_or(Value::Null) }
fn od(v: &Option<f64>) -> Value { v.map(|n| json!(n)).unwrap_or(Value::Null) }

fn file_to_json(f: &gen::CloudDriveFile) -> Value {
    let ft = match f.file_type { 0=>"Directory",1=>"File",_=>"Other" };
    let enc = match f.file_encryption_type { 0=>"None",1=>"Encrypted",_=>"Unlocked" };
    json!({
        "id": &f.id, "name": &f.name, "fullPathName": &f.full_path_name, "size": f.size.to_string(),
        "fileType": ft, "isDirectory": f.is_directory, "isRoot": f.is_root, "isCloudRoot": f.is_cloud_root,
        "isCloudDirectory": f.is_cloud_directory, "isCloudFile": f.is_cloud_file, "isSearchResult": f.is_search_result,
        "isForbidden": f.is_forbidden, "isLocal": f.is_local, "canMount": f.can_mount, "canUnmount": f.can_unmount,
        "canDirectAccessThumbnailURL": f.can_direct_access_thumbnail_url, "canSearch": f.can_search,
        "hasDetailProperties": f.has_detail_properties, "canOfflineDownload": f.can_offline_download,
        "canAddShareLink": f.can_add_share_link, "canDeletePermanently": f.can_delete_permanently,
        "readOnly": f.read_only, "fileEncryptionType": enc, "CanCreateEncryptedFolder": f.can_create_encrypted_folder,
        "CanLock": f.can_lock, "CanSyncFileChangesFromCloud": f.can_sync_file_changes_from_cloud,
        "supportOfflineDownloadManagement": f.support_offline_download_management, "canContentSearch": f.can_content_search,
        "thumbnailUrl": &f.thumbnail_url, "previewUrl": &f.preview_url, "originalPath": &f.original_path,
    })
}

fn cloud_api_to_json(c: &gen::CloudApi) -> Value {
    json!({"name":&c.name,"userName":&c.user_name,"nickName":&c.nick_name,"isLocked":c.is_locked,
        "supportMultiThreadUploading":c.support_multi_thread_uploading,"supportQpsLimit":c.support_qps_limit,
        "isCloudEventListenerRunning":c.is_cloud_event_listener_running,"hasPromotions":c.has_promotions,
        "promotionTitle":os(&c.promotion_title),"path":os(&c.path),"supportHttpDownload":c.support_http_download,"readOnly":c.read_only})
}

fn offline_file_to_json(f: &gen::OfflineFile) -> Value {
    json!({"name":&f.name,"size":f.size.to_string(),"url":&f.url,"status":f.status,"infoHash":&f.info_hash,
        "fileId":&f.file_id,"add_time":f.add_time.to_string(),"parentId":&f.parent_id,"percendDone":f.percend_done,"peers":f.peers.to_string()})
}

fn mount_point_to_json(m: &gen::MountPoint) -> Value {
    json!({"mountPoint":&m.mount_point,"sourceDir":&m.source_dir,"localMount":m.local_mount,"readOnly":m.read_only,
        "autoMount":m.auto_mount,"uid":m.uid,"gid":m.gid,"permissions":&m.permissions,"isMounted":m.is_mounted,
        "failReason":&m.fail_reason,"name":&m.name})
}

fn upload_file_to_json(u: &gen::UploadFileInfo) -> Value {
    json!({"key":&u.key,"destPath":&u.dest_path,"size":u.size.to_string(),"transferedBytes":u.transfered_bytes.to_string(),
        "status":&u.status,"errorMessage":&u.error_message,"operatorType":u.operator_type,"statusEnum":u.status_enum})
}

fn download_file_to_json(d: &gen::DownloadFileInfo) -> Value {
    json!({"filePath":&d.file_path,"fileLength":d.file_length.to_string(),"totalBufferUsed":d.total_buffer_used.to_string(),
        "downloadThreadCount":d.download_thread_count,"process":d.process,"detailDownloadInfo":&d.detail_download_info,
        "lastDownloadError":os(&d.last_download_error),"bytesPerSecond":d.bytes_per_second})
}

fn copy_task_to_json(t: &gen::CopyTask) -> Value {
    json!({"taskMode":t.task_mode,"sourcePath":&t.source_path,"destPath":&t.dest_path,"status":t.status,
        "totalFolders":t.total_folders.to_string(),"totalFiles":t.total_files.to_string(),
        "failedFolders":t.failed_folders.to_string(),"failedFiles":t.failed_files.to_string(),
        "uploadedFiles":t.uploaded_files.to_string(),"cancelledFiles":t.cancelled_files.to_string(),
        "skippedFiles":t.skipped_files.to_string(),"totalBytes":t.total_bytes.to_string(),
        "uploadedBytes":t.uploaded_bytes.to_string(),"paused":t.paused})
}

fn merge_task_to_json(t: &gen::MergeTask) -> Value {
    json!({"sourcePath":&t.source_path,"destPath":&t.dest_path,"status":t.status,
        "mergedFiles":t.merged_files.to_string(),"mergedFolders":t.merged_folders.to_string()})
}

fn backup_to_json(b: &gen::Backup) -> Value {
    json!({"sourcePath":&b.source_path,"isEnabled":b.is_enabled,"fileSystemWatchEnabled":b.file_system_watch_enabled,
        "walkingThroughIntervalSecs":b.walking_through_interval_secs.to_string(),
        "destinations":b.destinations.iter().map(|d|json!({"destinationPath":&d.destination_path,"isEnabled":d.is_enabled})).collect::<Vec<_>>()})
}

fn backup_status_to_json(s: &gen::BackupStatus) -> Value {
    json!({"backup":s.backup.as_ref().map(backup_to_json).unwrap_or(Value::Null),"status":s.status,"statusMessage":&s.status_message,
        "watcherStatus":s.watcher_status,"watcherStatusMessage":&s.watcher_status_message})
}

fn token_info_to_json(t: &gen::TokenInfo) -> Value {
    json!({"token":&t.token,"rootDir":&t.root_dir,"friendly_name":&t.friendly_name,
        "expires_in":ou(&t.expires_in),"enableGrpcLog":t.enable_grpc_log,"enableStreamFileLog":t.enable_stream_file_log})
}

fn session_to_json(s: &gen::Session) -> Value {
    json!({"id":&s.id,"device_id":&s.device_id,"device_name":&s.device_name,"device_os_type":&s.device_os_type,
        "created_at":&s.created_at,"last_used_at":&s.last_used_at,"expires_at":&s.expires_at,"last_ip_address":&s.last_ip_address})
}

fn webhook_to_json(w: &gen::WebhookInfo) -> Value {
    json!({"fileName":&w.file_name,"content":&w.content,"isValid":w.is_valid})
}

fn dav_user_to_json(u: &gen::DavUser) -> Value {
    json!({"userName":&u.user_name,"password":&u.password,"rootPath":&u.root_path,"readOnly":u.read_only,"enabled":u.enabled,"guest":u.guest})
}

fn log_file_to_json(f: &gen::LogFileRecord) -> Value {
    json!({"fileName":&f.file_name,"fileSize":f.file_size.to_string()})
}

fn str_arr(v: &Value, key: &str) -> Vec<String> {
    v.get(key).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default()
}
fn s(v: &Value, key: &str) -> String { v.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string() }
fn b(v: &Value, key: &str, d: bool) -> bool { v.get(key).and_then(|v| v.as_bool()).unwrap_or(d) }
fn u(v: &Value, key: &str, d: u64) -> u64 { v.get(key).and_then(|v| v.as_u64()).unwrap_or(d) }
fn u32v(v: &Value, key: &str, d: u32) -> u32 { v.get(key).and_then(|v| v.as_u64()).unwrap_or(d as u64) as u32 }
fn f64v(v: &Value, key: &str, d: f64) -> f64 { v.get(key).and_then(|v| v.as_f64()).unwrap_or(d) }
fn opt_s(v: &Value, key: &str) -> Option<String> { v.get(key).and_then(|v| v.as_str()).map(String::from) }
fn opt_u(v: &Value, key: &str) -> Option<u64> { v.get(key).and_then(|v| v.as_u64()) }
fn opt_u32(v: &Value, key: &str) -> Option<u32> { v.get(key).and_then(|v| v.as_u64()).map(|n| n as u32) }
fn opt_b(v: &Value, key: &str) -> Option<bool> { v.get(key).and_then(|v| v.as_bool()) }

impl GrpcState {
    pub fn new() -> Self { Self { channel: Mutex::new(None), token: Mutex::new(None), server_url: Mutex::new("http://localhost:19798".to_string()) } }
    pub fn set_config(&self, url: &str, token: Option<&str>) {
        *self.server_url.lock().unwrap() = url.to_string();
        if let Some(t) = token { *self.token.lock().unwrap() = if t.is_empty() { None } else { Some(t.to_string()) }; }
        let clean = url.trim_start_matches("http://").trim_start_matches("https://");
        if let Ok(ep) = tonic::transport::Endpoint::from_shared(format!("http://{}", clean)) {
            *self.channel.lock().unwrap() = Some(ep.connect_lazy());
        }
    }
    pub fn set_token(&self, token: &str) { *self.token.lock().unwrap() = if token.is_empty() { None } else { Some(token.to_string()) }; }
    pub fn get_token(&self) -> Option<String> { self.token.lock().unwrap().clone() }
    pub fn is_connected(&self) -> bool { self.channel.lock().unwrap().is_some() }
    fn get_channel(&self) -> Result<Channel, String> { Ok(self.channel.lock().unwrap().as_ref().ok_or("未连接到服务器，请先在设置中配置服务器地址".to_string())?.clone()) }

    pub async fn call(&self, method: &str, p: Value) -> Result<Value, String> {
        let channel = self.get_channel()?;
        let token = self.token.lock().unwrap().clone();
        let mut c = CloudDriveFileSrvClient::new(channel);
        match method {
            // ===== System =====
            "GetSystemInfo" => { let i=c.get_system_info(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"IsLogin":i.is_login,"UserName":i.user_name,"SystemReady":i.system_ready,"SystemMessage":os(&i.system_message),"hasError":ob(&i.has_error),"devicePowerType":match i.device_power_type{0=>"DESKTOP",1=>"SLOW_STORAGE",_=>"BATTERY"},"diskCacheDisabled":ob(&i.disk_cache_disabled)})) }
            "GetRuntimeInfo" => { let i=c.get_runtime_info(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"productName":i.product_name,"productVersion":i.product_version,"CloudAPIVersion":i.cloud_api_version,"osInfo":i.os_info})) }
            "GetRunningInfo" => { let i=c.get_running_info(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"cpuUsage":i.cpu_usage,"memUsageKB":i.mem_usage_kb.to_string(),"uptime":i.uptime,"totalMemoryKB":i.total_memory_kb.to_string(),"downloadBytesPerSecond":i.download_bytes_per_second,"uploadBytesPerSecond":i.upload_bytes_per_second})) }
            "GetServiceCapabilities" => { let i=c.get_service_capabilities(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"canRestart":i.can_restart,"canUpdate":i.can_update})) }
            "RestartService" => { c.restart_service(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ShutdownService" => { c.shutdown_service(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "HasUpdate" => { let i=c.has_update(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"hasUpdate":i.has_update,"newVersion":i.new_version,"description":i.description})) }
            "CheckUpdate" => { let i=c.check_update(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"hasUpdate":i.has_update,"newVersion":i.new_version,"description":i.description})) }
            "DownloadUpdate" => { c.download_update(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "UpdateSystem" => { c.update_system(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Auth =====
            "GetToken" => { let req=gen::GetTokenRequest{user_name:s(&p,"userName"),password:s(&p,"password"),totp_code:opt_s(&p,"totpCode")};
                let i=c.get_token(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"success":i.success,"errorMessage":i.error_message,"token":i.token})) }
            "Login" => { let req=gen::UserLoginRequest{user_name:s(&p,"userName"),password:s(&p,"password"),syn_data_to_cloud:b(&p,"synDataToCloud",true),cloudfs_proxy:None};
                let i=c.login(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "LoginWith2FA" => { let req=gen::LoginWith2FaRequest{user_name:s(&p,"userName"),password:s(&p,"password"),totp_code:s(&p,"totpCode"),syn_data_to_cloud:b(&p,"synDataToCloud",true),cloudfs_proxy:None};
                let i=c.login_with2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"success":i.success,"errorMessage":i.error_message,"token":i.token})) }
            "Register" => { let req=gen::UserRegisterRequest{user_name:s(&p,"userName"),password:s(&p,"password"),cloudfs_proxy:None};
                let i=c.register(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "Logout" => { let req=gen::UserLogoutRequest{logout_from_cloud_fs:b(&p,"logoutFromCloudFS",true)};
                let i=c.logout(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "GetAccountStatus" => { let i=c.get_account_status(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                let plan = i.account_plan.as_ref().map(|p| json!({
                    "planName":&p.plan_name,"description":&p.description,"fontAwesomeIcon":&p.font_awesome_icon,
                    "durationDescription":&p.duration_description,"endTime":p.end_time.as_ref().map(|t|t.seconds.to_string()).unwrap_or_default(),"planId":&p.plan_id
                }));
                let roles: Vec<Value> = i.account_roles.iter().map(|r| json!({"roleName":&r.role_name,"description":&r.description,"value":r.value})).collect();
                let second_plan = i.second_plan.as_ref().map(|p| json!({
                    "planName":&p.plan_name,"description":&p.description,"fontAwesomeIcon":&p.font_awesome_icon,
                    "durationDescription":&p.duration_description,"endTime":p.end_time.as_ref().map(|t|t.seconds.to_string()).unwrap_or_default(),"planId":&p.plan_id
                }));
                Ok(json!({
                    "userName":i.user_name,"emailConfirmed":i.email_confirmed,"accountBalance":i.account_balance,
                    "accountPlan":plan,"accountRoles":roles,"secondPlan":second_plan,
                    "partnerReferralCode":os(&i.partner_referral_code),"trustedDevice":ob(&i.trusted_device),
                    "userNameIsDeviceId":ob(&i.user_name_is_device_id)
                })) }
            "ChangePassword" => { let req=gen::ChangePasswordRequest{old_password:s(&p,"oldPassword"),new_password:s(&p,"newPassword"),totp_code:opt_s(&p,"totpCode")};
                let i=c.change_password(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }

            // ===== Files =====
            "GetSubFiles" => { let req=gen::ListSubFileRequest{path:s(&p,"path"),force_refresh:b(&p,"forceRefresh",false),check_expires:None};
                let mut st=c.get_sub_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); let mut files=Vec::new();
                while let Some(r)=st.message().await.map_err(|e|ferr(&e))? { for f in &r.sub_files { files.push(file_to_json(f)); } } Ok(json!(files)) }
            "GetSearchResults" => { let req=gen::SearchRequest{path:s(&p,"path"),search_for:s(&p,"searchFor"),force_refresh:b(&p,"forceRefresh",false),fuzzy_match:b(&p,"fuzzyMatch",true),add_result_to_mounted_search_folder:None,content_search:p.get("contentSearch").and_then(|v|v.as_bool())};
                let mut st=c.get_search_results(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); let mut files=Vec::new();
                while let Some(r)=st.message().await.map_err(|e|ferr(&e))? { for f in &r.sub_files { files.push(file_to_json(f)); } } Ok(json!(files)) }
            "FindFileByPath" => { let req=gen::FindFileByPathRequest{parent_path:s(&p,"parentPath"),path:s(&p,"path")};
                let r=c.find_file_by_path(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(file_to_json(&r.into_inner())) }
            "CreateFolder" => { let req=gen::CreateFolderRequest{parent_path:s(&p,"parentPath"),folder_name:s(&p,"folderName")};
                let i=c.create_folder(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                let r=i.result.map(|r|json!({"success":r.success,"errorMessage":r.error_message})).unwrap_or(json!({})); Ok(r) }
            "CreateEncryptedFolder" => { let req=gen::CreateEncryptedFolderRequest{parent_path:s(&p,"parentPath"),folder_name:s(&p,"folderName"),password:s(&p,"password"),save_password:b(&p,"savePassword",false)};
                let i=c.create_encrypted_folder(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                let r=i.result.map(|r|json!({"success":r.success,"errorMessage":r.error_message})).unwrap_or(json!({})); Ok(r) }
            "UnlockEncryptedFile" => { let req=gen::UnlockEncryptedFileRequest{path:s(&p,"path"),password:s(&p,"password"),permanent_unlock:b(&p,"permanentUnlock",false)};
                let i=c.unlock_encrypted_file(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "LockEncryptedFile" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None};
                let i=c.lock_encrypted_file(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "RenameFile" => { let req=gen::RenameFileRequest{the_file_path:s(&p,"path"),new_name:s(&p,"newName")};
                let i=c.rename_file(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "MoveFile" => { let req=gen::MoveFileRequest{the_file_paths:str_arr(&p,"paths"),dest_path:s(&p,"destPath"),conflict_policy:Some(match s(&p,"conflictPolicy").as_str(){"Overwrite"=>1,"Skip"=>2,_=>0}),move_across_clouds:Some(b(&p,"moveAcrossClouds",false)),handle_conflict_recursively:Some(b(&p,"handleConflictRecursively",false))};
                let i=c.move_file(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "CopyFile" => { let req=gen::CopyFileRequest{the_file_paths:str_arr(&p,"paths"),dest_path:s(&p,"destPath"),conflict_policy:Some(match s(&p,"conflictPolicy").as_str(){"Overwrite"=>1,"Skip"=>2,_=>0}),handle_conflict_recursively:Some(b(&p,"handleConflictRecursively",false))};
                let i=c.copy_file(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "DeleteFile" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None};
                let i=c.delete_file(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "DeleteFilePermanently" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None};
                let i=c.delete_file_permanently(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "DeleteFiles" => { let req=gen::MultiFileRequest{path:str_arr(&p,"paths")};
                let i=c.delete_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "DeleteFilesPermanently" => { let req=gen::MultiFileRequest{path:str_arr(&p,"paths")};
                let i=c.delete_files_permanently(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "GetFileDetailProperties" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None};
                let i=c.get_file_detail_properties(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"totalFileCount":i.total_file_count.to_string(),"totalFolderCount":i.total_folder_count.to_string(),"totalSize":i.total_size.to_string(),"isFaved":i.is_faved,"isShared":i.is_shared,"originalPath":i.original_path})) }
            "GetSpaceInfo" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None};
                let i=c.get_space_info(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"totalSpace":i.total_space.to_string(),"usedSpace":i.used_space.to_string(),"freeSpace":i.free_space.to_string()})) }
            "GetDownloadUrlPath" => { let req=gen::GetDownloadUrlPathRequest{path:s(&p,"path"),preview:b(&p,"preview",false),lazy_read:b(&p,"lazy_read",false),get_direct_url:b(&p,"get_direct_url",false)};
                let i=c.get_download_url_path(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"downloadUrlPath":i.download_url_path,"expiresIn":i.expires_in.map(|v|v.to_string()),"directUrl":os(&i.direct_url),"userAgent":os(&i.user_agent)})) }
            "CloseFileReader" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.close_file_reader(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ForceExpireDirCache" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.force_expire_dir_cache(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetOriginalPath" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; let r=c.get_original_path(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }
            "GetMetaData" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; let i=c.get_meta_data(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!(i.metadata)) }
            "GetCloudMemberships" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; let i=c.get_cloud_memberships(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!(i.memberships.iter().map(|m|json!({"identity":&m.identity,"level":os(&m.level)})).collect::<Vec<_>>())) }

            // ===== Offline =====
            "AddOfflineFiles" => { let req=gen::AddOfflineFileRequest{urls:s(&p,"urls"),to_folder:s(&p,"toFolder"),check_folder_after_secs:Some(u(&p,"checkFolderAfterSecs",0))};
                let _=c.add_offline_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveOfflineFiles" => { let req=gen::RemoveOfflineFilesRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),delete_files:b(&p,"deleteFiles",false),info_hashes:str_arr(&p,"infoHashes"),path:opt_s(&p,"path")};
                let _=c.remove_offline_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ListOfflineFilesByPath" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; let i=c.list_offline_files_by_path(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"offlineFiles":i.offline_files.iter().map(offline_file_to_json).collect::<Vec<_>>()})) }
            "ListAllOfflineFiles" => { let req=gen::OfflineFileListAllRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),page:u32v(&p,"page",1),path:opt_s(&p,"path")};
                let i=c.list_all_offline_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"offlineFiles":i.offline_files.iter().map(offline_file_to_json).collect::<Vec<_>>(),"status":i.status.map(|s|json!({"quota":s.quota,"total":s.total})).unwrap_or(json!({})),"pageNo":i.page_no,"pageRowCount":i.page_row_count,"pageCount":i.page_count,"totalCount":i.total_count})) }
            "GetOfflineQuotaInfo" => { let req=gen::OfflineQuotaRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),path:opt_s(&p,"path")};
                let i=c.get_offline_quota_info(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"total":i.total,"used":i.used,"left":i.left})) }
            "ClearOfflineFiles" => { let req=gen::ClearOfflineFileRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),filter:match s(&p,"filter").as_str(){"Completed"=>1,"Finished"=>1,"Failed"=>2,"Error"=>2,"All"=>0,"Downloading"=>3,_=>0},delete_files:b(&p,"deleteFiles",false),path:opt_s(&p,"path")};
                let _=c.clear_offline_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RestartOfflineTask" => { let req=gen::RestartOfflineFileRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),info_hash:s(&p,"infoHash"),url:s(&p,"url"),parent_id:s(&p,"parentId"),path:opt_s(&p,"path")};
                let _=c.restart_offline_task(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "AddSharedLink" => { let req=gen::AddSharedLinkRequest{shared_link_url:s(&p,"sharedLinkUrl"),shared_password:opt_s(&p,"sharedPassword"),to_folder:s(&p,"toFolder")}; c.add_shared_link(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Cloud APIs =====
            "CanAddMoreCloudApis" => { let i=c.can_add_more_cloud_apis(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "GetAllCloudApis" => { let i=c.get_all_cloud_apis(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"apis":i.apis.iter().map(cloud_api_to_json).collect::<Vec<_>>()})) }
            "RemoveCloudAPI" => { let req=gen::RemoveCloudApiRequest{cloud_name:s(&p,"cloudName"),user_name:s(&p,"userName"),permanent_remove:b(&p,"permanentRemove",false)};
                let i=c.remove_cloud_api(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "GetCloudAPIConfig" => { let req=gen::GetCloudApiConfigRequest{cloud_name:s(&p,"cloudName"),user_name:s(&p,"userName")};
                let i=c.get_cloud_api_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"maxDownloadThreads":i.max_download_threads,"minReadLengthKB":i.min_read_length_kb,"maxReadLengthKB":i.max_read_length_kb,"defaultReadLengthKB":i.default_read_length_kb,"maxBufferPoolSizeMB":i.max_buffer_pool_size_mb,"maxQueriesPerSecond":i.max_queries_per_second,"forceIpv4":i.force_ipv4,"customUserAgent":os(&i.custom_user_agent),"maxUploadThreads":ou32(&i.max_upload_threads),"useHttpDownload":ob(&i.use_http_download)})) }
            "SetCloudAPIConfig" => {
                let config=gen::CloudApiConfig{max_download_threads:u32v(&p,"maxDownloadThreads",0),min_read_length_kb:u(&p,"minReadLengthKB",0),max_read_length_kb:u(&p,"maxReadLengthKB",0),default_read_length_kb:u(&p,"defaultReadLengthKB",0),max_buffer_pool_size_mb:u(&p,"maxBufferPoolSizeMB",0),max_queries_per_second:f64v(&p,"maxQueriesPerSecond",0.0),force_ipv4:b(&p,"forceIpv4",false),api_proxy:None,data_proxy:None,custom_user_agent:opt_s(&p,"customUserAgent"),max_upload_threads:opt_u32(&p,"maxUploadThreads"),insecure_tls:opt_b(&p,"insecureTls"),use_http_download:opt_b(&p,"useHttpDownload"),support_direct_link:opt_b(&p,"supportDirectLink"),support_direct_download_url:opt_b(&p,"supportDirectDownloadUrl"),max_download_threads_limit:opt_u32(&p,"maxDownloadThreadsLimit"),max_buffer_pool_size_mb_limit:opt_u(&p,"maxBufferPoolSizeMBLimit"),max_queries_per_second_limit:opt_f64(&p,"maxQueriesPerSecondLimit"),use_multithread_downloader_for_copy:opt_b(&p,"useMultithreadDownloaderForCopy")};
                let req=gen::SetCloudApiConfigRequest{cloud_name:s(&p,"cloudName"),user_name:s(&p,"userName"),config:Some(config)};
                c.set_cloud_api_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Tasks =====
            "GetAllTasksCount" => { let i=c.get_all_tasks_count(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"downloadCount":i.download_count,"uploadCount":i.upload_count,"copyTaskCount":i.copy_task_count})) }
            "GetDownloadFileCount" => { let i=c.get_download_file_count(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"count":i.file_count})) }
            "GetUploadFileCount" => { let i=c.get_upload_file_count(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"count":i.file_count})) }
            "GetDownloadFileList" => { let i=c.get_download_file_list(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"globalBytesPerSecond":i.global_bytes_per_second,"downloadFiles":i.download_files.iter().map(download_file_to_json).collect::<Vec<_>>()})) }
            "GetUploadFileList" => { let req=gen::GetUploadFileListRequest{get_all:b(&p,"getAll",true),items_per_page:u32v(&p,"itemsPerPage",50),page_number:u32v(&p,"pageNumber",1),filter:s(&p,"filter"),status_filter:None,operator_type_filter:None};
                let i=c.get_upload_file_list(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"totalCount":i.total_count,"uploadFiles":i.upload_files.iter().map(upload_file_to_json).collect::<Vec<_>>(),"globalBytesPerSecond":i.global_bytes_per_second,"totalBytes":i.total_bytes.to_string(),"finishedBytes":i.finished_bytes.to_string(),"totalCountFiltered":i.total_count_filtered})) }
            "GetCopyTasks" => { let i=c.get_copy_tasks(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"copyTasks":i.copy_tasks.iter().map(copy_task_to_json).collect::<Vec<_>>()})) }
            "GetMergeTasks" => { let i=c.get_merge_tasks(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"mergeTasks":i.merge_tasks.iter().map(merge_task_to_json).collect::<Vec<_>>()})) }
            "CancelAllUploadFiles" => { c.cancel_all_upload_files(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CancelUploadFiles" => { let req=gen::MultpleUploadFileKeyRequest{keys:str_arr(&p,"keys")}; c.cancel_upload_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "PauseAllUploadFiles" => { c.pause_all_upload_files(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "PauseUploadFiles" => { let req=gen::MultpleUploadFileKeyRequest{keys:str_arr(&p,"keys")}; c.pause_upload_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ResumeAllUploadFiles" => { c.resume_all_upload_files(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ResumeUploadFiles" => { let req=gen::MultpleUploadFileKeyRequest{keys:str_arr(&p,"keys")}; c.resume_upload_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CancelMergeTask" => { let req=gen::CancelMergeTaskRequest{source_path:s(&p,"sourcePath"),dest_path:s(&p,"destPath")}; c.cancel_merge_task(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CancelCopyTask" => { let req=gen::CopyTaskRequest{source_path:s(&p,"sourcePath"),dest_path:s(&p,"destPath")}; c.cancel_copy_task(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "PauseCopyTask" => { let req=gen::PauseCopyTaskRequest{source_path:s(&p,"sourcePath"),dest_path:s(&p,"destPath"),pause:b(&p,"pause",true)}; c.pause_copy_task(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RestartCopyTask" => { let req=gen::CopyTaskRequest{source_path:s(&p,"sourcePath"),dest_path:s(&p,"destPath")}; c.restart_copy_task(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveCompletedCopyTasks" => { c.remove_completed_copy_tasks(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveAllCopyTasks" => { c.remove_all_copy_tasks(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveCopyTasks" => { let req=gen::CopyTaskBatchRequest{task_keys:str_arr(&p,"taskKeys")}; c.remove_copy_tasks(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "PauseAllCopyTasks" => { let req=gen::PauseAllCopyTasksRequest{pause:b(&p,"pause",true)}; c.pause_all_copy_tasks(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "PauseCopyTasks" => { let req=gen::PauseCopyTasksRequest{task_keys:str_arr(&p,"taskKeys"),pause:b(&p,"pause",true)}; c.pause_copy_tasks(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ResumeAllCopyTasks" => { c.resume_all_copy_tasks(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ResumeCopyTasks" => { let req=gen::CopyTaskBatchRequest{task_keys:str_arr(&p,"taskKeys")}; c.resume_copy_tasks(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetOpenFileHandles" => { let i=c.get_open_file_handles(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"openFileHandles":i.open_file_handles.iter().map(|h|json!({"fileHandle":h.file_handle,"processId":h.process_id,"processPath":&h.process_path,"filePath":&h.file_path,"isDirectory":h.is_directory})).collect::<Vec<_>>()})) }

            // ===== Mount =====
            "CanAddMoreMountPoints" => { let i=c.can_add_more_mount_points(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "GetMountPoints" => { let i=c.get_mount_points(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"mountPoints":i.mount_points.iter().map(mount_point_to_json).collect::<Vec<_>>()})) }
            "AddMountPoint" => {
                let mo=gen::MountOption{mount_point:s(&p,"mountPoint"),source_dir:s(&p,"sourceDir"),local_mount:b(&p,"localMount",false),read_only:b(&p,"readOnly",false),auto_mount:b(&p,"autoMount",false),uid:u32v(&p,"uid",0),gid:u32v(&p,"gid",0),permissions:s(&p,"permissions"),name:s(&p,"name")};
                let i=c.add_mount_point(mk_req(mo,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"failReason":i.fail_reason})) }
            "RemoveMountPoint" => { let req=gen::MountPointRequest{mount_point:s(&p,"mountPoint")};
                let i=c.remove_mount_point(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"failReason":i.fail_reason})) }
            "Mount" => { let req=gen::MountPointRequest{mount_point:s(&p,"mountPoint")};
                let i=c.mount(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"failReason":i.fail_reason})) }
            "Unmount" => { let req=gen::MountPointRequest{mount_point:s(&p,"mountPoint")};
                let i=c.unmount(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"failReason":i.fail_reason})) }
            "UpdateMountPoint" => {
                let mo=gen::MountOption{mount_point:s(&p,"mountPoint"),source_dir:s(&p,"sourceDir"),local_mount:b(&p,"localMount",false),read_only:b(&p,"readOnly",false),auto_mount:b(&p,"autoMount",false),uid:u32v(&p,"uid",0),gid:u32v(&p,"gid",0),permissions:s(&p,"permissions"),name:s(&p,"name")};
                let req=gen::UpdateMountPointRequest{mount_point:s(&p,"mountPoint"),new_mount_option:Some(mo)};
                let i=c.update_mount_point(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"failReason":i.fail_reason})) }
            "GetAvailableDriveLetters" => { let i=c.get_available_drive_letters(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"driveLetters":i.drive_letters})) }
            "HasDriveLetters" => { let i=c.has_drive_letters(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"hasDriveLetters":i.has_drive_letters})) }
            "CanMountBothLocalAndCloud" => { let i=c.can_mount_both_local_and_cloud(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"result":i.result})) }
            "LocalGetSubFiles" => { let req=gen::LocalGetSubFilesRequest{parent_folder:s(&p,"parentFolder"),folder_only:b(&p,"folderOnly",false),include_cloud_drive:b(&p,"includeCloudDrive",false),include_available_drive:b(&p,"includeAvailableDrive",false)};
                let mut st=c.local_get_sub_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); let mut sub_files=Vec::new();
                while let Some(r)=st.message().await.map_err(|e|ferr(&e))? { sub_files.extend(r.sub_files); } Ok(json!({"subFiles":sub_files})) }
            "LocalCreateFolder" => { let req=gen::LocalCreateFolderRequest{parent_folder:s(&p,"parentFolder"),folder_name:s(&p,"folderName")}; let _=c.local_create_folder(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "WalkThroughFolderTest" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; let i=c.walk_through_folder_test(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"totalFolderCount":i.total_folder_count.to_string(),"totalFileCount":i.total_file_count.to_string(),"totalSize":i.total_size.to_string()})) }

            // ===== System Settings =====
            "GetSystemSettings" => { let i=c.get_system_settings(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"dirCacheTimeToLiveSecs":ou(&i.dir_cache_time_to_live_secs),"maxPreProcessTasks":ou(&i.max_pre_process_tasks),"maxProcessTasks":ou(&i.max_process_tasks),"tempFileLocation":&i.temp_file_location,"syncWithCloud":ob(&i.sync_with_cloud),"readDownloaderTimeoutSecs":ou(&i.read_downloader_timeout_secs),"uploadDelaySecs":ou(&i.upload_delay_secs),"processBlackList":i.process_black_list.as_ref().map(|l|l.values.clone()).unwrap_or_default(),"uploadIgnoredExtensions":i.upload_ignored_extensions.as_ref().map(|l|l.values.clone()).unwrap_or_default(),"updateChannel":i.update_channel,"maxDownloadSpeedKBytesPerSecond":od(&i.max_download_speed_k_bytes_per_second),"maxUploadSpeedKBytesPerSecond":od(&i.max_upload_speed_k_bytes_per_second),"deviceName":&i.device_name,"dirCachePersistence":ob(&i.dir_cache_persistence),"fileBufferDiskCacheLocation":&i.file_buffer_disk_cache_location,"fileBufferDiskCacheMaxBytes":ou(&i.file_buffer_disk_cache_max_bytes)})) }
            "SetSystemSettings" => {
                let settings=gen::SystemSettings{dir_cache_time_to_live_secs:opt_u(&p,"dirCacheTimeToLiveSecs"),max_pre_process_tasks:opt_u(&p,"maxPreProcessTasks"),max_process_tasks:opt_u(&p,"maxProcessTasks"),temp_file_location:opt_s(&p,"tempFileLocation"),sync_with_cloud:opt_b(&p,"syncWithCloud"),read_downloader_timeout_secs:opt_u(&p,"readDownloaderTimeoutSecs"),upload_delay_secs:opt_u(&p,"uploadDelaySecs"),process_black_list:p.get("processBlackList").and_then(|v|v.as_array()).map(|a|gen::StringList{values:a.iter().filter_map(|v|v.as_str().map(String::from)).collect()}),upload_ignored_extensions:p.get("uploadIgnoredExtensions").and_then(|v|v.as_array()).map(|a|gen::StringList{values:a.iter().filter_map(|v|v.as_str().map(String::from)).collect()}),update_channel:match s(&p,"updateChannel").as_str(){"Beta"=>Some(1),_=>Some(0)},max_download_speed_k_bytes_per_second:p.get("maxDownloadSpeedKBytesPerSecond").and_then(|v|v.as_f64()),max_upload_speed_k_bytes_per_second:p.get("maxUploadSpeedKBytesPerSecond").and_then(|v|v.as_f64()),device_name:opt_s(&p,"deviceName"),dir_cache_persistence:opt_b(&p,"dirCachePersistence"),dir_cache_db_location:None,file_log_level:None,terminal_log_level:None,backup_log_level:None,enable_auto_register_device:opt_b(&p,"EnableAutoRegisterDevice"),realtime_log_level:None,operator_priority_order:p.get("operatorPriorityOrder").and_then(|v|v.as_array()).map(|a|gen::StringList{values:a.iter().filter_map(|v|v.as_str().map(String::from)).collect()}),update_proxy:None,start_delay_secs:opt_u(&p,"startDelaySecs"),file_buffer_disk_cache_location:opt_s(&p,"fileBufferDiskCacheLocation"),file_buffer_disk_cache_max_bytes:opt_u(&p,"fileBufferDiskCacheMaxBytes"),cloudfs_proxy:None,max_file_log_size_bytes:opt_u(&p,"maxFileLogSizeBytes"),max_backup_log_size_bytes:opt_u(&p,"maxBackupLogSizeBytes"),max_file_log_files:opt_u32(&p,"maxFileLogFiles"),max_backup_log_files:opt_u32(&p,"maxBackupLogFiles")};
                c.set_system_settings(mk_req(settings,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Dir Cache =====
            "SetDirCacheTimeSecs" => { let req=gen::SetDirCacheTimeRequest{path:s(&p,"path"),dir_cach_time_to_live_secs:opt_u(&p,"dirCachTimeToLiveSecs")}; c.set_dir_cache_time_secs(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetEffectiveDirCacheTimeSecs" => { let req=gen::GetEffectiveDirCacheTimeRequest{path:s(&p,"path")}; let i=c.get_effective_dir_cache_time_secs(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"dirCacheTimeSecs":i.dir_cache_time_secs})) }
            "VacuumDirCache" => { c.vacuum_dir_cache(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetVacuumProgress" => { let i=c.get_vacuum_progress(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"status":i.status,"sizeBefore":i.size_before.to_string(),"sizeAfter":i.size_after.to_string(),"errorMessage":os(&i.error_message)})) }
            "GetDirCacheDbSize" => { let i=c.get_dir_cache_db_size(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"totalSizeBytes":i.total_size_bytes.to_string(),"isVacuuming":i.is_vacuuming})) }
            "GetOpenFileTable" => { let req=gen::GetOpenFileTableRequest{include_dir:b(&p,"includeDir",false)}; let i=c.get_open_file_table(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"localOpenFileCount":i.local_open_file_count})) }
            "GetDirCacheTable" => { let _i=c.get_dir_cache_table(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({})) }
            "GetReferencedEntryPaths" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; let i=c.get_referenced_entry_paths(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"values":i.values})) }
            "GetTempFileTable" => { let i=c.get_temp_file_table(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"count":i.count,"tempFiles":i.temp_files})) }

            // ===== Disk Cache =====
            "PurgeFileBufferDiskCache" => { c.purge_file_buffer_disk_cache(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetFileBufferDiskCacheStats" => { let i=c.get_file_buffer_disk_cache_stats(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"enabled":i.enabled,"totalBytes":i.total_bytes.to_string(),"maxBytes":i.max_bytes.to_string(),"entryCount":i.entry_count.to_string(),"segmentCount":i.segment_count.to_string(),"rootDir":&i.root_dir,"scanCompleted":i.scan_completed,"evictionStrategy":i.eviction_strategy})) }
            "SetDiskCacheEvictionStrategy" => { let req=gen::SetDiskCacheEvictionStrategyRequest{strategy:match s(&p,"strategy").as_str(){"LARGEST_FIRST"=>1,"SMALLEST_FIRST"=>2,_=>0}}; c.set_disk_cache_eviction_strategy(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "SetFolderDiskCache" => { let req=gen::SetFolderDiskCacheRequest{path:s(&p,"path"),max_file_size:u(&p,"maxFileSize",0),min_file_size:u(&p,"minFileSize",0),extension_filter_mode:u32v(&p,"extensionFilterMode",0) as i32,extensions:str_arr(&p,"extensions"),enabled:b(&p,"enabled",true)}; c.set_folder_disk_cache(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveFolderDiskCache" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.remove_folder_disk_cache(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ListDiskCacheFolders" => { let i=c.list_disk_cache_folders(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"folders":i.folders.iter().map(|f|json!({"path":&f.path,"maxFileSize":f.max_file_size.to_string(),"minFileSize":f.min_file_size.to_string(),"extensionFilterMode":f.extension_filter_mode,"extensions":f.extensions,"enabled":f.enabled})).collect::<Vec<_>>()})) }
            "PrefetchFileRanges" => { let req=gen::PrefetchFileRangesRequest{path:s(&p,"path"),ranges:vec![],priority:0,hint_id:u(&p,"hint_id",0),ttl_seconds:u32v(&p,"ttl_seconds",0),replace_existing:b(&p,"replace_existing",false)};
                let i=c.prefetch_file_ranges(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"hint_id":i.hint_id,"accepted_range_count":i.accepted_range_count,"rejected_range_count":i.rejected_range_count})) }
            "CancelFilePrefetch" => { let req=gen::CancelFilePrefetchRequest{path:s(&p,"path"),hint_ids:p.get("hintIds").and_then(|v|v.as_array()).map(|a|a.iter().filter_map(|v|v.as_u64()).collect()).unwrap_or_default()};
                c.cancel_file_prefetch(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetActivePrefetchHints" => { let i=c.get_active_prefetch_hints(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"hints":i.hints.iter().map(|h|json!({"path":&h.path,"hint_id":h.hint_id,"priority":h.priority,"total_bytes":h.total_bytes.to_string()})).collect::<Vec<_>>()})) }

            // ===== 2FA =====
            "Setup2FA" => { let req=gen::Setup2FaRequest{password:s(&p,"password")}; let r=c.setup2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"secret":&r.secret,"qr_code":&r.qr_code,"manual_entry_key":&r.manual_entry_key})) }
            "Enable2FA" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let r=c.enable2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"recovery_codes":r.recovery_codes,"message":&r.message})) }
            "Disable2FA" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; c.disable2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "Check2FAStatus" => { let i=c.check2_fa_status(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"two_factor_enabled":i.two_factor_enabled})) }
            "GetRecoveryCodes" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let r=c.get_recovery_codes(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"recovery_codes":r.recovery_codes,"total":r.total,"message":&r.message})) }
            "RegenerateRecoveryCodes" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let r=c.regenerate_recovery_codes(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"recovery_codes":r.recovery_codes,"total":r.total,"message":&r.message})) }
            "UnbindDevice" => { let req=gen::UnbindDeviceRequest{password:s(&p,"password"),totp_code:opt_s(&p,"totpCode")}; c.unbind_device(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "SendDisable2FAEmail" => { let req=gen::SendDisable2FaEmailRequest{email:s(&p,"email"),cloudfs_proxy:None}; c.send_disable2_fa_email(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "Disable2FAByEmail" => { let req=gen::Disable2FaByEmailRequest{disable_code:s(&p,"disableCode"),password:s(&p,"password"),cloudfs_proxy:None}; c.disable2_fa_by_email(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Sessions =====
            "GetSessions" => { let i=c.get_sessions(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"sessions":i.sessions.iter().map(session_to_json).collect::<Vec<_>>()})) }
            "RevokeSession" => { let req=gen::RevokeSessionRequest{session_id:s(&p,"sessionId")}; c.revoke_session(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RevokeOtherSessions" => { c.revoke_other_sessions(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Backup =====
            "BackupGetAll" => { let i=c.backup_get_all(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"backups":i.backups.iter().map(backup_status_to_json).collect::<Vec<_>>()})) }
            "BackupGetStatus" => { let sv=gen::StringValue{value:s(&p,"sourcePath")}; let i=c.backup_get_status(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(backup_status_to_json(&i)) }
            "BackupAdd" => {
                let backup=gen::Backup{source_path:s(&p,"sourcePath"),destinations:p.get("destinations").and_then(|v|v.as_array()).map(|a|a.iter().map(|d|gen::BackupDestination{destination_path:d.get("destinationPath").and_then(|v|v.as_str()).unwrap_or("").to_string(),is_enabled:d.get("isEnabled").and_then(|v|v.as_bool()).unwrap_or(true),last_finish_time:None}).collect()).unwrap_or_default(),file_backup_rules:vec![],file_replace_rule:0,file_delete_rule:0,file_completion_rule:0,is_enabled:b(&p,"isEnabled",true),file_system_watch_enabled:b(&p,"fileSystemWatchEnabled",false),walking_through_interval_secs:p.get("walkingThroughIntervalSecs").and_then(|v|v.as_i64()).unwrap_or(0),force_walking_through_on_start:false,time_schedules:vec![],is_time_schedules_enabled:false,sync_delete_from_dest:false,dont_start_scan_after_add:None};
                c.backup_add(mk_req(backup,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupUpdate" => {
                let backup=gen::Backup{source_path:s(&p,"sourcePath"),destinations:p.get("destinations").and_then(|v|v.as_array()).map(|a|a.iter().map(|d|gen::BackupDestination{destination_path:d.get("destinationPath").and_then(|v|v.as_str()).unwrap_or("").to_string(),is_enabled:d.get("isEnabled").and_then(|v|v.as_bool()).unwrap_or(true),last_finish_time:None}).collect()).unwrap_or_default(),file_backup_rules:vec![],file_replace_rule:0,file_delete_rule:0,file_completion_rule:0,is_enabled:b(&p,"isEnabled",true),file_system_watch_enabled:b(&p,"fileSystemWatchEnabled",false),walking_through_interval_secs:p.get("walkingThroughIntervalSecs").and_then(|v|v.as_i64()).unwrap_or(0),force_walking_through_on_start:false,time_schedules:vec![],is_time_schedules_enabled:false,sync_delete_from_dest:false,dont_start_scan_after_add:None};
                c.backup_update(mk_req(backup,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupRemove" => { let sv=gen::StringValue{value:s(&p,"sourcePath")}; c.backup_remove(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupSetEnabled" => { let req=gen::BackupSetEnabledRequest{source_path:s(&p,"sourcePath"),is_enabled:b(&p,"isEnabled",false)}; c.backup_set_enabled(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupRestartWalkingThrough" => { let sv=gen::StringValue{value:s(&p,"sourcePath")}; c.backup_restart_walking_through(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CanAddMoreBackups" => { let i=c.can_add_more_backups(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "BackupAddDestination" => { let req=gen::BackupModifyRequest{source_path:s(&p,"sourcePath"),destinations:p.get("destinations").and_then(|v|v.as_array()).map(|a|a.iter().map(|d|gen::BackupDestination{destination_path:d.get("destinationPath").and_then(|v|v.as_str()).unwrap_or("").to_string(),is_enabled:d.get("isEnabled").and_then(|v|v.as_bool()).unwrap_or(true),last_finish_time:None}).collect()).unwrap_or_default(),file_backup_rules:vec![],file_replace_rule:None,file_delete_rule:None,file_system_watch_enabled:None,walking_through_interval_secs:None};
                c.backup_add_destination(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupRemoveDestination" => { let req=gen::BackupModifyRequest{source_path:s(&p,"sourcePath"),destinations:p.get("destinations").and_then(|v|v.as_array()).map(|a|a.iter().map(|d|gen::BackupDestination{destination_path:d.get("destinationPath").and_then(|v|v.as_str()).unwrap_or("").to_string(),is_enabled:d.get("isEnabled").and_then(|v|v.as_bool()).unwrap_or(true),last_finish_time:None}).collect()).unwrap_or_default(),file_backup_rules:vec![],file_replace_rule:None,file_delete_rule:None,file_system_watch_enabled:None,walking_through_interval_secs:None};
                c.backup_remove_destination(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupSetFileSystemWatchEnabled" => { let req=gen::BackupModifyRequest{source_path:s(&p,"sourcePath"),destinations:vec![],file_backup_rules:vec![],file_replace_rule:None,file_delete_rule:None,file_system_watch_enabled:opt_b(&p,"fileSystemWatchEnabled"),walking_through_interval_secs:None};
                c.backup_set_file_system_watch_enabled(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupUpdateStrategies" => { let req=gen::BackupModifyRequest{source_path:s(&p,"sourcePath"),destinations:vec![],file_backup_rules:vec![],file_replace_rule:opt_i32(&p,"fileReplaceRule"),file_delete_rule:opt_i32(&p,"fileDeleteRule"),file_system_watch_enabled:None,walking_through_interval_secs:None};
                c.backup_update_strategies(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Webhooks =====
            "AddWebhookConfig" => { let req=gen::WebhookRequest{file_name:s(&p,"fileName"),content:s(&p,"content")}; c.add_webhook_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveWebhookConfig" => { let sv=gen::StringValue{value:s(&p,"fileName")}; c.remove_webhook_config(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ChangeWebhookConfig" => { let req=gen::WebhookRequest{file_name:s(&p,"fileName"),content:s(&p,"content")}; c.change_webhook_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetWebhookConfigTemplate" => { let r=c.get_webhook_config_template(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }
            "GetWebhookConfigs" => { let i=c.get_webhook_configs(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"webhooks":i.webhooks.iter().map(webhook_to_json).collect::<Vec<_>>()})) }

            // ===== DAV =====
            "GetDavServerConfig" => { let i=c.get_dav_server_config(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"davServerEnabled":i.dav_server_enabled,"davServerPath":&i.dav_server_path,"enableClouddriveAccount":i.enable_clouddrive_account,"clouddriveAccountRootPath":&i.clouddrive_account_root_path,"clouddriveAccountReadOnly":i.clouddrive_account_read_only,"enableAnonymousAccess":i.enable_anonymous_access,"anonymousRootPath":&i.anonymous_root_path,"anonymousReadOnly":i.anonymous_read_only,"users":i.users.iter().map(dav_user_to_json).collect::<Vec<_>>(),"enableAccessLog":i.enable_access_log})) }
            "SetDavServerConfig" => { let req=gen::ModifyDavServerConfigRequest{enable_dav_server:opt_b(&p,"enableDavServer"),enable_clouddrive_account:opt_b(&p,"enableClouddriveAccount"),clouddrive_account_root_path:opt_s(&p,"clouddriveAccountRootPath"),clouddrive_account_read_only:opt_b(&p,"clouddriveAccountReadOnly"),enable_anonymous_access:opt_b(&p,"enableAnonymousAccess"),anonymous_root_path:opt_s(&p,"anonymousRootPath"),anonymous_read_only:opt_b(&p,"anonymousReadOnly"),enable_access_log:opt_b(&p,"enableAccessLog")};
                c.set_dav_server_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "AddDavUser" => { let req=gen::AddDavUserRequest{user_name:s(&p,"userName"),password:s(&p,"password"),root_path:opt_s(&p,"rootPath"),read_only:opt_b(&p,"readOnly"),enabled:opt_b(&p,"enabled"),guest:opt_b(&p,"guest")}; c.add_dav_user(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ModifyDavUser" => { let req=gen::ModifyDavUserRequest{user_name:s(&p,"userName"),password:opt_s(&p,"password"),root_path:opt_s(&p,"rootPath"),read_only:opt_b(&p,"readOnly"),enabled:opt_b(&p,"enabled"),guest:opt_b(&p,"guest")}; c.modify_dav_user(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveDavUser" => { let sv=gen::StringValue{value:s(&p,"userName")}; c.remove_dav_user(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetDavUser" => { let sv=gen::StringValue{value:s(&p,"userName")}; let _=c.get_dav_user(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Token Management =====
            "CreateToken" => { let req=gen::CreateTokenRequest{root_dir:s(&p,"rootDir"),permissions:Some(gen::TokenPermissions::default()),friendly_name:s(&p,"friendly_name"),expires_in:opt_u(&p,"expires_in"),enable_grpc_log:opt_b(&p,"enableGrpcLog"),enable_stream_file_log:opt_b(&p,"enableStreamFileLog")};
                let i=c.create_token(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(token_info_to_json(&i)) }
            "ModifyToken" => { let req=gen::ModifyTokenRequest{token:s(&p,"token"),root_dir:opt_s(&p,"rootDir"),permissions:None,friendly_name:opt_s(&p,"friendly_name"),expires_in:opt_u(&p,"expires_in"),enable_grpc_log:opt_b(&p,"enableGrpcLog"),enable_stream_file_log:opt_b(&p,"enableStreamFileLog")};
                let i=c.modify_token(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(token_info_to_json(&i)) }
            "RemoveToken" => { let sv=gen::StringValue{value:s(&p,"token")}; c.remove_token(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ListTokens" => { let i=c.list_tokens(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"tokens":i.tokens.iter().map(token_info_to_json).collect::<Vec<_>>()})) }
            "GetApiTokenInfo" => { let sv=gen::StringValue{value:s(&p,"token")}; let i=c.get_api_token_info(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(token_info_to_json(&i)) }

            // ===== Web Server =====
            "GetWebServerConfig" => { let i=c.get_web_server_config(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"http_port":i.http_port,"https_port":i.https_port,"cert_file":os(&i.cert_file),"key_file":os(&i.key_file),"enable_https":i.enable_https})) }
            "SetWebServerConfig" => { let req=gen::SetWebServerConfigRequest{http_port:opt_u32(&p,"http_port"),https_port:opt_u32(&p,"https_port"),cert_file:opt_s(&p,"cert_file"),key_file:opt_s(&p,"key_file"),enable_https:opt_b(&p,"enable_https"),cert_content:opt_s(&p,"cert_content"),key_content:opt_s(&p,"key_content")};
                c.set_web_server_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GenerateSelfSignedCert" => { let req=gen::GenerateSelfSignedCertRequest{restart_servers:b(&p,"restartServers",true)}; c.generate_self_signed_cert(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Sync =====
            "StartCloudEventListener" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.start_cloud_event_listener(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "StopCloudEventListener" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.stop_cloud_event_listener(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "SyncFileChangesFromCloud" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.sync_file_changes_from_cloud(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Misc =====
            "KickoutDevice" => { let req=gen::DeviceRequest{device_id:s(&p,"deviceId")}; c.kickout_device(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetMachineId" => { let r=c.get_machine_id(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }
            "GetReferralCode" => { let r=c.get_referral_code(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"value":r.into_inner().value})) }
            "GetCloudDrive1UserData" => { let r=c.get_cloud_drive1_user_data(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }
            "SendConfirmEmail" => { c.send_confirm_email(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CheckActivationCode" => { let sv=gen::StringValue{value:s(&p,"code")}; let _=c.check_activation_code(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ActivatePlan" => { let sv=gen::StringValue{value:s(&p,"code")}; let _=c.activate_plan(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetOnlineDevices" => { let i=c.get_online_devices(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"devices":i.devices.iter().map(|d|json!({"deviceId":&d.device_id,"deviceName":&d.device_name,"osType":&d.os_type,"version":&d.version,"ipAddress":&d.ip_address})).collect::<Vec<_>>()})) }
            "ListLogFiles" => { let i=c.list_log_files(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"logFiles":i.log_files.iter().map(log_file_to_json).collect::<Vec<_>>()})) }

            // ===== Promotions & Plans =====
            "GetPromotions" => { let i=c.get_promotions(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"promotions":i.promotions.iter().map(|p|json!({"id":&p.id,"cloudName":&p.cloud_name,"title":&p.title,"subTitle":os(&p.sub_title),"rules":&p.rules,"url":&p.url})).collect::<Vec<_>>()})) }
            "GetPromotionsByCloud" => { let req=gen::CloudApiRequest{cloud_name:s(&p,"cloudName"),user_name:opt_s(&p,"userName")}; let i=c.get_promotions_by_cloud(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"promotions":i.promotions.iter().map(|p|json!({"id":&p.id,"cloudName":&p.cloud_name,"title":&p.title,"url":&p.url})).collect::<Vec<_>>()})) }
            "GetCloudDrivePlans" => { let i=c.get_cloud_drive_plans(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"plans":i.plans.iter().map(|p|json!({"id":&p.id,"name":&p.name,"description":&p.description,"price":p.price,"durationDescription":&p.duration_description,"isActive":p.is_active})).collect::<Vec<_>>()})) }
            "JoinPlan" => { let req=gen::JoinPlanRequest{plan_id:s(&p,"planId"),coupon_code:opt_s(&p,"couponCode")}; let i=c.join_plan(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"success":i.success,"balance":i.balance,"planName":&i.plan_name,"planDescription":&i.plan_description})) }
            "GetBalanceLog" => { let i=c.get_balance_log(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"logs":i.logs.iter().map(|l|json!({"balance_before":l.balance_before,"balance_after":l.balance_after,"balance_change":l.balance_change,"operation_source":&l.operation_source,"operation_id":&l.operation_id})).collect::<Vec<_>>()})) }

            // ===== Cloud Login =====
            "APILogin115Editthiscookie" => { let req=gen::Login115EditthiscookieRequest{edit_thiscookie_string:s(&p,"editThiscookieString")}; let _=c.api_login115_editthiscookie(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APIAddLocalFolder" => { let req=gen::AddLocalFolderRequest{local_folder_path:s(&p,"localFolderPath")}; let _=c.api_add_local_folder(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILogin115OpenOAuth" => { let req=gen::Login115OpenOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login115_open_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginAliyundriveOAuth" => { let req=gen::LoginAliyundriveOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login_aliyundrive_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginAliyundriveRefreshtoken" => { let req=gen::LoginAliyundriveRefreshtokenRequest{refresh_token:s(&p,"refreshToken"),use_open_api:b(&p,"useOpenAPI",false)}; let _=c.api_login_aliyundrive_refreshtoken(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginBaiduPanOAuth" => { let req=gen::LoginBaiduPanOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login_baidu_pan_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginOneDriveOAuth" => { let req=gen::LoginOneDriveOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login_one_drive_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ApiLoginGoogleDriveOAuth" => { let req=gen::LoginGoogleDriveOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login_google_drive_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ApiLoginGoogleDriveRefreshToken" => { let req=gen::LoginGoogleDriveRefreshTokenRequest{client_id:s(&p,"client_id"),client_secret:s(&p,"client_secret"),refresh_token:s(&p,"refresh_token"),api_proxy:None,data_proxy:None}; let _=c.api_login_google_drive_refresh_token(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ApiLoginXunleiOAuth" => { let req=gen::LoginXunleiOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login_xunlei_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ApiLoginXunleiOpenOAuth" => { let req=gen::LoginXunleiOpenOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login_xunlei_open_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ApiLogin123panOAuth" => { let req=gen::Login123panOAuthRequest{refresh_token:s(&p,"refresh_token"),access_token:s(&p,"access_token"),expires_in:u(&p,"expires_in",0),api_proxy:None,data_proxy:None}; let _=c.api_login123pan_o_auth(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginWebDav" => { let req=gen::LoginWebDavRequest{server_url:s(&p,"serverUrl"),user_name:s(&p,"userName"),password:s(&p,"password"),do_not_sync_to_cloud:b(&p,"doNotSyncToCloud",false),api_proxy:None,data_proxy:None}; let _=c.api_login_web_dav(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginS3" => { let req=gen::LoginS3Request{access_key_id:s(&p,"accessKeyId"),secret_access_key:s(&p,"secretAccessKey"),region:s(&p,"region"),bucket:s(&p,"bucket"),endpoint:opt_s(&p,"endpoint"),path_style:b(&p,"pathStyle",false),do_not_sync_to_cloud:b(&p,"doNotSyncToCloud",false),signature_version:opt_u32(&p,"signatureVersion"),api_proxy:None,data_proxy:None}; let _=c.api_login_s3(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginCloudDrive" => { let req=gen::LoginCloudDriveRequest{grpc_url:s(&p,"grpcUrl"),token:s(&p,"token"),insecure_tls:b(&p,"insecureTls",false),do_not_sync_to_cloud:b(&p,"doNotSyncToCloud",false),api_proxy:None,data_proxy:None}; let _=c.api_login_cloud_drive(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginSftp" => { let req=gen::LoginSftpRequest{host:s(&p,"host"),port:u32v(&p,"port",22),user_name:s(&p,"userName"),password:s(&p,"password"),private_key:opt_s(&p,"privateKey"),passphrase:opt_s(&p,"passphrase"),root_path:opt_s(&p,"rootPath"),do_not_sync_to_cloud:b(&p,"doNotSyncToCloud",false),api_proxy:None,data_proxy:None}; let _=c.api_login_sftp(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginFtp" => { let req=gen::LoginFtpRequest{host:s(&p,"host"),port:u32v(&p,"port",21),user_name:s(&p,"userName"),password:s(&p,"password"),use_tls:b(&p,"useTls",false),root_path:opt_s(&p,"rootPath"),do_not_sync_to_cloud:b(&p,"doNotSyncToCloud",false),api_proxy:None,data_proxy:None}; let _=c.api_login_ftp(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APILoginSmb" => { let req=gen::LoginSmbRequest{server:s(&p,"server"),share:s(&p,"share"),port:u32v(&p,"port",445),user_name:s(&p,"userName"),password:s(&p,"password"),workgroup:opt_s(&p,"workgroup"),root_path:opt_s(&p,"rootPath"),do_not_sync_to_cloud:b(&p,"doNotSyncToCloud",false),api_proxy:None,data_proxy:None}; let _=c.api_login_smb(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "DiscoverSmbServers" => { let i=c.discover_smb_servers(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"servers":i.servers.iter().map(|s|json!({"name":&s.name,"address":&s.address})).collect::<Vec<_>>()})) }
            "DiscoverSmbShares" => { let req=gen::DiscoverSmbSharesRequest{server:s(&p,"server"),port:u32v(&p,"port",445),user_name:s(&p,"userName"),password:s(&p,"password"),workgroup:opt_s(&p,"workgroup")}; let i=c.discover_smb_shares(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"shareNames":i.share_names})) }
            "CreateOAuthState" => { let req=gen::CreateOAuthStateRequest{oauth_type:s(&p,"oauth_type"),return_url:s(&p,"return_url"),device_id:opt_s(&p,"device_id"),code_verifier:opt_s(&p,"code_verifier")}; let i=c.create_o_auth_state(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"success":i.success,"error_message":i.error_message,"state":i.state,"expires_in":i.expires_in})) }

            // ===== Remaining stubs for rare/complex methods =====
            "ConfirmEmail"|"SendResetAccountEmail"|"ResetAccount"|"ChangeEmail"|"SendChangeEmailCode"|
            "TransferBalance"|"BindCloudAccount"|"CheckCouponCode"|"GetStorePurchaseQuote"|"VerifyStorePurchase"|
            "UpdatePromotionResult"|"UpdatePromotionResultByCloud"|"SendPromotionAction"|
            "CreateFile"|"CloseFile"|"WriteToFile"|"StartRemoteUpload"|"RemoteUploadControl"|"RemoteReadData"|"RemoteHashProgress"|
            "NotifyPhotoLibraryChanges"|"PushTaskChange"|"PushMessage"|"TestUpdate" => {
                Err(format!("方法 {} 暂不支持，请使用 Web 界面操作", method))
            }

            _ => Err(format!("未知方法: {}", method)),
        }
    }
}

fn opt_i32(v: &Value, key: &str) -> Option<i32> { v.get(key).and_then(|v| v.as_i64()).map(|n| n as i32) }
fn opt_f64(v: &Value, key: &str) -> Option<f64> { v.get(key).and_then(|v| v.as_f64()) }
