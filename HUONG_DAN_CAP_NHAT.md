# Hướng Dẫn Phát Hành Bản Cập Nhật Mới (Auto-Updater)

Tài liệu này hướng dẫn cách build và phát hành một bản cập nhật mới cho hệ thống WorkHub để các máy client tự động nhận thông báo và tải về.

> [!IMPORTANT]
> Bạn bắt buộc phải có file `workhub.key` (Private Key) và mật khẩu của nó để thực hiện việc này. Không chia sẻ file key này ra ngoài.

## Các Bước Thực Hiện

### Bước 1: Tăng số phiên bản
Mở file `src-tauri/tauri.conf.json`, tìm thuộc tính `"version"` và sửa thành số phiên bản mới.
Ví dụ: nếu bản cũ đang là `"0.1.0"`, hãy đổi thành `"0.1.1"`.
*(Lưu ý: Số phiên bản mới bắt buộc phải lớn hơn số phiên bản đang chạy trên máy khách).*

### Bước 2: Khai báo biến môi trường (Chứa Private Key)
Để Tauri có thể dùng Private Key để "ký" (sign) bản cài đặt, bạn cần truyền đường dẫn tới file key và mật khẩu vào biến môi trường của Terminal trước khi build.

Mở Terminal (khuyên dùng PowerShell) tại thư mục gốc của dự án và chạy 2 lệnh sau:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY="ĐƯỜNG_DẪN_TỚI_FILE_KEY_CỦA_BẠN"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="MẬT_KHẨU_BẠN_ĐÃ_ĐẶT"
```
*(Thay thế `ĐƯỜNG_DẪN_TỚI_FILE_KEY_CỦA_BẠN` thành đường dẫn thực tế trên máy bạn, ví dụ: `D:\Projects\Keys\workhub.key` hoặc `./workhub.key` nếu file nằm ngay trong thư mục code).*

### Bước 3: Build bản cài đặt
Sau khi gán biến môi trường thành công, tiến hành chạy lệnh build như bình thường:

```powershell
npm run tauri build
```
Quá trình build sẽ mất một lúc. Sau khi xong, hãy vào thư mục `src-tauri/target/release/bundle/`. 
Tauri sẽ tạo ra các file cài đặt (như `.exe`, `.msi`) và đặc biệt là sinh thêm file **`latest.json`** (File này chứa thông tin phiên bản và chữ ký bảo mật).

### Bước 4: Upload lên GitHub Releases
1. Truy cập vào trang quản lý Release của Repository: [GitHub Releases](https://github.com/MtamVP/WorkHub-ORG/releases)
2. Bấm nút **"Draft a new release"**.
3. Tại ô **Choose a tag**, hãy điền đúng số phiên bản vừa build (Ví dụ: `v0.1.1`).
4. Ở phần đính kèm file (Attach binaries by dropping them here), **bạn cần upload TẤT CẢ các file sau**:
   - File bộ cài đặt (ví dụ: `WorkHub-ORG_0.1.1_x64-setup.exe` hoặc `.msi`).
   - File chữ ký đính kèm (có đuôi là `.sig` hoặc `.zip.sig`).
   - **Đặc biệt quan trọng:** Upload luôn file **`latest.json`**.
5. Điền tiêu đề và mô tả những thay đổi mới của bản cập nhật.
6. Bấm **Publish release**.

**Hoàn tất!**
Ngay sau khi release được publish, những người dùng đang mở app phiên bản cũ sẽ lập tức nhận được thông báo cập nhật trên màn hình.
