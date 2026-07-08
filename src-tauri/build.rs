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
}
