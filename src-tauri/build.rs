fn main() {
    // Use vendored protoc so users don't need to install it separately
    let protoc_path = protoc_bin_vendored::protoc_bin_path().unwrap();
    std::env::set_var("PROTOC", protoc_path);

    tonic_build::configure()
        .build_server(false)
        .build_client(true)
        .compile_protos(&["../clouddrive.proto"], &[".."])
        .expect("Failed to compile protos");

    println!("cargo:rerun-if-changed=../clouddrive.proto");

    // Embed Windows manifest to enable Common Controls v6 (fixes TaskDialogIndirect error)
    #[cfg(target_os = "windows")]
    {
        let mut res = winres::WindowsResource::new();
        res.set_manifest(include_str!("app.manifest"));
        if let Err(e) = res.compile() {
            eprintln!("Warning: failed to compile Windows resource: {}", e);
        }
        println!("cargo:rerun-if-changed=app.manifest");
    }
}
