document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('fireworks-canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    // ==========================================
    // 1. CẤU HÌNH PHÁO HOA (TÙY CHỈNH TẠI ĐÂY)
    // ==========================================
    const colors = ['#ff0043', '#14fc56', '#1e7fff', '#e600ff', '#ffaa00', '#00ffff'];
    const members = ["Minh Tâm", "Đức Minh", "Huy Long", "Ronaldo", "Messi", "Trâm Uyên", "Anh Tuấn", "Kim Phúc", "Xuân Thành"];     
    const shapes = ["❤", "🐎", "★"]; 

    let shells = [];     // Chứa các viên pháo đang bay lên
    let particles = [];  // Chứa các hạt lửa đang nổ
    let waitTimer = 0;
    let lastTime = performance.now();

    // ==========================================
    // 2. THUẬT TOÁN QUÉT PIXEL (ĐÃ PHÓNG TO CHỮ & HÌNH)
    // ==========================================
    function getShapeVelocities(text) {
        const offCanvas = document.createElement('canvas');
        const offCtx = offCanvas.getContext('2d');
        offCanvas.width = 800; offCanvas.height = 800; // Tăng khung canvas ẩn để chứa chữ to hơn
        
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillStyle = 'white';
        
        // CÁCH CHỈNH ĐỘ TO CỦA CHỮ: Tăng fontSize lên
        const fontSize = text.length > 3 ? 120 : 220; 
        offCtx.font = `bold ${fontSize}px "Segoe UI", sans-serif`;
        offCtx.fillText(text, 400, 400);

        const imgData = offCtx.getImageData(0, 0, 800, 800).data;
        const velocities = [];
        
        for (let y = 0; y < 800; y += 5) {
            for (let x = 0; x < 800; x += 5) {
                const alpha = imgData[(y * 800 + x) * 4 + 3];
                if (alpha > 128) {
                    // CÁCH CHỈNH ĐỘ BUNG RỘNG CỦA HÌNH: 
                    // Chia cho số càng nhỏ (vd: 12) thì chữ bung ra càng bự!
                    const spread = text.length > 3 ? 14 : 10; 
                    const vx = (x - 400) / spread; 
                    const vy = (y - 400) / spread; 
                    velocities.push({ vx, vy });
                }
            }
        }
        return velocities;
    }

    // ==========================================
    // 3. LỚP VẬT LÝ (BAY LÊN & NỔ)
    // ==========================================
    class Shell {
        constructor(startX) {
            this.x = startX; 
            this.y = canvas.height;
            this.vx = (Math.random() - 0.5) * 2; // Bay lệch trái/phải một xíu
            
            // CÁCH CHỈNH CHIỀU CAO: Pháo sẽ nổ ở khoảng 40% -> 65% chiều cao màn hình. Không bao giờ bay lố ra khỏi viền trên!
            const targetHeight = canvas.height * (0.4 + Math.random() * 0.25);
            this.vy = -Math.sqrt(2 * 0.15 * targetHeight); 
            
            this.color = colors[Math.floor(Math.random() * colors.length)];
            
            // Random: 0 (Cổ điển 40%), 1 (Hình 30%), 2 (Chữ 30%)
            const rand = Math.random();
            if (rand < 0.4) this.type = 0;
            else if (rand < 0.7) this.type = 1;
            else this.type = 2;
            
            if (this.type === 1) this.textShape = shapes[Math.floor(Math.random() * shapes.length)];
            else if (this.type === 2) this.textShape = members[Math.floor(Math.random() * members.length)];
        }
        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.15; // Lực hút trái đất kéo pháo chậm dần
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
    }

    class Particle {
        constructor(x, y, vx, vy, color, isText = false) {
            this.x = x; this.y = y;
            this.vx = vx; this.vy = vy;
            this.color = color;
            this.alpha = 1;
            
            // CÁCH CHỈNH THỜI GIAN TỒN TẠI (~7 GIÂY):
            // Giảm decay cực nhỏ để hạt sống lâu hơn
            this.decay = Math.random() * 0.0015 + 0.001; 
            
            // Nếu là chữ/hình thì ma sát mạnh hơn (bung ra là dừng lại để giữ form chữ)
            this.friction = isText ? 0.92 : 0.96; 
            
            // Nếu là chữ/hình thì trọng lực cực nhỏ để nó lơ lửng trên không lâu hơn
            this.gravity = isText ? 0.005 : 0.02; 
        }
        update() {
            this.vx *= this.friction;
            this.vy *= this.friction;
            this.vy += this.gravity;
            this.x += this.vx;
            this.y += this.vy;
            this.alpha -= this.decay;
        }
        draw() {
            ctx.globalAlpha = this.alpha;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2.5, 0, Math.PI * 2); // Kích thước hạt lửa
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    function explode(shell) {
        if (shell.type === 0) {
            // Nổ tròn cổ điển (Nhiều hạt, bung to)
            const particleCount = 200;
            for (let i = 0; i < particleCount; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 10 + 2; 
                particles.push(new Particle(
                    shell.x, shell.y,
                    Math.cos(angle) * speed, Math.sin(angle) * speed,
                    shell.color
                ));
            }
        } else {
            // Nổ ra Chữ / Hình Ngựa
            const velocities = getShapeVelocities(shell.textShape);
            velocities.forEach(v => {
                // Nhiễu loạn cực thấp để giữ form chữ chuẩn xác
                const jitterX = (Math.random() - 0.5) * 0.2;
                const jitterY = (Math.random() - 0.5) * 0.2;
                particles.push(new Particle(
                    shell.x, shell.y,
                    v.vx + jitterX, v.vy + jitterY,
                    shell.color,
                    true // Bật cờ isText = true để giữ form lơ lửng lâu
                ));
            });
        }
    }

    // ==========================================
    // 4. VÒNG LẶP RENDER (BẮN 3 QUẢ 1 LẦN)
    // ==========================================
    function animate() {
        requestAnimationFrame(animate);
        
        const now = performance.now();
        const deltaTime = now - lastTime;
        lastTime = now;

        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Đuôi mờ ảo
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // NẾU TRÊN TRỜI TRỐNG TRƠN -> CHỜ 3 GIÂY RỒI BẮN 3 QUẢ
        if (shells.length === 0 && particles.length === 0) {
            waitTimer += deltaTime;
            if (waitTimer >= 3000) {
                // Bắn 3 quả chia đều 3 góc: Trái, Giữa, Phải
                shells.push(new Shell(canvas.width * 0.25));
                shells.push(new Shell(canvas.width * 0.50));
                shells.push(new Shell(canvas.width * 0.75));
                waitTimer = 0;
            }
        }

        // Cập nhật các quả đang bay lên
        for (let i = shells.length - 1; i >= 0; i--) {
            shells[i].update();
            shells[i].draw();
            // Lên tới đỉnh (vy >= 0) là nổ
            if (shells[i].vy >= 0) {
                explode(shells[i]);
                shells.splice(i, 1);
            }
        }

        // Cập nhật các hạt pháo hoa đang rớt
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].alpha <= 0) {
                particles.splice(i, 1); // Xóa hạt khi đã mờ tịt
            }
        }
    }

    // Khởi động
    animate();
});