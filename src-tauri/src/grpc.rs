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

fn str_arr(v: &Value, key: &str) -> Vec<String> {
    v.get(key).and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_str().map(String::from)).collect()).unwrap_or_default()
}
fn s(v: &Value, key: &str) -> String { v.get(key).and_then(|v| v.as_str()).unwrap_or("").to_string() }
fn b(v: &Value, key: &str, d: bool) -> bool { v.get(key).and_then(|v| v.as_bool()).unwrap_or(d) }
fn u(v: &Value, key: &str, d: u64) -> u64 { v.get(key).and_then(|v| v.as_u64()).unwrap_or(d) }
fn opt_s(v: &Value, key: &str) -> Option<String> { v.get(key).and_then(|v| v.as_str()).map(String::from) }

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
                Ok(json!({"userName":i.user_name,"emailConfirmed":i.email_confirmed,"accountBalance":i.account_balance})) }
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
            "ListAllOfflineFiles" => { let req=gen::OfflineFileListAllRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),page:u(&p,"page",1) as u32,path:opt_s(&p,"path")};
                let i=c.list_all_offline_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner();
                let st=i.status.map(|_s|json!({})).unwrap_or(json!({}));
                Ok(json!({"offlineFiles":i.offline_files.iter().map(offline_file_to_json).collect::<Vec<_>>(),"status":st})) }
            "GetOfflineQuotaInfo" => { let req=gen::OfflineQuotaRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),path:opt_s(&p,"path")};
                let _i=c.get_offline_quota_info(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ClearOfflineFiles" => { let req=gen::ClearOfflineFileRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),filter:match s(&p,"filter").as_str(){"Completed"=>1,"Failed"=>2,"All"=>0,_=>0},delete_files:b(&p,"deleteFiles",false),path:opt_s(&p,"path")};
                let _=c.clear_offline_files(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RestartOfflineTask" => { let req=gen::RestartOfflineFileRequest{cloud_name:s(&p,"cloudName"),cloud_account_id:s(&p,"cloudAccountId"),info_hash:s(&p,"infoHash"),url:s(&p,"url"),parent_id:s(&p,"parentId"),path:opt_s(&p,"path")};
                let _=c.restart_offline_task(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "AddSharedLink" => { let req=gen::AddSharedLinkRequest{shared_link_url:s(&p,"sharedLinkUrl"),shared_password:opt_s(&p,"sharedPassword"),to_folder:s(&p,"toFolder")}; c.add_shared_link(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Cloud APIs =====
            "CanAddMoreCloudApis" => { let i=c.can_add_more_cloud_apis(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "GetAllCloudApis" => { let i=c.get_all_cloud_apis(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"apis":i.apis.iter().map(cloud_api_to_json).collect::<Vec<_>>()})) }
            "RemoveCloudAPI" => { let req=gen::RemoveCloudApiRequest{cloud_name:s(&p,"cloudName"),user_name:s(&p,"userName"),permanent_remove:b(&p,"permanentRemove",false)};
                let i=c.remove_cloud_api(mk_req(req,&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }

            // ===== Tasks =====
            "GetAllTasksCount" => { let i=c.get_all_tasks_count(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner();
                Ok(json!({"uploadTaskCount":i.upload_count,"downloadTaskCount":i.download_count,"copyTaskCount":i.copy_task_count})) }
            "GetDownloadFileCount" => { let i=c.get_download_file_count(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"count":i.file_count})) }
            "GetUploadFileCount" => { let i=c.get_upload_file_count(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"count":i.file_count})) }
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

            // ===== Mount =====
            "CanAddMoreMountPoints" => { let i=c.can_add_more_mount_points(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }
            "LocalCreateFolder" => { let req=gen::LocalCreateFolderRequest{parent_folder:s(&p,"parentFolder"),folder_name:s(&p,"folderName")}; let _=c.local_create_folder(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Disk Cache =====
            "PurgeFileBufferDiskCache" => { c.purge_file_buffer_disk_cache(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== 2FA =====
            "Setup2FA" => { let req=gen::Setup2FaRequest{password:s(&p,"password")}; let _=c.setup2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "Enable2FA" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let _=c.enable2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "Disable2FA" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let _=c.disable2_fa(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetRecoveryCodes" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let _=c.get_recovery_codes(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RegenerateRecoveryCodes" => { let req=gen::TwoFactorAuthCodeRequest{totp_code:s(&p,"totpCode")}; let _=c.regenerate_recovery_codes(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Sessions =====
            "RevokeSession" => { let req=gen::RevokeSessionRequest{session_id:s(&p,"sessionId")}; c.revoke_session(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RevokeOtherSessions" => { c.revoke_other_sessions(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Backup =====
            "BackupRemove" => { let sv=gen::StringValue{value:s(&p,"sourcePath")}; c.backup_remove(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupSetEnabled" => { let req=gen::BackupSetEnabledRequest{source_path:s(&p,"sourcePath"),is_enabled:b(&p,"isEnabled",false)}; c.backup_set_enabled(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "BackupRestartWalkingThrough" => { let sv=gen::StringValue{value:s(&p,"sourcePath")}; c.backup_restart_walking_through(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CanAddMoreBackups" => { let i=c.can_add_more_backups(mk_req((),&token)).await.map_err(|e|ferr(&e))?.into_inner(); Ok(json!({"success":i.success,"errorMessage":i.error_message})) }

            // ===== Webhooks =====
            "AddWebhookConfig" => { let req=gen::WebhookRequest{file_name:s(&p,"fileName"),content:s(&p,"content")}; c.add_webhook_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "RemoveWebhookConfig" => { let sv=gen::StringValue{value:s(&p,"fileName")}; c.remove_webhook_config(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ChangeWebhookConfig" => { let req=gen::WebhookRequest{file_name:s(&p,"fileName"),content:s(&p,"content")}; c.change_webhook_config(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetWebhookConfigTemplate" => { let r=c.get_webhook_config_template(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }

            // ===== DAV =====
            "RemoveDavUser" => { let sv=gen::StringValue{value:s(&p,"userName")}; c.remove_dav_user(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetDavUser" => { let sv=gen::StringValue{value:s(&p,"userName")}; let _=c.get_dav_user(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Token Management =====
            "RemoveToken" => { let sv=gen::StringValue{value:s(&p,"token")}; c.remove_token(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Web Server =====
            "GenerateSelfSignedCert" => { let req=gen::GenerateSelfSignedCertRequest{restart_servers:b(&p,"restartServers",true)}; c.generate_self_signed_cert(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Sync =====
            "StartCloudEventListener" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.start_cloud_event_listener(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "StopCloudEventListener" => { let req=gen::FileRequest{path:s(&p,"path"),force_refresh:None}; c.stop_cloud_event_listener(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Misc =====
            "KickoutDevice" => { let req=gen::DeviceRequest{device_id:s(&p,"deviceId")}; c.kickout_device(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "GetMachineId" => { let r=c.get_machine_id(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }
            "GetReferralCode" => { let r=c.get_referral_code(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"value":r.into_inner().value})) }
            "GetCloudDrive1UserData" => { let r=c.get_cloud_drive1_user_data(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({"result":r.into_inner().result})) }
            "SendConfirmEmail" => { c.send_confirm_email(mk_req((),&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "CheckActivationCode" => { let sv=gen::StringValue{value:s(&p,"code")}; let _=c.check_activation_code(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "ActivatePlan" => { let sv=gen::StringValue{value:s(&p,"code")}; let _=c.activate_plan(mk_req(sv,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Cloud Login =====
            "APILogin115Editthiscookie" => { let req=gen::Login115EditthiscookieRequest{edit_thiscookie_string:s(&p,"editThiscookieString")}; let _=c.api_login115_editthiscookie(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }
            "APIAddLocalFolder" => { let req=gen::AddLocalFolderRequest{local_folder_path:s(&p,"localFolderPath")}; let _=c.api_add_local_folder(mk_req(req,&token)).await.map_err(|e|ferr(&e))?; Ok(json!({})) }

            // ===== Generic fallbacks for methods not yet fully implemented =====
            // These return empty JSON - frontend handles gracefully
            "GetSystemSettings"|"GetUploadFileList"|"GetDownloadFileList"|"GetCopyTasks"|"GetMergeTasks"|"GetOpenFileHandles"|
            "GetMountPoints"|"GetCloudAPIConfig"|"SetCloudAPIConfig"|"GetDavServerConfig"|"SetDavServerConfig"|"AddDavUser"|"ModifyDavUser"|
            "CreateToken"|"ModifyToken"|"ListTokens"|"GetApiTokenInfo"|"GetWebServerConfig"|"SetWebServerConfig"|
            "GetSessions"|"BackupGetAll"|"BackupGetStatus"|"BackupAdd"|"BackupUpdate"|"GetWebhookConfigs"|
            "GetFileBufferDiskCacheStats"|"ListDiskCacheFolders"|"Check2FAStatus"|"GetPromotions"|"GetPromotionsByCloud"|
            "GetCloudDrivePlans"|"JoinPlan"|"GetBalanceLog"|"GetAvailableDriveLetters"|"HasDriveLetters"|"CanMountBothLocalAndCloud"|
            "AddMountPoint"|"RemoveMountPoint"|"Mount"|"Unmount"|"UpdateMountPoint"|"WalkThroughFolderTest"|"SyncFileChangesFromCloud"|
            "DiscoverSmbServers"|"DiscoverSmbShares"|"ListLogFiles"|"UnbindDevice"|"SendDisable2FAEmail"|"Disable2FAByEmail"|
            "APILogin115OpenOAuth"|"APILoginAliyundriveOAuth"|"APILoginAliyundriveRefreshtoken"|"APILoginBaiduPanOAuth"|
            "APILoginOneDriveOAuth"|"ApiLoginGoogleDriveOAuth"|"ApiLoginGoogleDriveRefreshToken"|"ApiLoginXunleiOAuth"|
            "ApiLoginXunleiOpenOAuth"|"ApiLogin123panOAuth"|"APILoginWebDav"|"APILoginS3"|"APILoginCloudDrive"|
            "APILoginSftp"|"APILoginFtp"|"APILoginSmb"|"CreateOAuthState"|
            "SetDiskCacheEvictionStrategy"|"SetFolderDiskCache"|"RemoveFolderDiskCache"|"PrefetchFileRanges"|"CancelFilePrefetch"|"GetActivePrefetchHints"|
            "SetDirCacheTimeSecs"|"GetEffectiveDirCacheTimeSecs"|"VacuumDirCache"|"GetVacuumProgress"|"GetDirCacheDbSize"|"GetOpenFileTable"|"GetDirCacheTable"|"GetReferencedEntryPaths"|"GetTempFileTable"|
            "CheckCouponCode"|"GetStorePurchaseQuote"|"VerifyStorePurchase"|"UpdatePromotionResult"|"UpdatePromotionResultByCloud"|"SendPromotionAction"|"BindCloudAccount"|"TransferBalance"|"SendChangeEmailCode"|"ChangeEmail"|
            "SendResetAccountEmail"|"ResetAccount"|"ConfirmEmail"|"GetPromotionsByCloud"|"CreateFile"|"CloseFile"|"WriteToFile"|"StartRemoteUpload"|"RemoteUploadControl"|"RemoteReadData"|"RemoteHashProgress"|
            "LocalGetSubFiles"|"SetDavServerConfig"|"BackupAddDestination"|"BackupRemoveDestination"|"BackupSetFileSystemWatchEnabled"|"BackupUpdateStrategies"|"NotifyPhotoLibraryChanges"|
            "RemoveFolderDiskCache"|"ForceExpireDirCache"|"GetDownloadUrlPath"|"GetOpenFileHandles"|"PushTaskChange"|"PushMessage"|"GetCloudDrive1UserData"|"TestUpdate"|"CreateOAuthState"|"SetCloudAPIConfig"|"GetCloudAPIConfig" => {
                Err(format!("方法 {} 暂未完全实现，请使用已实现的功能", method))
            }

            _ => Err(format!("未知方法: {}", method)),
        }
    }
}
