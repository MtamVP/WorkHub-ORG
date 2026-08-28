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
$env:TAURI_SIGNING_PRIVATE_KEY_PATH="ĐƯỜNG_DẪN_TỚI_FILE_KEY_CỦA_BẠN"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="MẬT_KHẨU_BẠN_ĐÃ_ĐẶT"
```
*(Thay thế `ĐƯỜNG_DẪN_TỚI_FILE_KEY_CỦA_BẠN` thành đường dẫn thực tế trên máy bạn, ví dụ: `D:\Projects\Keys\workhub.key` hoặc `./workhub.key` nếu file nằm ngay trong thư mục code).*

### Bước 3: Build bản cài đặt
Sau khi gán biến môi trường thành công, tiến hành chạy lệnh build như bình thường:

```powershell
npx tauri build
```
Quá trình build sẽ mất một lúc. Sau khi xong, hãy vào thư mục `src-tauri/target/release/bundle/nsis/` (hoặc `msi`). Tại đây sẽ có file cài đặt (như `.exe`) và file chữ ký (như `.sig`).

*(Lưu ý: Nếu dùng Tauri v2 mà trình build không tự sinh ra file `latest.json`, bạn có thể tự tạo file này bằng tay).*

### Bước 4: Cập nhật file `latest.json` (Nếu tự tạo bằng tay)
Tạo (hoặc sửa) một file tên là `latest.json` với nội dung như sau:
```json
{
  "version": "v0.1.2",
  "notes": "Ghi chú những tính năng mới ở đây",
  "pub_date": "2026-09-01T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "MỞ_FILE_.SIG_BẰNG_NOTEPAD_VÀ_COPY_TOÀN_BỘ_NỘI_DUNG_DÁN_VÀO_ĐÂY",
      "url": "https://github.com/MtamVP/WorkHub-ORG/releases/download/v0.1.2/WorkHub-ORG_0.1.2_x64-setup.exe"
    }
  }
}
```
**Khi ra bản mới, bạn chỉ cần sửa 3 chỗ:**
1. `"version"`: Thay bằng số phiên bản mới (phải khớp với tag trên GitHub).
2. `"signature"`: Mở file `.sig` bản mới nhất ra, copy toàn bộ chữ rồi dán đè vào đây.
3. `"url"`: Thay số phiên bản trong đường link tải (chỗ `v0.1.2` và tên file `.exe`).

### Bước 5: Upload lên GitHub Releases
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
